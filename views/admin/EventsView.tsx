import React, { useState, useMemo } from 'react';
import { AppContextType, PoolEvent } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';

interface EventsViewProps {
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const EventsView: React.FC<EventsViewProps> = ({ appContext }) => {
    const { poolEvents, loading, acknowledgePoolEvent, showNotification } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'acknowledged'>('new');

    const filteredEvents = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return poolEvents.filter(event => {
            const eventDate = toDate(event.eventDate);
            const statusMatch = activeTab === 'new' ? event.status === 'notified' : event.status === 'acknowledged';
            // For acknowledged, show past events too for history, but for new, only show upcoming
            const dateMatch = activeTab === 'new' ? (eventDate && eventDate >= now) : true;
            return statusMatch && dateMatch;
        }).sort((a,b) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0));
    }, [poolEvents, activeTab]);

    const handleAcknowledge = async (eventId: string) => {
        setProcessingId(eventId);
        try {
            await acknowledgePoolEvent(eventId);
            showNotification('Evento confirmado!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao confirmar evento.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Eventos Agendados por Clientes</h2>
            
            <div className="flex border-b dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`py-2 px-4 text-lg font-semibold ${activeTab === 'new' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Novos ({poolEvents.filter(e => e.status === 'notified').length})
                </button>
                <button
                    onClick={() => setActiveTab('acknowledged')}
                    className={`py-2 px-4 text-lg font-semibold ${activeTab === 'acknowledged' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Confirmados
                </button>
            </div>

            {loading.poolEvents ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : filteredEvents.length === 0 ? (
                <p>Nenhum evento nesta categoria.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => (
                        <Card key={event.id}>
                           <CardHeader>
                               <h3 className="text-xl font-semibold">{event.clientName}</h3>
                               <p className="font-bold text-primary-500">{toDate(event.eventDate)?.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                           </CardHeader>
                           <CardContent>
                                {event.notes ? (
                                    <p className="italic">"{event.notes}"</p>
                                ) : (
                                    <p className="text-gray-500">Nenhuma observação fornecida.</p>
                                )}
                           </CardContent>
                           {event.status === 'notified' && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={() => handleAcknowledge(event.id)}
                                        isLoading={processingId === event.id}
                                        disabled={!!processingId}
                                    >
                                        Confirmar Recebimento
                                    </Button>
                                </div>
                           )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EventsView;
