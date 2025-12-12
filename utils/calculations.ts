
import { Client, Settings, PricingSettings } from './types';

/**
 * Normaliza uma dimensão (largura, comprimento, profundidade) para um número seguro.
 * Trata vírgulas, strings vazias, null, undefined e NaN.
 */
export const normalizeDimension = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    
    // Converte para string primeiro para tratar substituição
    const stringValue = String(value).trim();
    if (stringValue === '') return 0;
    
    // Substitui vírgula por ponto para suportar formato PT-BR e EN
    const normalized = stringValue.replace(',', '.');
    const number = parseFloat(normalized);
    
    // Retorna 0 se for NaN ou Infinito
    if (isNaN(number) || !isFinite(number)) return 0;
    
    return number;
};

/**
 * Calcula o volume da piscina em litros.
 * Retorna 0 se qualquer dimensão for inválida.
 */
export const calculateVolume = (
    width: string | number | null | undefined, 
    length: string | number | null | undefined, 
    depth: string | number | null | undefined
): number => {
    const w = normalizeDimension(width);
    const l = normalizeDimension(length);
    const d = normalizeDimension(depth);

    // Garante que todas as dimensões sejam números positivos antes de calcular
    if (w > 0 && l > 0 && d > 0) {
        // Fórmula: m * m * m * 1000 = Litros
        const volume = w * l * d * 1000;
        return isFinite(volume) ? volume : 0;
    }
    
    return 0;
};

export const calculateDrivingDistance = async (origin: string, destination: string): Promise<number> => {
    try {
        // Função auxiliar para buscar coordenadas com tratamento de erro silencioso
        const fetchCoords = async (query: string): Promise<{ lat: string, lon: string } | null> => {
            // Pequeno delay para evitar rate limit do Nominatim (OpenStreetMap)
            await new Promise(r => setTimeout(r, Math.random() * 500)); 
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
                    headers: { 'User-Agent': 'PiscinaLimpaApp/1.0' }
                });
                
                if (!response.ok) return null;
                
                const data = await response.json();
                if (data && data.length > 0) {
                    return { lat: data[0].lat, lon: data[0].lon };
                }
            } catch (e) {
                console.warn("Falha na requisição de geocodificação:", e);
            }
            return null;
        };

        // Lógica principal de busca com Fallbacks progressivos
        const getBestCoords = async (address: string): Promise<{ lat: string, lon: string }> => {
            // Limpeza: remove partes vazias causadas por ,,
            const parts = address.split(',').map(p => p.trim()).filter(p => p !== '');
            const cleanAddress = parts.join(', ');
            
            // Tentativa 1: Endereço completo limpo
            let coords = await fetchCoords(cleanAddress);
            if (coords) return coords;

            // Tentativa 2: Remover o número (Assume que é o 2º elemento se houver mais de 2 partes)
            // Ex: Rua X, 123, Bairro Y, Cidade... -> Rua X, Bairro Y, Cidade...
            if (parts.length > 2) {
                const noNumberParts = [parts[0], ...parts.slice(2)];
                coords = await fetchCoords(noNumberParts.join(', '));
                if (coords) return coords;
            }

            // Tentativa 3: Apenas Rua e Cidade/Estado (1º e último elemento)
            // Remove número e bairro que podem estar com grafia diferente
            if (parts.length >= 2) {
                const street = parts[0];
                const cityState = parts[parts.length - 1];
                coords = await fetchCoords(`${street}, ${cityState}`);
                if (coords) return coords;
            }
            
            // Tentativa 4 (Fallback Final): Apenas Cidade e Estado (Último elemento)
            // Isso evita o erro fatal se o nome da rua estiver muito errado (ex: "florianoplis")
            if (parts.length > 0) {
                const cityState = parts[parts.length - 1];
                coords = await fetchCoords(cityState);
                if (coords) return coords;
            }

            throw new Error(`Endereço não encontrado: ${address}`);
        };

        const start = await getBestCoords(origin);
        const end = await getBestCoords(destination);

        // Cálculo da Rota via OSRM
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
        const routeResponse = await fetch(osrmUrl);
        const routeData = await routeResponse.json();

        if (routeData.code === 'Ok' && routeData.routes && routeData.routes.length > 0) {
            const distanceInMeters = routeData.routes[0].distance;
            return parseFloat((distanceInMeters / 1000).toFixed(1));
        }
        
        // Fallback: Haversine se a API de rotas falhar mas tivermos coordenadas
        const R = 6371; 
        const dLat = (parseFloat(end.lat) - parseFloat(start.lat)) * (Math.PI/180);
        const dLon = (parseFloat(end.lon) - parseFloat(start.lon)) * (Math.PI/180);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(parseFloat(start.lat) * (Math.PI/180)) * Math.cos(parseFloat(end.lat) * (Math.PI/180)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; 
        return parseFloat((d * 1.3).toFixed(1)); // 1.3 fator de correção para rota urbana vs linha reta

    } catch (error: any) {
        console.error("Erro ao calcular distância:", error);
        if (error.message && error.message.includes('Endereço não encontrado')) {
            throw error;
        }
        throw new Error("Não foi possível calcular a distância. Verifique a conexão ou os endereços.");
    }
};

export const calculateClientMonthlyFee = (client: Partial<Client>, settings: Settings, overridePricing?: PricingSettings): number => {
    if (!client.poolVolume || client.poolVolume <= 0) return 0;

    const pricing = overridePricing || client.customPricing || settings.pricing;
    
    if (!pricing || !pricing.volumeTiers || !Array.isArray(pricing.volumeTiers) || pricing.volumeTiers.length === 0) {
        console.warn("Calculadora: Nenhuma tabela de preços encontrada.");
        return 0;
    }
    
    const safeTiers = pricing.volumeTiers.map(tier => ({
        min: Number(tier.min),
        max: Number(tier.max),
        price: Number(tier.price)
    })).filter(t => !isNaN(t.min) && !isNaN(t.max) && !isNaN(t.price));

    let basePrice = 0;
    
    // Encontrar a faixa onde o volume se encaixa (min <= volume <= max)
    const tier = safeTiers.find(t => client.poolVolume! >= t.min && client.poolVolume! <= t.max);

    if (tier) {
        basePrice = tier.price;
    } else {
        const sortedTiers = safeTiers.sort((a, b) => b.max - a.max);
        if (sortedTiers.length > 0 && client.poolVolume! > sortedTiers[0].max) {
            basePrice = sortedTiers[0].price;
        } else {
            basePrice = 0;
        }
    }
    
    let total = basePrice;
    
    if (client.hasWellWater) total += Number(pricing.wellWaterFee || 0);
    if (client.includeProducts) total += Number(pricing.productsFee || 0);
    if (client.isPartyPool) total += Number(pricing.partyPoolFee || 0);

    if (client.distanceFromHq && client.distanceFromHq > 0 && pricing.perKm) {
        total += Number(client.distanceFromHq) * Number(pricing.perKm);
    }
    
    if (client.plan === 'VIP' && client.fidelityPlan) {
        const discount = total * (Number(client.fidelityPlan.discountPercent) / 100);
        total -= discount;
    }

    return parseFloat(total.toFixed(2));
};

export const compressImage = async (file: File, options: { maxWidth: number, quality: number }): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > options.maxWidth) {
                    height = Math.round((height * options.maxWidth) / width);
                    width = options.maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        reject(new Error('Canvas to Blob failed'));
                    }
                }, 'image/jpeg', options.quality);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
