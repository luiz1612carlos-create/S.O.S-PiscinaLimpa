
import React, { useState, useMemo } from 'react';
import { AppContextType, PoolEvent } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { TrashIcon } from '../../constants';

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
    const { poolEvents, loading, acknowledgePoolEvent, deletePoolEvent, showNotification } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isDeletingBatch, setIsDeletingBatch] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'acknowledged'>('new');

    const filteredEvents = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return poolEvents.filter(event => {
            const eventDate = toDate(event.eventDate);
            const statusMatch = activeTab === 'new' ? event.status === 'notified' : event.status === 'acknowledged';
            
            // For 'new' tab, hide past events to reduce clutter. 
            // For 'acknowledged' tab, show everything so the user can see history or delete it.
            const dateMatch = activeTab === 'new' ? (eventDate && eventDate >= now) : true;
            
            return statusMatch && dateMatch;
        }).sort((a,b) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0));
    }, [poolEvents, activeTab]);

    const expiredConfirmedEvents = useMemo(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        return poolEvents.filter(event => {
            const eventDate = toDate(event.eventDate);
            return event.status === 'acknowledged' && eventDate && eventDate <= yesterday;
        });
    }, [poolEvents]);

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

    const handleDelete = async (eventId: string) => {
        if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;
        setProcessingId(eventId);
        try {
            await deletePoolEvent(eventId);
            showNotification('Evento excluído com sucesso.', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao excluir evento.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleBatchDeleteExpired = async () => {
        if (expiredConfirmedEvents.length === 0) return;
        if (!window.confirm(`Tem certeza que deseja excluir ${expiredConfirmedEvents.length} eventos passados? Esta ação não pode ser desfeita.`)) return;

        setIsDeletingBatch(true);
        try {
            // Execute deletions in parallel
            await Promise.all(expiredConfirmedEvents.map(event => deletePoolEvent(event.id)));
            showNotification(`${expiredConfirmedEvents.length} eventos antigos foram removidos.`, 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao limpar histórico.', 'error');
        } finally {
            setIsDeletingBatch(false);
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

            {activeTab === 'acknowledged' && expiredConfirmedEvents.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Limpeza de Histórico</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Existem {expiredConfirmedEvents.length} eventos confirmados que já expiraram.</p>
                    </div>
                    <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={handleBatchDeleteExpired}
                        isLoading={isDeletingBatch}
                    >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Limpar Eventos Passados
                    </Button>
                </div>
            )}

            {loading.poolEvents ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : filteredEvents.length === 0 ? (
                <p>Nenhum evento nesta categoria.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => (
                        <Card key={event.id}>
                           <CardHeader>
                               <div className="flex justify-between items-start">
                                   <h3 className="text-xl font-semibold truncate pr-2">{event.clientName}</h3>
                                   {activeTab === 'acknowledged' && (
                                       <button 
                                            onClick={() => handleDelete(event.id)} 
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                            title="Excluir Evento"
                                            disabled={!!processingId}
                                        >
                                           <TrashIcon className="w-5 h-5" />
                                       </button>
                                   )}
                               </div>
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