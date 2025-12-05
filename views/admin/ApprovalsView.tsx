
import React, { useState } from 'react';
import { AppContextType, BudgetQuote, Address } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';

interface ApprovalsViewProps {
    appContext: AppContextType;
}

const formatAddress = (address?: Address) => {
    if (!address) return 'N/A';
    return `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city} - ${address.state}, ${address.zip}`;
};

const ApprovalsView: React.FC<ApprovalsViewProps> = ({ appContext }) => {
    const { budgetQuotes, loading, approveBudgetQuote, rejectBudgetQuote, showNotification } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [approvalBudget, setApprovalBudget] = useState<BudgetQuote | null>(null);
    const [password, setPassword] = useState('');

    const handleApproveClick = (budgetId: string) => {
        const budget = budgetQuotes.find(b => b.id === budgetId);
        if (budget) {
            setApprovalBudget(budget);
            setPassword('');
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
            await approveBudgetQuote(approvalBudget.id, password);
            showNotification('Orçamento aprovado com sucesso!', 'success');
            setApprovalBudget(null);
            setPassword('');
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
    
    const pendingBudgets = budgetQuotes.filter(b => b.status === 'pending');

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Análise de Novos Orçamentos</h2>
            {loading.budgetQuotes ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : pendingBudgets.length === 0 ? (
                <p>Nenhum orçamento pendente no momento.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingBudgets.map(budget => (
                        <Card key={budget.id}>
                           <NewClientBudgetCard budget={budget} processingId={processingId} onApprove={handleApproveClick} onReject={handleReject} />
                        </Card>
                    ))}
                </div>
            )}

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
                        Defina uma senha inicial para o acesso do cliente ao painel.
                    </p>
                    <Input
                        label="Senha Inicial"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                    />
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
