import React, { useState, useEffect, useMemo } from 'react';
import { AuthContextType, AppContextType, Client, ReplenishmentQuote, Order, Settings, CartItem, AdvancePaymentRequest, PoolEvent, RecessPeriod, PendingPriceChange, PlanChangeRequest, FidelityPlan } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { WeatherSunnyIcon, CopyIcon, CheckIcon, XMarkIcon, CalendarDaysIcon, CurrencyDollarIcon, CheckBadgeIcon, SparklesIcon } from '../../constants';
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
    const { clients, loading, settings, routes, replenishmentQuotes, updateReplenishmentQuoteStatus, createOrder, createAdvancePaymentRequest, isAdvancePlanGloballyAvailable, advancePaymentRequests, banks, poolEvents, createPoolEvent, pendingPriceChanges, planChangeRequests, requestPlanChange, acceptPlanChange, cancelPlanChangeRequest } = appContext;
    
    // Use client data from context instead of local fetch to prevent race conditions/loops
    const clientData = useMemo(() => {
        return clients.find(c => c.uid === user.uid) || null;
    }, [clients, user.uid]);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    
    // Plan Upgrade State
    const [isPlanUpgradeModalOpen, setIsPlanUpgradeModalOpen] = useState(false);
    const [isRequestingPlanChange, setIsRequestingPlanChange] = useState(false);
    const [selectedUpgradeOptionId, setSelectedUpgradeOptionId] = useState<string>('monthly');

    
    const nextVisit = useMemo(() => {
        if (!clientData || !routes) return null;
        
        // Portuguese day names as used in the routes state/database
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayIndex = new Date().getDay();

        // Create a sequence starting from today for the next 7 days
        const searchSequence = [];
        for (let i = 0; i < 7; i++) {
            searchSequence.push({
                index: (todayIndex + i) % 7,
                offset: i
            });
        }
        
        for (const item of searchSequence) {
            const dayName = dayNames[item.index];
            const routeDay = routes[dayName];
            
            // Check if client (by uid or id) exists in this day's route list
            if (routeDay && routeDay.clients && routeDay.clients.some(c => c.uid === clientData.uid || c.id === clientData.id)) {
                return { 
                    day: item.offset === 0 ? 'Hoje' : dayName, 
                    isRouteActive: routeDay.isRouteActive 
                };
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

    // Current Plan Details based on Settings
    const currentPlanDetails = useMemo(() => {
        if (!clientData || !settings) return null;
        // Determine base plan settings
        const basePlan = clientData.plan === 'VIP' ? settings.plans.vip : settings.plans.simple;
        
        return {
            title: basePlan.title,
            benefits: basePlan.benefits,
            terms: basePlan.terms,
            fidelity: clientData.fidelityPlan, // For VIP
            planType: clientData.plan
        };
    }, [clientData, settings]);
    
    const activePlanChangeRequest = useMemo(() => {
        if (!clientData || !planChangeRequests) return null;
        // Only active if pending or quoted.
        return planChangeRequests.find(req => 
            req.clientId === clientData.uid && (req.status === 'pending' || req.status === 'quoted')
        );
    }, [planChangeRequests, clientData]);

    const upgradeOptions = useMemo(() => {
        if (!activePlanChangeRequest || !activePlanChangeRequest.proposedPrice || !settings) return [];
        
        const basePrice = activePlanChangeRequest.proposedPrice;
        
        const options = [
            {
                id: 'monthly',
                title: 'Mensal (Sem Fidelidade)',
                price: basePrice,
                discountPercent: 0,
                fidelityPlan: undefined as FidelityPlan | undefined
            }
        ];
        
        settings.fidelityPlans.forEach(plan => {
            const discount = basePrice * (plan.discountPercent / 100);
            options.push({
                id: plan.id,
                title: `Fidelidade ${plan.months} Meses`,
                price: basePrice - discount,
                discountPercent: plan.discountPercent,
                fidelityPlan: plan
            });
        });
        
        return options;
    }, [activePlanChangeRequest, settings]);


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
    
    const handleRequestPlanChange = async () => {
        if (!clientData) return;
        setIsRequestingPlanChange(true);
        try {
            await requestPlanChange(clientData.uid!, clientData.name, clientData.plan, 'VIP');
            showNotification('Solicitação de upgrade enviada com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao solicitar mudança.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };
    
    const handleAcceptPlanChange = async () => {
        if (!activePlanChangeRequest || !activePlanChangeRequest.proposedPrice) return;
        
        const selectedOption = upgradeOptions.find(opt => opt.id === selectedUpgradeOptionId);
        if (!selectedOption) return;

        setIsRequestingPlanChange(true);
        try {
            await acceptPlanChange(activePlanChangeRequest.id, selectedOption.price, selectedOption.fidelityPlan);
            showNotification('Upgrade aceito! A mudança será aplicada no próximo ciclo.', 'success');
            setIsPlanUpgradeModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao aceitar mudança.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };

    const handleRejectPlanChange = async () => {
        if (!activePlanChangeRequest) return;
        setIsRequestingPlanChange(true);
        try {
            await cancelPlanChangeRequest(activePlanChangeRequest.id);
            showNotification('Solicitação cancelada.', 'info');
            setIsPlanUpgradeModalOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao cancelar.', 'error');
        } finally {
            setIsRequestingPlanChange(false);
        }
    };


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
                
                {/* Scheduled Change Notification */}
                {clientData.scheduledPlanChange && (
                    <div className="p-4 bg-green-100 border-l-4 border-green-500 text-green-800 rounded-md">
                        <p className="font-bold flex items-center"><CheckBadgeIcon className="w-5 h-5 mr-2" /> Mudança de Plano Agendada</p>
                        <p>Seu plano será atualizado para <strong>{clientData.scheduledPlanChange.newPlan}</strong> (R$ {clientData.scheduledPlanChange.newPrice.toFixed(2)}) automaticamente após a confirmação do pagamento atual.</p>
                    </div>
                )}

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
                
                {/* Plan Upgrade / Comparison Card - Only if Simple and VIP enabled */}
                {clientData.plan === 'Simples' && settings.features.vipPlanEnabled && !clientData.scheduledPlanChange && (
                    <Card className="border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10">
                        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 flex items-center">
                                    <SparklesIcon className="w-5 h-5 mr-2 text-yellow-600" />
                                    {settings.features.vipUpgradeTitle || "Descubra o Plano VIP"}
                                </h3>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    {settings.features.vipUpgradeDescription || "Tenha produtos inclusos, atendimento prioritário e descontos exclusivos."}
                                </p>
                                {activePlanChangeRequest && activePlanChangeRequest.status === 'pending' && (
                                    <p className="text-xs font-bold text-primary-600 mt-2">Sua solicitação está sob análise.</p>
                                )}
                                {activePlanChangeRequest && activePlanChangeRequest.status === 'quoted' && (
                                    <p className="text-xs font-bold text-green-600 mt-2">Você tem uma proposta respondida! Clique para ver.</p>
                                )}
                            </div>
                            <Button 
                                onClick={activePlanChangeRequest?.status === 'quoted' ? () => setIsPlanUpgradeModalOpen(true) : handleRequestPlanChange}
                                variant="secondary"
                                className="border-yellow-500 text-yellow-700 hover:bg-yellow-200"
                                isLoading={isRequestingPlanChange}
                                disabled={activePlanChangeRequest?.status === 'pending'}
                            >
                                {activePlanChangeRequest?.status === 'quoted' ? 'Ver Proposta' : 'Solicitar Orçamento VIP'}
                            </Button>
                        </CardContent>
                    </Card>
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
                                    {nextVisit.isRouteActive && (
                                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                                            <p className="text-green-600 dark:text-green-400 font-bold text-sm animate-pulse flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                                Equipe em rota!
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : <p className="text-gray-500 py-4 italic">Nenhuma visita agendada para esta semana.</p>}
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

            {/* Right Column: Plan Info & Stock */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* Plan Details Card */}
                {currentPlanDetails && (
                    <Card data-tour-id="plan-info">
                        <CardHeader data-tour-id="plan-info-header">
                            <div className="flex items-center gap-2">
                                <CheckBadgeIcon className="w-6 h-6 text-primary-500" />
                                <h3 className="text-xl font-semibold">Meu Plano Atual</h3>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <h4 className={`text-2xl font-bold mb-1 ${currentPlanDetails.planType === 'VIP' ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary-600 dark:text-primary-400'}`}>
                                {currentPlanDetails.title}
                            </h4>
                            {currentPlanDetails.fidelity && (
                                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">
                                    Fidelidade: {currentPlanDetails.fidelity.months} Meses ({currentPlanDetails.fidelity.discountPercent}% OFF)
                                </p>
                            )}
                            
                            <div className="space-y-2 mb-6">
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Benefícios Inclusos:</p>
                                <ul className="space-y-1">
                                    {currentPlanDetails.benefits.map((benefit: string, idx: number) => (
                                        <li key={idx} className="flex items-start text-sm">
                                            <CheckIcon className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                            <span>{benefit}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <Button 
                                variant="secondary" 
                                size="sm" 
                                className="w-full"
                                onClick={() => setIsTermsModalOpen(true)}
                            >
                                Ler Termos e Condições
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* My Products */}
                <Card data-tour-id="client-stock">
                    <CardHeader data-tour-id="client-stock-header"><h3 className="text-xl font-semibold">Meus Produtos</h3></CardHeader>
                    <CardContent className="space-y-3 max-h-[80vh] overflow-y-auto">
                        {clientData.stock.length > 0 ? clientData.stock.map(item => {
                            const max = item.maxQuantity || 5; // Default visual fallback
                            const percentage = Math.min(100, (item.quantity / max) * 100);
                            const lowStock = item.quantity <= (item.maxQuantity ? item.maxQuantity * 0.3 : (settings?.automation.replenishmentStockThreshold || 2));
                            
                            return (
                                <div key={item.productId} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-semibold">{item.name}</p>
                                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                            {item.quantity} / {max}
                                        </p>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                                        <div 
                                            className={`h-2.5 rounded-full ${lowStock ? 'bg-red-500' : 'bg-green-500'}`} 
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                    {lowStock && <p className="text-xs text-red-500 font-semibold mt-1">Estoque baixo</p>}
                                </div>
                            );
                        }) : <p>Nenhum produto em seu estoque.</p>}
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

            {isPlanUpgradeModalOpen && activePlanChangeRequest && (
                <Modal
                    isOpen={isPlanUpgradeModalOpen}
                    onClose={() => setIsPlanUpgradeModalOpen(false)}
                    title="Proposta de Upgrade VIP"
                    footer={
                        <>
                            <Button variant="danger" onClick={handleRejectPlanChange} isLoading={isRequestingPlanChange}>Recusar</Button>
                            <Button onClick={handleAcceptPlanChange} isLoading={isRequestingPlanChange}>Aceitar Upgrade</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p className="font-semibold text-lg text-center">Parabéns pela iniciativa!</p>
                        <p className="text-center text-gray-600 dark:text-gray-400">
                            Recebemos sua solicitação e preparamos opções especiais para você migrar para o Plano VIP.
                        </p>
                        
                        <div className="space-y-3 mt-4">
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Escolha seu plano de pagamento:</p>
                            {upgradeOptions.map(option => (
                                <div 
                                    key={option.id}
                                    onClick={() => setSelectedUpgradeOptionId(option.id)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all flex justify-between items-center ${selectedUpgradeOptionId === option.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}
                                >
                                    <div>
                                        <p className="font-bold">{option.title}</p>
                                        {option.discountPercent > 0 && (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full dark:bg-green-900 dark:text-green-200">
                                                {option.discountPercent}% OFF
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
                                            R$ {option.price.toFixed(2)}<span className="text-sm text-gray-500 font-normal">/mês</span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {activePlanChangeRequest.adminNotes && (
                            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 text-sm">
                                <p className="font-bold">Mensagem do Administrador:</p>
                                <p>{activePlanChangeRequest.adminNotes}</p>
                            </div>
                        )}

                        <p className="text-xs text-gray-500 text-center mt-4">
                            Ao aceitar, a mudança de plano será agendada e entrará em vigor automaticamente após o pagamento da sua próxima fatura atual.
                        </p>
                    </div>
                </Modal>
            )}

            {isTermsModalOpen && currentPlanDetails && (
                <Modal
                    isOpen={isTermsModalOpen}
                    onClose={() => setIsTermsModalOpen(false)}
                    title={`Termos de Serviço - ${currentPlanDetails.title}`}
                    size="lg"
                    footer={<Button onClick={() => setIsTermsModalOpen(false)}>Fechar</Button>}
                >
                    <div className="prose dark:prose-invert max-h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                            {currentPlanDetails.terms || "Termos não disponíveis no momento."}
                        </p>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// --- Mocked Sub-Components for Completeness ---

const PriceChangeNotificationCard = ({ notification, currentFee, client, settings }: any) => {
    // Mocking minimal calculation for demo. In real app use calculations.ts
    const newFee = currentFee; // Placeholder
    return (
        <div className="p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded-md">
            <h4 className="font-bold flex items-center"><CurrencyDollarIcon className="w-5 h-5 mr-2"/> Atualização de Preço</h4>
            <p>A partir de {toDate(notification.effectiveDate)?.toLocaleDateString()}, sua mensalidade será reajustada.</p>
        </div>
    );
};

const RecessNotificationCard = ({ recesses }: { recesses: RecessPeriod[] }) => (
    <div className="space-y-2">
        {recesses.map(r => (
            <div key={r.id} className="p-4 bg-orange-100 border-l-4 border-orange-500 text-orange-800 rounded-md">
                <h4 className="font-bold flex items-center"><CalendarDaysIcon className="w-5 h-5 mr-2"/> {r.name}</h4>
                <p>Estaremos de recesso entre {toDate(r.startDate)?.toLocaleDateString()} e {toDate(r.endDate)?.toLocaleDateString()}.</p>
            </div>
        ))}
    </div>
);

const ReplenishmentCard = ({ quote, client, updateStatus, createOrder, showNotification }: any) => {
    const [loading, setLoading] = useState(false);
    const handleApprove = async () => {
        setLoading(true);
        try {
            await createOrder({
                clientId: client.id,
                clientName: client.name,
                items: quote.items,
                total: quote.total,
                status: 'Pendente'
            });
            await updateStatus(quote.id, 'approved');
            showNotification("Pedido criado com sucesso!", "success");
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };
    return (
        <Card className="border-l-4 border-green-500">
            <CardHeader><h3 className="font-bold">Sugestão de Reposição de Produtos</h3></CardHeader>
            <CardContent>
                <p>Detectamos que alguns produtos estão acabando. Deseja repor?</p>
                <ul className="list-disc pl-5 my-2">
                    {quote.items.map((i: any) => <li key={i.id}>{i.name} (x{i.quantity}) - R$ {i.price}</li>)}
                </ul>
                <p className="font-bold">Total: R$ {quote.total.toFixed(2)}</p>
                <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handleApprove} isLoading={loading}>Aprovar e Pedir</Button>
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(quote.id, 'rejected')}>Dispensar</Button>
                </div>
            </CardContent>
        </Card>
    );
};

const RequestStatusCard = ({ request }: any) => (
    <Card className={request.status === 'rejected' ? 'border-red-500 border-l-4' : 'border-yellow-500 border-l-4'}>
        <CardContent>
            <h4 className="font-bold">Status da Solicitação de Adiantamento</h4>
            <p>Status: {request.status === 'pending' ? 'Em análise' : 'Rejeitado'}</p>
        </CardContent>
    </Card>
);

const EventSchedulerCard = ({ client, poolEvents, createPoolEvent, showNotification }: any) => {
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const clientEvents = useMemo(() => {
        // Filter and sort events for this client - CRITICAL FIX: Use client.uid for consistency with AppData listener
        return poolEvents.filter((e: any) => e.clientId === client.uid)
            .sort((a: any, b: any) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0));
    }, [poolEvents, client.uid]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createPoolEvent({ 
                clientId: client.uid, // Use UID to match AppData query
                clientName: client.name, 
                eventDate: new Date(date + 'T12:00:00'), 
                notes 
            });
            showNotification("Evento agendado!", "success");
            setDate(''); 
            setNotes('');
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader><h3 className="font-bold flex items-center"><CalendarDaysIcon className="w-5 h-5 mr-2"/> Agendar Uso da Piscina</h3></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-2">
                    <Input label="Data do Evento" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    <Input label="Observações" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Churrasco, preciso da piscina limpa de manhã" />
                    <Button type="submit" isLoading={loading} className="w-full">Agendar</Button>
                </form>

                {clientEvents.length > 0 && (
                    <div className="mt-6 pt-4 border-t dark:border-gray-700">
                        <h4 className="font-semibold text-sm mb-3 text-gray-700 dark:text-gray-300">Meus Agendamentos:</h4>
                        <div className="space-y-3">
                            {clientEvents.map((event: any) => {
                                const isConfirmed = event.status === 'acknowledged';
                                return (
                                    <div 
                                        key={event.id} 
                                        className={`p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm border-l-4 shadow-sm transition-all ${isConfirmed ? 'border-green-500' : 'border-yellow-400'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-gray-800 dark:text-gray-100">
                                                    {toDate(event.eventDate)?.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </p>
                                                {isConfirmed && <CheckBadgeIcon className="w-4 h-4 text-green-500" />}
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConfirmed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                {isConfirmed ? 'Confirmado' : 'Pendente'}
                                            </div>
                                        </div>
                                        {event.notes && <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 border-t dark:border-gray-700 pt-1">"{event.notes}"</p>}
                                        
                                        {isConfirmed ? (
                                            <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-green-50 dark:bg-green-900/10 rounded border border-green-100 dark:border-green-900/30">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                                <p className="text-[11px] text-green-700 dark:text-green-400 font-semibold uppercase">
                                                    Recebimento confirmado pela administração
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-2 flex items-center">
                                                <span className="mr-1">●</span> Aguardando visualização da administração
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const AdvancePaymentModal = ({ isOpen, onClose, client, settings, monthlyFee, onSubmit, showNotification }: any) => {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    
    const handleSubmit = async () => {
        if (selectedOption === null) return;
        const option = settings.advancePaymentOptions[selectedOption];
        const originalAmount = monthlyFee * option.months;
        const discountAmount = originalAmount * (option.discountPercent / 100);
        const finalAmount = originalAmount - discountAmount;
        
        setLoading(true);
        try {
            await onSubmit({
                clientId: client.uid,
                clientName: client.name,
                months: option.months,
                discountPercent: option.discountPercent,
                originalAmount,
                finalAmount
            });
            showNotification("Solicitação enviada!", "success");
            onClose();
        } catch (e: any) {
            showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Adiantamento de Mensalidades">
            <p className="mb-4">Selecione uma opção para pagar adiantado com desconto:</p>
            <div className="space-y-2">
                {settings.advancePaymentOptions.map((opt: any, idx: number) => (
                    <div 
                        key={idx} 
                        onClick={() => setSelectedOption(idx)}
                        className={`p-3 border rounded cursor-pointer ${selectedOption === idx ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}
                    >
                        <p className="font-bold">{opt.months} Meses - {opt.discountPercent}% OFF</p>
                        <p>Total: R$ {(monthlyFee * opt.months * (1 - opt.discountPercent/100)).toFixed(2)}</p>
                    </div>
                ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleSubmit} isLoading={loading} disabled={selectedOption === null}>Solicitar</Button>
            </div>
        </Modal>
    );
};

export default ClientDashboardView;