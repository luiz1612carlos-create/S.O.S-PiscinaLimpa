import React, { useState } from 'react';
import { AppContextType, AdvancePaymentRequest } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';

interface AdvancePaymentsViewProps {
    appContext: AppContextType;
}

const AdvancePaymentsView: React.FC<AdvancePaymentsViewProps> = ({ appContext }) => {
    const { advancePaymentRequests, loading, approveAdvancePaymentRequest, rejectAdvancePaymentRequest, showNotification } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleApprove = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await approveAdvancePaymentRequest(requestId);
            showNotification('Pagamento adiantado confirmado com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao confirmar pagamento.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await rejectAdvancePaymentRequest(requestId);
            showNotification('Solicitação de adiantamento rejeitada.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao rejeitar solicitação.', 'error');
        } finally {
            setProcessingId(null);
        }
    };
    
    const pendingRequests = advancePaymentRequests.filter(r => r.status === 'pending');

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Solicitações de Pagamento Adiantado</h2>
            {loading.advancePaymentRequests ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : pendingRequests.length === 0 ? (
                <p>Nenhuma solicitação de adiantamento pendente no momento.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingRequests.map(request => (
                        <Card key={request.id}>
                           <CardHeader>
                               <h3 className="text-xl font-semibold">{request.clientName}</h3>
                               <p className="text-sm text-gray-500">Solicitação de Adiantamento</p>
                           </CardHeader>
                           <CardContent className="space-y-3">
                               <p><strong>Plano:</strong> {request.months} meses com {request.discountPercent}% de desconto</p>
                               
                               <div className="text-sm space-y-1 mt-2 pt-2 border-t dark:border-gray-600">
                                   <div className="flex justify-between">
                                       <span>Valor Original ({request.months} meses):</span>
                                       <span>R$ {request.originalAmount.toFixed(2)}</span>
                                   </div>
                                    <div className="flex justify-between text-green-600 dark:text-green-400">
                                       <span>Desconto ({request.discountPercent}%):</span>
                                       <span>- R$ {(request.originalAmount - request.finalAmount).toFixed(2)}</span>
                                   </div>
                               </div>

                               <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 text-center pt-2 border-t dark:border-gray-600">
                                   Valor Total: R$ {request.finalAmount.toFixed(2)}
                               </p>
                           </CardContent>
                           <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                               <Button size="sm" variant="danger" onClick={() => handleReject(request.id)} isLoading={processingId === request.id} disabled={!!processingId}>Rejeitar</Button>
                               <Button size="sm" onClick={() => handleApprove(request.id)} isLoading={processingId === request.id} disabled={!!processingId}>Confirmar Pagamento</Button>
                           </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdvancePaymentsView;