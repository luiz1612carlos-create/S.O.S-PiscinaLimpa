
import React, { useState, useMemo } from 'react';
import { AppContextType, BudgetQuote, Address, PlanChangeRequest } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { SparklesIcon, CheckBadgeIcon } from '../../constants';
import { calculateDrivingDistance, calculateClientMonthlyFee } from '../../utils/calculations';

interface ApprovalsViewProps {
    appContext: AppContextType;
}

const formatAddress = (address?: Address) => {
    if (!address) return 'N/A';
    return `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
};

const ApprovalsView: React.FC<ApprovalsViewProps> = ({ appContext }) => {
    const { budgetQuotes, loading, approveBudgetQuote, rejectBudgetQuote, showNotification, settings, planChangeRequests, respondToPlanChangeRequest, cancelPlanChangeRequest, clients } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [approvalBudget, setApprovalBudget] = useState<BudgetQuote | null>(null);
    const [password, setPassword] = useState('');
    const [distance, setDistance] = useState<number>(0);
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
    
    // Plan Change Response State
    const [selectedPlanRequest, setSelectedPlanRequest] = useState<PlanChangeRequest | null>(null);
    const [proposedPrice, setProposedPrice] = useState(0);
    const [adminNotes, setAdminNotes] = useState('');

    const handleApproveClick = (budgetId: string) => {
        const budget = budgetQuotes.find(b => b.id === budgetId);
        if (budget) {
            setApprovalBudget(budget);
            setPassword('');
            setDistance(budget.distanceFromHq || 0);
        }
    };

    const handleConfirmApprove = async () => {
        if (!approvalBudget) return;
        
        if (password.length < 6) {
            showNotification('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        setProcessingId(approvalBudget.id);
        try {
            await approveBudgetQuote(approvalBudget.id, password, distance);
            showNotification('Orçamento aprovado com sucesso!', 'success');
            setApprovalBudget(null);
            setPassword('');
            setDistance(0);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao aprovar orçamento.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (budgetId: string) => {
        setProcessingId(budgetId);
        try {
            await rejectBudgetQuote(budgetId);
            showNotification('Orçamento rejeitado.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao rejeitar orçamento.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectPlanRequest = async (requestId: string) => {
        if (!window.confirm("Tem certeza que deseja recusar este pedido de mudança de plano?")) return;
        setProcessingId(requestId);
        try {
            await cancelPlanChangeRequest(requestId);
            showNotification('Solicitação de mudança recusada.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao recusar.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleAutoCalculateDistance = async () => {
        if (!settings || !approvalBudget) {
            showNotification('Configurações ou dados do cliente incompletos.', 'error');
            return;
        }

        setIsCalculatingDistance(true);
        try {
            const origin = `${settings.baseAddress.street}, ${settings.baseAddress.number}, ${settings.baseAddress.city} - ${settings.baseAddress.state}`;
            const destination = `${approvalBudget.address.street}, ${approvalBudget.address.number}, ${approvalBudget.address.city} - ${approvalBudget.address.state}`;

            const km = await calculateDrivingDistance(origin, destination);

            if (km >= 0) {
                setDistance(km);
                showNotification(`Distância calculada: ${km} km`, 'success');
            } else {
                throw new Error("Erro ao calcular distância.");
            }

        } catch (error: any) {
            console.error(error);
            showNotification("Erro ao calcular distância automaticamente. Tente inserir manualmente.", 'error');
        } finally {
            setIsCalculatingDistance(false);
        }
    };
    
    const handleOpenPlanResponse = (request: PlanChangeRequest) => {
        setSelectedPlanRequest(request);
        
        // Auto-calculate price based on client's current data and system settings
        const client = clients.find(c => c.uid === request.clientId);
        let calculatedPrice = 0;
        
        if (client && settings) {
            const tempClient = { ...client, plan: 'VIP' as const, fidelityPlan: undefined };
            calculatedPrice = calculateClientMonthlyFee(tempClient, settings);
        }

        setProposedPrice(calculatedPrice);
        setAdminNotes('Olá! Analisamos seu perfil e liberamos as opções do Plano VIP para você. Escolha a melhor opção de fidelidade abaixo!');
    };

    const handleSendPlanQuote = async () => {
        if (!selectedPlanRequest) return;
        if (proposedPrice <= 0) {
            showNotification('Por favor, informe um valor mensal válido.', 'error');
            return;
        }
        
        setProcessingId(selectedPlanRequest.id);
        try {
            await respondToPlanChangeRequest(selectedPlanRequest.id, proposedPrice, adminNotes);
            showNotification('Opções de orçamento enviadas ao cliente!', 'success');
            setSelectedPlanRequest(null);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao enviar.', 'error');
        } finally {
            setProcessingId(null);
        }
    };
    
    // Calculate simulated options based on the entered base price
    const simulatedOptions = useMemo(() => {
        if (!settings || proposedPrice <= 0) return [];
        
        const options = [
            {
                label: 'Mensal (Sem Fidelidade)',
                price: proposedPrice,
                discount: 0
            }
        ];

        settings.fidelityPlans.forEach(plan => {
            const discountAmount = proposedPrice * (plan.discountPercent / 100);
            options.push({
                label: `Fidelidade ${plan.months} Meses`,
                price: proposedPrice - discountAmount,
                discount: plan.discountPercent
            });
        });

        return options;
    }, [proposedPrice, settings]);
    
    const pendingBudgets = budgetQuotes.filter(b => b.status === 'pending');
    const pendingPlanRequests = planChangeRequests.filter(r => r.status === 'pending');

    return (
        <div className="space-y-8">
            {/* New Clients */}
            <div>
                <h2 className="text-3xl font-bold mb-6">Novos Clientes (Orçamentos)</h2>
                {loading.budgetQuotes ? (
                    <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
                ) : pendingBudgets.length === 0 ? (
                    <p className="text-gray-500">Nenhum orçamento de novo cliente pendente.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingBudgets.map(budget => (
                            <Card key={budget.id}>
                               <NewClientBudgetCard budget={budget} processingId={processingId} onApprove={handleApproveClick} onReject={handleReject} />
                            </Card>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Plan Changes */}
            <div>
                <h2 className="text-3xl font-bold mb-6">Solicitações de Mudança de Plano</h2>
                {loading.planChangeRequests ? (
                    <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
                ) : pendingPlanRequests.length === 0 ? (
                    <p className="text-gray-500">Nenhuma solicitação de mudança pendente.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingPlanRequests.map(request => (
                            <Card key={request.id} className="border-l-4 border-yellow-500">
                                <CardHeader>
                                    <h3 className="text-xl font-semibold">{request.clientName}</h3>
                                    <p className="text-sm font-bold text-yellow-600">Solicita Upgrade de Plano</p>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-gray-500">Atual: <span className="font-bold text-gray-700 dark:text-gray-300">{request.currentPlan}</span></div>
                                        <div className="text-xl">→</div>
                                        <div className="text-primary-600 font-bold">Desejado: {request.requestedPlan}</div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">Solicitado em: {new Date(request.createdAt?.seconds * 1000).toLocaleDateString()}</p>
                                </CardContent>
                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center gap-2">
                                    <Button variant="danger" size="sm" className="flex-1" onClick={() => handleRejectPlanRequest(request.id)} isLoading={processingId === request.id} disabled={!!processingId}>
                                        Recusar
                                    </Button>
                                    <Button size="sm" className="flex-1" onClick={() => handleOpenPlanResponse(request)} isLoading={processingId === request.id} disabled={!!processingId}>
                                        Responder
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Approve New Client Modal */}
            {approvalBudget && (
                <Modal
                    isOpen={!!approvalBudget}
                    onClose={() => setApprovalBudget(null)}
                    title={`Aprovar Orçamento: ${approvalBudget.name}`}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setApprovalBudget(null)}>Cancelar</Button>
                            <Button onClick={handleConfirmApprove} isLoading={processingId === approvalBudget.id}>Confirmar</Button>
                        </>
                    }
                >
                     <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        Configure os detalhes finais para o acesso do cliente.
                    </p>
                    <div className="flex items-end gap-2 mb-4">
                        <Input
                            label="Distância da Base (Km)"
                            type="number"
                            value={distance}
                            onChange={(e) => setDistance(parseFloat(e.target.value) || 0)}
                            placeholder="Ex: 5.5"
                            containerClassName="!mb-0 flex-grow"
                        />
                        <Button 
                            type="button" 
                            onClick={handleAutoCalculateDistance} 
                            isLoading={isCalculatingDistance}
                            variant="secondary"
                            title="Calcular distância com Mapa"
                        >
                            <SparklesIcon className="w-5 h-5 text-purple-600" />
                        </Button>
                    </div>
                    <Input
                        label="Senha Inicial"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                    />
                </Modal>
            )}
            
            {/* Respond Plan Change Modal */}
            {selectedPlanRequest && (
                <Modal
                    isOpen={!!selectedPlanRequest}
                    onClose={() => setSelectedPlanRequest(null)}
                    title={`Opções VIP para ${selectedPlanRequest.clientName}`}
                    size="lg"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setSelectedPlanRequest(null)}>Cancelar</Button>
                            <Button onClick={handleSendPlanQuote} isLoading={!!processingId}>Enviar Opções ao Cliente</Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Defina o <strong>Valor Base Mensal (VIP)</strong>. O sistema calculará e apresentará automaticamente as opções com desconto de fidelidade para o cliente escolher.
                        </p>
                        
                        <div className="flex items-end gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                            <Input
                                label="Valor Base Mensal (R$)"
                                type="number"
                                value={proposedPrice}
                                onChange={(e) => setProposedPrice(parseFloat(e.target.value))}
                                placeholder="0.00"
                                containerClassName="!mb-0 flex-grow"
                            />
                            <Button 
                                type="button" 
                                onClick={() => {
                                    const client = clients.find(c => c.uid === selectedPlanRequest.clientId);
                                    if (client && settings) {
                                        const tempClient = { ...client, plan: 'VIP' as const, fidelityPlan: undefined };
                                        setProposedPrice(calculateClientMonthlyFee(tempClient, settings));
                                        showNotification('Preço recalculado conforme tabela vigente.', 'info');
                                    }
                                }}
                                variant="secondary"
                                title="Recalcular com base nas medidas e tabela atual"
                                className="px-3"
                            >
                                <SparklesIcon className="w-5 h-5 text-yellow-600" />
                            </Button>
                        </div>

                        {/* Simulation Table */}
                        {simulatedOptions.length > 0 && (
                            <div className="mt-4">
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Simulação do que o Cliente verá:</h4>
                                <div className="border rounded-md overflow-hidden dark:border-gray-600">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-4 py-2 text-left">Opção</th>
                                                <th className="px-4 py-2 text-center">Desconto</th>
                                                <th className="px-4 py-2 text-right">Valor Final</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                            {simulatedOptions.map((opt, idx) => (
                                                <tr key={idx} className="bg-white dark:bg-gray-800">
                                                    <td className="px-4 py-2 font-medium">{opt.label}</td>
                                                    <td className="px-4 py-2 text-center">
                                                        {opt.discount > 0 ? (
                                                            <span className="text-green-600 font-bold">-{opt.discount}%</span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-bold text-primary-600 dark:text-primary-400">
                                                        R$ {opt.price.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        <textarea
                            className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={3}
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            placeholder="Adicione uma nota para o cliente (opcional)..."
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};

const NewClientBudgetCard = ({ budget, processingId, onApprove, onReject }: { budget: BudgetQuote, processingId: string | null, onApprove: (id: string) => void, onReject: (id: string) => void }) => (
    <>
        <CardHeader>
            <h3 className="text-xl font-semibold">{budget.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{budget.email}</p>
        </CardHeader>
        <CardContent className="space-y-3">
            <p><strong>Telefone:</strong> {budget.phone}</p>
            <p><strong>Endereço:</strong> {formatAddress(budget.address)}</p>
            
            <div className="pt-2 mt-2 border-t dark:border-gray-600 space-y-1 text-sm">
                 <p><strong>Dimensões:</strong> {budget.poolDimensions.width}m x {budget.poolDimensions.length}m x {budget.poolDimensions.depth}m</p>
                <p><strong>Volume:</strong> {budget.poolVolume?.toLocaleString('pt-BR')} L</p>
                <p><strong>Água de Poço:</strong> {budget.hasWellWater ? 'Sim' : 'Não'}</p>
                <p><strong>Piscina de Festa:</strong> {budget.isPartyPool ? 'Sim' : 'Não'}</p>
            </div>
            
            <p><strong>Plano:</strong> 
                <span className={`font-bold ${budget.plan === 'VIP' ? 'text-yellow-500' : 'text-blue-500'}`}>
                    {budget.plan}
                    {budget.fidelityPlan && ` - Fidelidade ${budget.fidelityPlan.months} Meses`}
                </span>
            </p>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 text-center">
                R$ {budget.monthlyFee.toFixed(2).replace('.', ',')} / mês
            </p>
        </CardContent>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
            <Button size="sm" variant="danger" onClick={() => onReject(budget.id)} isLoading={processingId === budget.id} disabled={!!processingId}>Recusar</Button>
            <Button size="sm" onClick={() => onApprove(budget.id)} isLoading={processingId === budget.id} disabled={!!processingId}>Aprovar</Button>
        </div>
    </>
);

export default ApprovalsView;
