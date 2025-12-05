import React from 'react';
import { Button } from '../../components/Button';
import { CheckBadgeIcon } from '../../constants';

interface BudgetSuccessViewProps {
    onGoBack: () => void;
}

const BudgetSuccessView: React.FC<BudgetSuccessViewProps> = ({ onGoBack }) => {
    return (
        <div className="text-center p-8 flex flex-col items-center">
            <CheckBadgeIcon className="w-20 h-20 text-green-500 mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">Solicitação Recebida!</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto mb-1">
                Obrigado! Recebemos sua solicitação de orçamento.
            </p>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
                 Nossa equipe analisará os dados e entrará em contato em até 24 horas úteis pelo telefone ou e-mail informado para confirmar os detalhes.
            </p>
            <Button onClick={onGoBack} className="mt-8" size="lg">
                Calcular Novo Orçamento
            </Button>
        </div>
    );
};

export default BudgetSuccessView;
