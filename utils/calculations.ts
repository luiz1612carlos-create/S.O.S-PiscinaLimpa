
import { Client, Settings, FidelityPlan, PricingSettings } from './types';

export const normalizeDimension = (value: string | number): number => {
    if (value === null || value === undefined) return 0;
    const stringValue = String(value).trim();
    if (stringValue === '') return 0;
    
    const normalized = stringValue.replace(',', '.');
    const number = parseFloat(normalized);
    
    return isNaN(number) ? 0 : number;
};

export const calculateVolume = (width: string | number, length: string | number, depth: string | number) => {
    const w = normalizeDimension(width);
    const l = normalizeDimension(length);
    const d = normalizeDimension(depth);
    if (w > 0 && l > 0 && d > 0) {
        return w * l * d * 1000;
    }
    return 0;
};

export const calculateClientMonthlyFee = (client: Partial<Client>, settings: Settings, overridePricing?: PricingSettings): number => {
    if (!client.poolVolume || client.poolVolume <= 0) return 0;

    // Use override pricing if provided (for simulations), 
    // otherwise custom pricing (for VIPs/locked), 
    // otherwise global settings.
    const pricing = overridePricing || client.customPricing || settings.pricing;
    
    // Ensure tiers are sorted by volume to always find the correct bracket
    // Clone the array to avoid mutating the original reference
    const sortedTiers = [...pricing.volumeTiers].sort((a, b) => a.upTo - b.upTo);

    let basePrice = sortedTiers.find(tier => client.poolVolume! <= tier.upTo)?.price || sortedTiers[sortedTiers.length - 1].price;

    if (client.hasWellWater) basePrice += pricing.wellWaterFee;
    if (client.includeProducts) basePrice += pricing.productsFee;
    if (client.isPartyPool) basePrice += pricing.partyPoolFee;
    
    // Add KM fee
    if (client.distanceFromHq && client.distanceFromHq > 0) {
        basePrice += client.distanceFromHq * pricing.perKm;
    }

    // If we are using an override (simulation of new price), we generally ignore fidelity discounts 
    // UNLESS the client is actually on a VIP plan, in which case the discount still applies to the new base.
    if (client.plan === 'VIP' && client.fidelityPlan && settings.features.vipPlanEnabled) {
        basePrice = basePrice * (1 - client.fidelityPlan.discountPercent / 100);
    }

    return basePrice;
};

/**
 * Calculates the driving distance between two addresses using OpenStreetMap (Nominatim) and OSRM.
 * This is much more accurate than using LLM AI estimation.
 */
export const calculateDrivingDistance = async (originAddress: string, destinationAddress: string): Promise<number> => {
    
    // Helper to fetch coordinates with retry/fallback logic
    const getCoordinatesWithFallback = async (addressQuery: string): Promise<{ lat: string, lon: string }> => {
        const fetchFromAPI = async (query: string) => {
            // Use Nominatim for Geocoding (Free, requires User-Agent in headers implicitly by browser)
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            if (!response.ok) return null;
            const data = await response.json();
            if (!data || data.length === 0) return null;
            return { lat: data[0].lat, lon: data[0].lon };
        };

        // Attempt 1: Full precise address
        let coords = await fetchFromAPI(addressQuery);
        if (coords) return coords;

        // Attempt 2: Fallback for districts (Baguari case).
        // If "Street, Number, Neighborhood, City - State" fails, try "Neighborhood, City - State".
        // We assume the input format is usually comma-separated.
        const parts = addressQuery.split(',');
        
        // If we have at least 3 parts (e.g. Street, Number, Neighborhood/City...), try removing the first two (Street, Number)
        if (parts.length >= 3) {
            // Heuristic: Take the last 2 parts if length is small, or skip the first 2.
            // For "Rua X, 0, Baguari, GV - MG", skipping first 2 gives " Baguari, GV - MG".
            const broadQuery = parts.slice(2).join(',').trim();
            console.log(`Tentando fallback de endereço: "${broadQuery}"`);
            coords = await fetchFromAPI(broadQuery);
            if (coords) return coords;
        }

        // Attempt 3: If still nothing and we have at least 2 parts, try just the last part (City/State)
        // This prevents total failure, though accuracy drops to city center.
        if (parts.length >= 2) {
             const cityQuery = parts.slice(parts.length - 1).join(',').trim();
             // Only try this if it looks like a city string (length check)
             if (cityQuery.length > 3) {
                 coords = await fetchFromAPI(cityQuery);
                 if (coords) return coords;
             }
        }

        throw new Error(`Endereço não encontrado no mapa: ${addressQuery}`);
    };

    try {
        const start = await getCoordinatesWithFallback(originAddress);
        const end = await getCoordinatesWithFallback(destinationAddress);

        // Use OSRM for Routing (Driving distance)
        const routerUrl = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=false`;
        const routeResponse = await fetch(routerUrl);
        
        if (!routeResponse.ok) throw new Error('Falha no serviço de cálculo de rota');
        
        const routeData = await routeResponse.json();

        if (routeData.code !== 'Ok' || !routeData.routes || routeData.routes.length === 0) {
            // Fallback to Haversine distance (straight line) if routing fails (e.g., across oceans or no roads mapped)
            // This is rare for local pool service but good for robustness.
            console.warn("Rota de condução falhou, usando distância em linha reta.");
            return calculateHaversineDistance(parseFloat(start.lat), parseFloat(start.lon), parseFloat(end.lat), parseFloat(end.lon));
        }

        const distanceMeters = routeData.routes[0].distance;
        // Convert to KM and round to 1 decimal place
        return parseFloat((distanceMeters / 1000).toFixed(1));

    } catch (error: any) {
        console.error("Erro no cálculo de distância:", error);
        throw new Error(error.message || "Erro ao calcular distância.");
    }
};

// Helper for straight-line distance if road routing fails completely
const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
};

/**
 * Compresses an image file before upload.
 * @param file The image file to compress.
 * @param options Configuration for max width and quality.
 * @returns A promise that resolves with the compressed file.
 */
export const compressImage = (file: File, options: { maxWidth: number; quality: number }): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If not an image, return the original file
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const { width, height } = img;
        let newWidth = width;
        let newHeight = height;

        if (width > options.maxWidth) {
          newWidth = options.maxWidth;
          newHeight = (height * options.maxWidth) / width;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to JPEG for optimal compression.
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob conversion failed'));
            }
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpeg";
            const newFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          'image/jpeg',
          options.quality
        );
      };
    };
  });
};
