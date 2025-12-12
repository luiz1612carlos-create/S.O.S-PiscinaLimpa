
import React, { useState, useEffect, useMemo } from 'react';
import { AuthContextType, AppContextType, Client, ReplenishmentQuote, Order, Settings, CartItem, AdvancePaymentRequest, PoolEvent, RecessPeriod, PendingPriceChange } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { WeatherSunnyIcon, CopyIcon, CheckIcon, XMarkIcon, CalendarDaysIcon, CurrencyDollarIcon } from '../../constants';
import { calculateClientMonthlyFee } from '../../utils/calculations';

interface ClientDashboardViewProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ authContext, appContext }) => {
    const { user, changePassword, showNotification } = authContext;
    const { clients, loading, settings, routes, replenishmentQuotes, updateReplenishmentQuoteStatus, createOrder, createAdvancePaymentRequest, isAdvancePlanGloballyAvailable, advancePaymentRequests, banks, poolEvents, createPoolEvent, pendingPriceChanges } = appContext;
    
    // Use client data from context instead of local fetch to prevent race conditions/loops
    const clientData = useMemo(() => {
        return clients.find(c => c.uid === user.uid) || null;
    }, [clients, user.uid]);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);

    
    const nextVisit = useMemo(() => {
        if (!clientData || !routes) return null;
        for (const dayKey of Object.keys(routes)) {
            const day = routes[dayKey];
            if (day.clients.some(c => c.id === clientData.id)) {
                return { day: day.day, isRouteActive: day.isRouteActive };
            }
        }
        return null;
    }, [clientData, routes]);

    const pendingQuote = useMemo(() => {
        if (!clientData || !replenishmentQuotes) return null;
        return replenishmentQuotes.find(q => q.clientId === clientData.id && q.status === 'sent');
    }, [clientData, replenishmentQuotes]);

    const mostRecentRequest = useMemo(() => {
        if (!clientData || !advancePaymentRequests || advancePaymentRequests.length === 0) return null;
        // The list is already sorted by createdAt desc, so the first one is the most recent.
        return advancePaymentRequests[0];
    }, [clientData, advancePaymentRequests]);

    const showStatusCard = useMemo(() => {
        if (!mostRecentRequest) return false;
        if (mostRecentRequest.status === 'pending') return true;

        const updatedAt = toDate(mostRecentRequest.updatedAt);
        if (!updatedAt) return false;

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        return updatedAt > threeDaysAgo;
    }, [mostRecentRequest]);
    
    // Check for Price Change Notifications
    const priceChangeNotification = useMemo(() => {
        if (!clientData || !pendingPriceChanges || pendingPriceChanges.length === 0) return null;
        
        // Find the first pending change that affects this client
        const relevantChange = pendingPriceChanges.find(change => 
            change.status === 'pending' && 
            change.affectedClients.some(affected => affected.id === clientData.id)
        );
        
        return relevantChange;
    }, [clientData, pendingPriceChanges]);


    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showNotification('As senhas não coincidem.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showNotification('A senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }
        
        setIsSavingPassword(true);
        try {
            await changePassword(newPassword);
            showNotification('Senha alterada com sucesso!', 'success');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao alterar senha.', 'error');
        } finally {
            setIsSavingPassword(false);
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showNotification('Chave PIX copiada!', 'info');
    };

    const isBlockedByDueDate = useMemo(() => {
        if (!clientData) return true;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(clientData.payment.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const fifteenDaysFromNow = new Date(today);
        fifteenDaysFromNow.setDate(today.getDate() + 15);
        
        return clientData.payment.status !== 'Pago' && dueDate <= fifteenDaysFromNow;
    }, [clientData]);
    
    const hasPendingAdvanceRequest = useMemo(() => {
        if (!clientData || !advancePaymentRequests) return false;
        return advancePaymentRequests.some(r => r.clientId === clientData.uid && r.status === 'pending');
    }, [clientData, advancePaymentRequests]);

    const disabledTitle = useMemo(() => {
        if (hasPendingAdvanceRequest) {
            return "Você já possui uma solicitação de adiantamento pendente.";
        }
        if (isBlockedByDueDate) {
            return "Quite sua fatura atual para liberar esta opção (vencimento próximo ou em atraso).";
        }
        return "Ver opções de desconto";
    }, [hasPendingAdvanceRequest, isBlockedByDueDate]);

    const upcomingRecesses = useMemo(() => {
        if (!settings?.recessPeriods) return [];
        
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);
        now.setHours(0,0,0,0);

        return settings.recessPeriods.filter(recess => {
            const startDate = toDate(recess.startDate);
            const endDate = toDate(recess.endDate);
            if (!startDate || !endDate) return false;

            const isActive = now >= startDate && now <= endDate;
            const isUpcoming = startDate <= thirtyDaysFromNow && endDate >= now;

            return isActive || isUpcoming;
        }).sort((a, b) => (toDate(a.startDate)?.getTime() || 0) - (toDate(b.startDate)?.getTime() || 0));
    }, [settings?.recessPeriods]);


    if ((loading.clients || loading.settings) || !settings) {
        return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
    }
    
    if (!clientData) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p>Não foi possível carregar os dados do cliente.</p>
                <p className="text-sm">Se o problema persistir, entre em contato com o suporte.</p>
            </div>
        );
    }

    const clientBank = banks.find(b => b.id === clientData.bankId);
    const pixKeyToDisplay = clientData.pixKey || clientBank?.pixKey || settings?.pixKey || '';
    const monthlyFee = calculateClientMonthlyFee(clientData, settings);

    const advancePlanSubtitle = clientData.plan === 'VIP'
        ? settings.features.advancePaymentSubtitleVIP
        : settings.features.advancePaymentSubtitleSimple;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                
                {priceChangeNotification && (
                    <PriceChangeNotificationCard 
                        notification={priceChangeNotification} 
                        currentFee={monthlyFee} 
                        client={clientData}
                        settings={settings}
                    />
                )}
                
                {upcomingRecesses.length > 0 && <RecessNotificationCard recesses={upcomingRecesses} />}

                {pendingQuote && <ReplenishmentCard quote={pendingQuote} client={clientData} updateStatus={updateReplenishmentQuoteStatus} createOrder={createOrder} showNotification={showNotification}/>}
                
                {showStatusCard && mostRecentRequest && (
                    <RequestStatusCard request={mostRecentRequest} client={clientData} />
                )}

                {isAdvancePlanGloballyAvailable && settings.advancePaymentOptions.length > 0 &&
                    (!showStatusCard || (mostRecentRequest && mostRecentRequest.status === 'rejected')) && (
                    <div className="bg-primary-500 text-white rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
                        <div className="text-center md:text-left">
                            <h3 className="font-bold text-xl">{settings.features.advancePaymentTitle}</h3>
                            <p className="text-primary-100">{advancePlanSubtitle}</p>
                        </div>
                        <Button 
                            onClick={() => setIsAdvanceModalOpen(true)} 
                            variant="light"
                            className="flex-shrink-0"
                            size="lg"
                            disabled={isBlockedByDueDate || hasPendingAdvanceRequest}
                            title={disabledTitle}
                        >
                            {mostRecentRequest?.status === 'rejected' && showStatusCard ? 'Tentar Novamente' : 'Ver Opções de Desconto'}
                        </Button>
                    </div>
                )}
                
                <EventSchedulerCard
                    client={clientData}
                    poolEvents={poolEvents}
                    createPoolEvent={createPoolEvent}
                    showNotification={showNotification}
                />

                {/* Visit History */}
                <Card data-tour-id="visit-history">
                    <CardHeader data-tour-id="visit-history-header"><h3 className="text-xl font-semibold">Histórico de Visitas</h3></CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                        {clientData.visitHistory && clientData.visitHistory.length > 0 ?
                            [...clientData.visitHistory].sort((a, b) => (toDate(b.timestamp)?.getTime() || 0) - (toDate(a.timestamp)?.getTime() || 0)).map(visit => (
                                <div key={visit.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="font-semibold text-sm">
                                        {toDate(visit.timestamp)?.toLocaleString('pt-BR')}
                                        <span className="font-normal text-gray-500"> por {visit.technicianName}</span>
                                    </p>
                                    <p className="text-xs mt-1">
                                        <span title="pH">pH: {visit.ph}</span> | 
                                        <span title="Cloro"> Cl: {visit.cloro}</span> | 
                                        <span title="Alcalinidade"> Alc: {visit.alcalinidade}</span> | 
                                        <span className={`font-bold ${visit.uso === 'Livre para uso' ? 'text-green-500' : 'text-yellow-500'}`}> {visit.uso}</span>
                                    </p>
                                    {visit.notes && <p className="mt-1 text-sm italic bg-white dark:bg-gray-800 p-2 rounded">"{visit.notes}"</p>}
                                    {visit.photoUrl && <a href={visit.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:underline mt-1 inline-block">Ver Foto da Visita</a>}
                                </div>
                            ))
                            : <p className="text-gray-500">Nenhum registro de visita encontrado.</p>
                        }
                    </CardContent>
                </Card>

                {/* Pool Status */}
                <Card data-tour-id="pool-status">
                    <CardHeader data-tour-id="pool-status-header"><h3 className="text-xl font-semibold">Status Atual da Piscina</h3></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div><p className="text-sm text-gray-500">pH</p><p className="text-2xl font-bold">{clientData.poolStatus.ph.toFixed(1)}</p></div>
                        <div><p className="text-sm text-gray-500">Cloro</p><p className="text-2xl font-bold">{clientData.poolStatus.cloro.toFixed(1)}</p></div>
                        <div><p className="text-sm text-gray-500">Alcalinidade</p><p className="text-2xl font-bold">{clientData.poolStatus.alcalinidade}</p></div>
                        <div className={`${clientData.poolStatus.uso === 'Livre para uso' ? 'text-green-500' : 'text-yellow-500'}`}>
                            <p className="text-sm">Uso</p>
                            <p className="text-lg font-bold">{clientData.poolStatus.uso}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Next Visit & Payment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><h3 className="text-xl font-semibold">Próxima Visita</h3></CardHeader>
                        <CardContent className="text-center">
                            {nextVisit ? (
                                <>
                                    <WeatherSunnyIcon className="w-16 h-16 mx-auto text-yellow-400 mb-2"/>
                                    <p className="text-3xl font-bold">{nextVisit.day}</p>
                                    <p className="text-gray-500">Previsão: Ensolarado, 28°C</p>
                                    {nextVisit.isRouteActive && <p className="mt-2 text-green-500 font-bold animate-pulse">Equipe em rota!</p>}
                                </>
                            ) : <p>Nenhuma visita agendada.</p>}
                        </CardContent>
                    </Card>
                     <Card data-tour-id="payment">
                        <CardHeader data-tour-id="payment-header"><h3 className="text-xl font-semibold">Pagamento</h3></CardHeader>
                        <CardContent className="flex flex-col justify-between h-full">
                             <div>
                                <p className="text-gray-500">Mensalidade</p>
                                <p className="text-2xl font-bold">R$ {monthlyFee.toFixed(2)}</p>
                                <p className="text-gray-500 mt-2">Próximo Vencimento</p>
                                <p className="text-3xl font-bold mb-2">{new Date(clientData.payment.dueDate).toLocaleDateString('pt-BR')}</p>
                                 <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                                    <p className="text-xs">Pague com PIX:</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <p className="font-mono text-sm">{pixKeyToDisplay}</p>
                                        <button onClick={() => pixKeyToDisplay && copyToClipboard(pixKeyToDisplay)} className="text-gray-500 hover:text-primary-500">
                                            <CopyIcon className="w-4 h-4"/>
                                        </button>
                                    </div>
                                 </div>
                             </div>
                        </CardContent>
                    </Card>
                </div>

                {/* My Account */}
                <Card>
                    <CardHeader><h3 className="text-xl font-semibold">Minha Conta</h3></CardHeader>
                    <CardContent>
                        <p><strong>Nome:</strong> {clientData.name}</p>
                        <p><strong>Email:</strong> {clientData.email}</p>
                        <p><strong>Telefone:</strong> {clientData.phone}</p>
                        <hr className="my-4 dark:border-gray-700"/>
                        <h4 className="font-semibold mb-2">Alterar Senha</h4>
                        <form onSubmit={handlePasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <Input label="Nova Senha" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} containerClassName="mb-0"/>
                            <Input label="Confirmar Senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} containerClassName="mb-0"/>
                            <Button type="submit" isLoading={isSavingPassword}>Salvar Senha</Button>
                        </form>
                    </CardContent>
                </Card>

            </div>

            {/* My Products */}
            <div className="lg:col-span-1">
                <Card data-tour-id="client-stock">
                    <CardHeader data-tour-id="client-stock-header"><h3 className="text-xl font-semibold">Meus Produtos</h3></CardHeader>
                    <CardContent className="space-y-3 max-h-[80vh] overflow-y-auto">
                        {clientData.stock.length > 0 ? clientData.stock.map(item => (
                            <div key={item.productId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                </div>
                                <div className="text-right">
                                     <p className="font-bold text-lg">{item.quantity}</p>
                                     {item.quantity <= (settings?.automation.replenishmentStockThreshold || 2) && <p className="text-xs text-red-500 font-semibold">Reposição recomendada</p>}
                                </div>
                            </div>
                        )) : <p>Nenhum produto em seu estoque.</p>}
                    </CardContent>
                </Card>
            </div>
            {isAdvanceModalOpen && (
                <AdvancePaymentModal
                    isOpen={isAdvanceModalOpen}
                    onClose={() => setIsAdvanceModalOpen(false)}
                    client={clientData}
                    settings={settings}
                    monthlyFee={monthlyFee}
                    onSubmit={createAdvancePaymentRequest}
                    showNotification={showNotification}
                />
            )}
        </div>
    );
};

interface PriceChangeNotificationCardProps {
    notification: PendingPriceChange;
    currentFee: number;
    client: Client;
    settings: Settings;
}

const PriceChangeNotificationCard: React.FC<PriceChangeNotificationCardProps> = ({ notification, currentFee, client, settings }) => {
    // Calculate new fee explicitly using the pricing from the notification as an override.
    // This ensures that even if the client has an old 'customPricing' property, the simulation uses the new global rules.
    const newFee = useMemo(() => {
        return calculateClientMonthlyFee(client, settings, notification.newPricing);
    }, [client, notification.newPricing, settings]);

    return (
        <Card className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <CurrencyDollarIcon className="w-6 h-6 text-orange-600" />
                    <h3 className="text-xl font-semibold text-orange-700 dark:text-orange-300">Aviso de Reajuste de Preço</h3>
                </div>
            </CardHeader>
            <CardContent>
                <p className="mb-2">Informamos que haverá um reajuste nos valores dos nossos serviços.</p>
                <p className="mb-4">
                    A partir de <strong>{toDate(notification.effectiveDate)?.toLocaleDateString('pt-BR')}</strong>, o valor da sua mensalidade será atualizado.
                </p>
                <div className="flex items-center gap-4 text-sm sm:text-base">
                    <div className="p-3 bg-white dark:bg-gray-700 rounded-md shadow-sm border border-orange-200 dark:border-orange-800">
                        <p className="text-gray-500 dark:text-gray-400 text-xs uppercase">Valor Atual</p>
                        <p className="font-bold text-gray-700 dark:text-gray-200 line-through decoration-red-500">R$ {currentFee.toFixed(2)}</p>
                    </div>
                    <div className="text-orange-500 font-bold text-xl">→</div>
                    <div className="p-3 bg-white dark:bg-gray-700 rounded-md shadow-sm border-2 border-orange-500">
                        <p className="text-orange-600 dark:text-orange-400 text-xs uppercase font-bold">Novo Valor</p>
                        <p className="font-bold text-xl text-orange-700 dark:text-orange-300">R$ {newFee.toFixed(2)}</p>
                    </div>
                </div>
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    * O novo valor será aplicado automaticamente na fatura com vencimento posterior à data efetiva.
                </p>
            </CardContent>
        </Card>
    );
};

interface RecessNotificationCardProps {
    recesses: RecessPeriod[];
}

const RecessNotificationCard: React.FC<RecessNotificationCardProps> = ({ recesses }) => (
    <Card className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
        <CardHeader>
            <div className="flex items-center gap-3">
                <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">Aviso de Recesso</h3>
            </div>
        </CardHeader>
        <CardContent>
            <p className="mb-4">Informamos que nossa equipe estará em recesso nos seguintes períodos. Planeje suas solicitações com antecedência.</p>
            <div className="space-y-2">
                {recesses.map(recess => (
                    <div key={recess.id} className="p-2 bg-white dark:bg-gray-700 rounded-md">
                        <p className="font-semibold">{recess.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            De {toDate(recess.startDate)?.toLocaleDateString('pt-BR')} até {toDate(recess.endDate)?.toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);


interface RequestStatusCardProps {
    request: AdvancePaymentRequest;
    client: Client;
}

const RequestStatusCard: React.FC<RequestStatusCardProps> = ({ request, client }) => {
    const statusConfig = {
        pending: {
            title: "Solicitação Pendente",
            message: `Sua solicitação de adiantamento para ${request.months} meses foi enviada e está sendo analisada.`,
            color: "yellow"
        },
        approved: {
            title: "Pagamento Confirmado!",
            message: `Sua solicitação foi aprovada. Sua nova data de vencimento é ${new Date(client.payment.dueDate).toLocaleDateString('pt-BR')}.`,
            color: "green"
        },
        rejected: {
            title: "Solicitação Rejeitada",
            message: "Sua solicitação não foi aprovada. Você pode tentar novamente com outra opção ou entrar em contato para mais detalhes.",
            color: "red"
        }
    };
    
    const config = statusConfig[request.status];
    const colorClasses = {
        yellow: "bg-yellow-100 border-yellow-500 text-yellow-700",
        green: "bg-green-100 border-green-500 text-green-700",
        red: "bg-red-100 border-red-500 text-red-700",
    }
    
    return (
        <div className={`border-l-4 p-4 rounded-md ${colorClasses[config.color as keyof typeof colorClasses]}`} role="alert">
            <p className="font-bold">{config.title}</p>
            <p>{config.message}</p>
        </div>
    );
};


interface AdvancePaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    settings: Settings;
    monthlyFee: number;
    onSubmit: (request: Omit<AdvancePaymentRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    showNotification: (message: string, type: 'success' | 'error') => void;
}

const AdvancePaymentModal: React.FC<AdvancePaymentModalProps> = ({ isOpen, onClose, client, settings, monthlyFee, onSubmit, showNotification }) => {
    const [selectedMonths, setSelectedMonths] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const paymentOptions = useMemo(() => {
        const options: any[] = [{
            months: 1,
            discountPercent: 0,
            originalAmount: monthlyFee,
            finalAmount: monthlyFee,
        }];

        settings.advancePaymentOptions.forEach(opt => {
            const originalTotal = monthlyFee * opt.months;
            const discount = originalTotal * (opt.discountPercent / 100);
            options.push({
                months: opt.months,
                discountPercent: opt.discountPercent,
                originalAmount: originalTotal,
                finalAmount: originalTotal - discount,
            });
        });
        return options;
    }, [monthlyFee, settings.advancePaymentOptions]);

    const handleSubmit = async () => {
        const selectedOption = paymentOptions.find(opt => opt.months === selectedMonths);
        if (!selectedOption) return;

        setIsSubmitting(true);
        try {
            const request: Omit<AdvancePaymentRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
                clientId: client.uid!,
                clientName: client.name,
                months: selectedOption.months,
                discountPercent: selectedOption.discountPercent,
                originalAmount: selectedOption.originalAmount,
                finalAmount: selectedOption.finalAmount,
            };
            await onSubmit(request);
            showNotification('Solicitação de adiantamento enviada!', 'success');
            onClose();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao enviar solicitação.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adiantar Pagamento com Desconto">
            <div className="space-y-4">
                <p>Selecione uma das opções abaixo para solicitar o adiantamento. Um administrador irá confirmar o pagamento.</p>
                {paymentOptions.map(opt => (
                    <div 
                        key={opt.months} 
                        onClick={() => setSelectedMonths(opt.months)}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedMonths === opt.months ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600'}`}
                    >
                        <p className="font-bold text-lg">{opt.months} Mês(es)</p>
                        {opt.discountPercent > 0 && <p className="text-sm text-green-600">{opt.discountPercent}% de desconto!</p>}
                        
                        <p className="text-xl font-bold mt-2 pt-2 border-t dark:border-gray-600">Total a Pagar: R$ {opt.finalAmount.toFixed(2)}</p>
                    </div>
                ))}
            </div>
            <div className="mt-6 flex justify-end">
                <Button onClick={handleSubmit} isLoading={isSubmitting}>
                    Solicitar Adiantamento
                </Button>
            </div>
        </Modal>
    );
};


const ReplenishmentCard = ({ quote, client, updateStatus, createOrder, showNotification }: { quote: ReplenishmentQuote, client: Client, updateStatus: any, createOrder: any, showNotification: any }) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = async () => {
        setIsProcessing(true);
        try {
            await updateStatus(quote.id, 'approved');
            const newOrder: Omit<Order, 'id' | 'createdAt'> = {
                clientId: client.uid || client.id,
                clientName: client.name,
                items: quote.items,
                total: quote.total,
                status: 'Pendente',
            };
            await createOrder(newOrder);
            showNotification('Pedido de reposição criado com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao aprovar sugestão.', 'error');
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        try {
            await updateStatus(quote.id, 'rejected');
            showNotification('Sugestão de reposição recusada.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao recusar sugestão.', 'error');
            setIsProcessing(false);
        }
    };

    return (
        <Card className="border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/20">
            <CardHeader>
                <h3 className="text-xl font-semibold text-primary-700 dark:text-primary-300">Sugestão de Reposição de Estoque</h3>
            </CardHeader>
            <CardContent>
                <p className="mb-4">Notamos que alguns dos seus produtos estão acabando. Gostaria de aprovar este pedido de reposição?</p>
                <ul className="space-y-2 mb-4">
                    {quote.items.map(item => (
                        <li key={item.id} className="flex justify-between p-2 bg-white dark:bg-gray-700 rounded-md">
                            <span>{item.name} x {item.quantity}</span>
                            <span className="font-semibold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                    ))}
                </ul>
                <div className="text-right font-bold text-xl">
                    Total: R$ {quote.total.toFixed(2)}
                </div>
            </CardContent>
            <div className="p-4 flex justify-end gap-4">
                <Button variant="secondary" onClick={handleReject} isLoading={isProcessing}>Recusar</Button>
                <Button onClick={handleApprove} isLoading={isProcessing}>Aprovar e Criar Pedido</Button>
            </div>
        </Card>
    )
}

interface EventSchedulerCardProps {
    client: Client;
    poolEvents: PoolEvent[];
    createPoolEvent: AppContextType['createPoolEvent'];
    showNotification: AppContextType['showNotification'];
}

const EventSchedulerCard: React.FC<EventSchedulerCardProps> = ({ client, poolEvents, createPoolEvent, showNotification }) => {
    const [eventDate, setEventDate] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    const upcomingEvents = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return poolEvents.filter(e => {
            const eventD = toDate(e.eventDate);
            return eventD && eventD >= now;
        }).sort((a, b) => (toDate(a.eventDate)?.getTime() || 0) - (toDate(b.eventDate)?.getTime() || 0));
    }, [poolEvents]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventDate) {
            showNotification('Por favor, selecione a data do evento.', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            await createPoolEvent({
                clientId: client.uid!,
                clientName: client.name,
                eventDate: new Date(eventDate + 'T12:00:00'), // Use midday to avoid timezone issues
                notes,
            });
            showNotification('Evento notificado com sucesso!', 'success');
            setEventDate('');
            setNotes('');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao notificar evento.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader><h3 className="text-xl font-semibold">Agendar Evento na Piscina</h3></CardHeader>
            <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Tem uma festa ou evento planejado? Nos avise com antecedência para prepararmos sua piscina!
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Data do Evento"
                        type="date"
                        value={eventDate}
                        onChange={e => setEventDate(e.target.value)}
                        min={today}
                        required
                    />
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Observações (opcional): ex: número de convidados, horário..."
                        rows={3}
                        className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <Button type="submit" isLoading={isSubmitting} className="w-full">Notificar Empresa</Button>
                </form>

                {upcomingEvents.length > 0 && (
                    <div className="mt-6">
                        <h4 className="font-semibold mb-2">Seus Próximos Eventos</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {upcomingEvents.map(event => (
                                <div key={event.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <p className="font-semibold">{toDate(event.eventDate)?.toLocaleDateString('pt-BR')}</p>
                                    <p className="text-sm text-gray-500">{event.notes}</p>
                                    <p className={`text-xs font-bold uppercase ${event.status === 'acknowledged' ? 'text-green-500' : 'text-yellow-500'}`}>
                                        Status: {event.status === 'acknowledged' ? 'Confirmado pela Equipe' : 'Aguardando Confirmação'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ClientDashboardView;