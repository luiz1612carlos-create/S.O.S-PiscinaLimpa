
import React, { useState, useEffect, useMemo } from 'react';
import { AppContextType, Routes, Settings } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { WeatherCloudyIcon, WeatherSunnyIcon, SparklesIcon, CloudRainIcon } from '../../constants';
import { Select } from '../../components/Select';

// Define a classe globalmente para o TypeScript
declare global {
    interface Window {
        GoogleGenAI: any;
        process: {
            env: {
                API_KEY: string;
            }
        }
    }
}

interface RoutesViewProps {
    appContext: AppContextType;
}

const weekDays: (keyof Routes)[] = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

const RoutesView: React.FC<RoutesViewProps> = ({ appContext }) => {
    const { routes, clients, loading, scheduleClient, unscheduleClient, toggleRouteStatus, showNotification, settings } = appContext;

    const [selectedClient, setSelectedClient] = useState('');
    const [selectedDay, setSelectedDay] = useState(weekDays[0]);

    const handleAddClientToRoute = async () => {
        if (!selectedClient) {
            showNotification('Selecione um cliente para agendar.', 'error');
            return;
        }
        try {
            await scheduleClient(selectedClient, String(selectedDay));
            showNotification('Cliente agendado com sucesso!', 'success');
            setSelectedClient('');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao agendar cliente.', 'error');
        }
    };
    
    const handleRemoveClient = async (clientId: string, day: keyof Routes) => {
         try {
            await unscheduleClient(clientId, String(day));
            showNotification('Cliente removido da rota.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao remover cliente.', 'error');
        }
    };

    const handleToggleRoute = async (day: keyof Routes, currentStatus: boolean) => {
         try {
            await toggleRouteStatus(String(day), !currentStatus);
            showNotification(`Rota de ${day} ${!currentStatus ? 'iniciada' : 'finalizada'}.`, 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao atualizar status da rota.', 'error');
        }
    }

    const availableClientsForScheduling = useMemo(() => {
        const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
        const clientsInSelectedDay = routes[selectedDay]?.clients.map(c => c.id) || [];
        return activeClients.filter(c => !clientsInSelectedDay.includes(c.id));
    }, [clients, routes, selectedDay]);


    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Gerenciamento de Rotas</h2>

            <WeatherForecast settings={settings} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scheduling Panel */}
                <Card className="lg:col-span-1">
                    <CardHeader><h3 className="text-xl font-semibold">Adicionar Cliente à Rota</h3></CardHeader>
                    <CardContent className="space-y-4">
                        <Select
                            label="Cliente"
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            options={[
                                { value: '', label: 'Selecione um cliente...' }, 
                                ...availableClientsForScheduling.map(c => ({ value: c.id, label: c.name }))
                            ]}
                        />
                        <Select
                            label="Dia da Semana"
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value as any)}
                            options={weekDays.map(d => ({ value: d, label: String(d) }))}
                        />
                        <Button onClick={handleAddClientToRoute} className="w-full">Agendar Cliente</Button>
                    </CardContent>
                </Card>

                {/* Scheduled Routes */}
                <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {loading.routes || loading.clients ? <div className="col-span-full flex justify-center"><Spinner/></div> :
                        weekDays.map(day => (
                            <Card key={day}>
                                <CardHeader className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold">{day}</h3>
                                     <div className="flex items-center gap-2">
                                        {routes[day]?.isRouteActive && <span className="text-xs font-bold text-green-500 animate-pulse">EM ROTA</span>}
                                        <Button size="sm" onClick={() => handleToggleRoute(day, routes[day]?.isRouteActive || false)}>
                                            {routes[day]?.isRouteActive ? 'Finalizar' : 'Iniciar Rota'}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 min-h-[10rem]">
                                    {routes[day]?.clients.map(client => (
                                        <div key={client.id} className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-700 rounded">
                                            <span>{client.name}</span>
                                            <button onClick={() => handleRemoveClient(client.id, day)} className="text-red-500 hover:text-red-700">&times;</button>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface Forecast {
    day: string;
    temp: string;
    weatherCode: number;
}

const WeatherForecast: React.FC<{ settings: Settings | null }> = ({ settings }) => {
    const [forecast, setForecast] = useState<Forecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    useEffect(() => {
        const getForecast = async () => {
            setLoading(true);
            setError(null);

            try {
                // 1. Get Coordinates from address, defaulting to "Governador Valadares, MG"
                const addressString = "Governador Valadares, MG";
                const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}`);
                const geoData = await geoResponse.json();

                if (!geoData || geoData.length === 0) {
                    throw new Error("Não foi possível encontrar coordenadas para Governador Valadares.");
                }
                const { lat, lon } = geoData[0];

                // 2. Get Weather from coordinates
                const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&timezone=America/Sao_Paulo&forecast_days=5`);
                const weatherData = await weatherResponse.json();

                const formattedForecast = weatherData.daily.time.map((date: string, index: number) => ({
                    day: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' }),
                    temp: `${Math.round(weatherData.daily.temperature_2m_max[index])}°C`,
                    weatherCode: weatherData.daily.weathercode[index]
                }));
                setForecast(formattedForecast);

            } catch (e: any) {
                setError(e.message || "Falha ao buscar previsão do tempo.");
            } finally {
                setLoading(false);
            }
        };

        getForecast();
    }, [settings]);

    useEffect(() => {
        if (forecast.length > 0) {
            const getAIAnalysis = async () => {
                setIsAnalyzing(true);
                setAiAnalysis(''); // Clear previous analysis
                try {
                    // Check for the global GoogleGenAI object
                    if (typeof window.GoogleGenAI === 'undefined') {
                      throw new Error("A biblioteca de IA do Google ainda está carregando ou falhou. Tente recarregar a página.");
                    }
                    
                    const apiKey = window.process?.env?.API_KEY;

                    // The Gemini SDK will throw an error if the key is missing or invalid.
                    // We catch it below to provide a user-friendly message.
                    const ai = new window.GoogleGenAI({ apiKey: apiKey });

                    const prompt = `
                        Analise os seguintes dados meteorológicos para os próximos 5 dias em Governador Valadares e forneça um resumo e recomendações para o agendamento de serviços de limpeza de piscinas.
                        Seja conciso e direto. Formato da resposta: um parágrafo de resumo e uma lista de pontos com recomendações.
                        Dados: ${forecast.map(f => `${f.day}: ${f.temp}, Código do tempo: ${f.weatherCode}`).join('; ')}
                        (WMO Weather interpretation codes: 0-1 sol, 2-3 parcialmente nublado, 45-48 neblina, 51-65 chuva, 80-82 chuva forte).
                    `;

                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: prompt,
                    });
                    
                    const analysisText = response.text;
                    if (!analysisText) {
                        throw new Error("A IA retornou uma resposta vazia.");
                    }
                    setAiAnalysis(analysisText);

                } catch (e: any) {
                    console.error("Erro na análise da IA:", e);
                    if (e.message && (e.message.includes('API key not valid') || e.message.includes('API key not found'))) {
                        setAiAnalysis("Análise da IA indisponível. (API Key não configurada ou inválida).");
                    } else {
                        setAiAnalysis("Não foi possível gerar a análise da IA: " + e.message);
                    }
                } finally {
                    setIsAnalyzing(false);
                }
            };
            getAIAnalysis();
        }
    }, [forecast]);

    const getWeatherIcon = (code: number) => {
        if (code <= 1) return WeatherSunnyIcon;
        if (code >= 51 && code <= 82) return CloudRainIcon;
        return WeatherCloudyIcon;
    };

    return (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader><h3 className="font-semibold">Previsão do Tempo (Governador Valadares)</h3></CardHeader>
                <CardContent className="flex justify-around items-center">
                    {loading ? <Spinner /> : error ? <p className="text-red-500">{error}</p> :
                        forecast.map((f, i) => {
                            const Icon = getWeatherIcon(f.weatherCode);
                            return (
                                <div key={i} className="text-center">
                                    <p className="font-bold">{i === 0 ? 'Hoje' : f.day.charAt(0).toUpperCase() + f.day.slice(1, 3)}</p>
                                    <Icon className="w-10 h-10 mx-auto text-yellow-500 dark:text-yellow-400" />
                                    <p>{f.temp}</p>
                                </div>
                            )
                        })
                    }
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-500" />
                        <h3 className="font-semibold">Análise da IA</h3>
                    </div>
                </CardHeader>
                <CardContent>
                    {isAnalyzing ? <Spinner /> : 
                        <div className="text-sm space-y-2 whitespace-pre-wrap">
                            {aiAnalysis.split('\n').map((line, i) => {
                                if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                                    return <p key={i} className="pl-4">{line}</p>;
                                }
                                return <p key={i}>{line}</p>;
                            })}
                        </div>
                    }
                </CardContent>
            </Card>
        </div>
    );
};

export default RoutesView;
