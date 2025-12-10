import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AppContextType, PlanType, Settings, FidelityPlan, BudgetQuote } from '../../types';
import { Spinner } from '../../components/Spinner';
import { normalizeDimension } from '../../utils/calculations';
import BudgetSuccessView from './BudgetSuccessView';
import { Modal } from '../../components/Modal';
import { GuidedTour, TourStep } from '../../components/GuidedTour';
import { QuestionMarkCircleIcon } from '../../constants';

interface PreBudgetViewProps {
    appContext: AppContextType;
}

const preBudgetTourSteps: TourStep[] = [
    {
        selector: '[data-tour-id="form-title"]',
        position: 'bottom',
        title: 'Bem-vindo ao Tour!',
        content: 'Vamos mostrar como é fácil e rápido calcular um orçamento para a limpeza da sua piscina.',
    },
    {
        selector: '[data-tour-id="dimensions"] legend',
        highlightSelector: '[data-tour-id="dimensions"]',
        position: 'bottom',
        title: '1. Dimensões da Piscina',
        content: 'Comece inserindo as medidas da sua piscina em metros. Use vírgula ou ponto para casas decimais (ex: 1,4 ou 1.4). O volume será calculado automaticamente.',
    },
    {
        selector: '[data-tour-id="options"] legend',
        highlightSelector: '[data-tour-id="options"]',
        position: 'bottom',
        title: '2. Opções Adicionais',
        content: 'Marque estas opções se sua piscina usa água de poço ou é usada para festas/eventos, pois isso pode influenciar no tratamento e no valor.',
    },
    {
        selector: '[data-tour-id="plans"] h3',
        highlightSelector: '[data-tour-id="plans"]',
        position: 'bottom',
        title: '3. Selecione um Plano',
        content: 'Escolha o plano que melhor se adapta às suas necessidades. O Plano VIP oferece descontos progressivos para contratos de maior duração.',
    },
    {
        selector: '[data-tour-id="personal-data"] legend',
        highlightSelector: '[data-tour-id="personal-data"]',
        position: 'top',
        title: '4. Seus Dados',
        content: 'Preencha seus dados de contato. O e-mail que você informar aqui será usado para seu futuro acesso ao painel do cliente.',
    },
    {
        selector: '[data-tour-id="final-value"]',
        position: 'top',
        title: 'Valor Final e Envio',
        content: 'Após preencher tudo, o valor mensal estimado aparecerá aqui. Se estiver de acordo, clique no botão para enviar sua solicitação para nossa análise.',
    },
];


const PreBudgetView: React.FC<PreBudgetViewProps> = ({ appContext }) => {
    const { settings, loading, createBudgetQuote, showNotification } = appContext;
    const [showSuccessPage, setShowSuccessPage] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        zip: '',
        width: '',
        length: '',
        depth: '',
    });
    const [options, setOptions] = useState({
        hasWellWater: false,
        isPartyPool: false,
    });
    const [selectedPlanIdentifier, setSelectedPlanIdentifier] = useState('simples'); // 'simples' or fidelity plan ID

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [hasAgreedToTerms, setHasAgreedToTerms] = useState(false);
    const [isTourOpen, setIsTourOpen] = useState(false);

    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenBudgetTour');
        if (!hasSeenTour) {
            setIsTourOpen(true);
        }
    }, []);

    const handleCloseTour = () => {
        localStorage.setItem('hasSeenBudgetTour', 'true');
        setIsTourOpen(false);
    };

    const selectedPlanType: PlanType = selectedPlanIdentifier === 'simples' ? 'Simples' : 'VIP';
    const selectedFidelityPlan = useMemo(() => {
        if (selectedPlanType === 'VIP' && settings) {
            return settings.fidelityPlans.find(fp => fp.id === selectedPlanIdentifier);
        }
        return undefined;
    }, [selectedPlanIdentifier, selectedPlanType, settings]);


    const isFormComplete = useMemo(() => {
        const requiredFields: (keyof typeof formData)[] = [
            'name', 'email', 'phone', 
            'street', 'number', 'neighborhood', 'city', 'state', 'zip',
            'width', 'length', 'depth'
        ];
        return requiredFields.every(field => formData[field] && formData[field].trim() !== '');
    }, [formData]);

    const volume = useMemo(() => {
        const { width, length, depth } = formData;
        
        const w = normalizeDimension(width);
        const l = normalizeDimension(length);
        const d = normalizeDimension(depth);

        if (w > 0 && l > 0 && d > 0) {
            return w * l * d * 1000;
        }
        return 0;
    }, [formData.width, formData.length, formData.depth]);

    const monthlyFee = useMemo(() => {
        if (!settings || volume <= 0) return 0;

        const { pricing } = settings;
        let basePrice = pricing.volumeTiers.find(tier => volume <= tier.upTo)?.price || pricing.volumeTiers[pricing.volumeTiers.length - 1].price;
        
        if (options.hasWellWater) basePrice += pricing.wellWaterFee;
        if (options.isPartyPool) basePrice += pricing.partyPoolFee;
        
        if (selectedPlanType === 'VIP' && selectedFidelityPlan && settings.features.vipPlanEnabled) {
            basePrice = basePrice * (1 - selectedFidelityPlan.discountPercent / 100);
        }

        return basePrice;
    }, [volume, options, selectedPlanType, selectedFidelityPlan, settings]);

    useEffect(() => {
        // If VIP plans are disabled and a VIP plan is selected, revert to simple
        if (settings && !settings.features.vipPlanEnabled && selectedPlanType === 'VIP') {
            setSelectedPlanIdentifier('simples');
        }
    }, [settings?.features.vipPlanEnabled, selectedPlanType]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'zip') {
            const formattedCep = value
                .replace(/\D/g, '')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .slice(0, 9);
            setFormData({ ...formData, zip: formattedCep });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOptions({ ...options, [e.target.name]: e.target.checked });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!isFormComplete) {
            showNotification("Por favor, preencha todos os campos.", "error");
            return;
        }
        if(!monthlyFee || monthlyFee <= 0) {
            showNotification("Por favor, preencha as dimensões da piscina corretamente.", "error");
            return;
        }
        setIsTermsModalOpen(true);
    };
    
    const handleFinalSubmit = async () => {
        setIsSubmitting(true);
        try {
            const budgetData: Omit<BudgetQuote, 'id' | 'status' | 'createdAt'> = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                address: {
                    street: formData.street,
                    number: formData.number,
                    neighborhood: formData.neighborhood,
                    city: formData.city,
                    state: formData.state,
                    zip: formData.zip,
                },
                poolDimensions: {
                    width: normalizeDimension(formData.width),
                    length: normalizeDimension(formData.length),
                    depth: normalizeDimension(formData.depth),
                },
                poolVolume: volume,
                hasWellWater: options.hasWellWater,
                isPartyPool: options.isPartyPool,
                plan: selectedPlanType,
                monthlyFee: monthlyFee,
            };

            if (selectedPlanType === 'VIP' && selectedFidelityPlan) {
                budgetData.fidelityPlan = selectedFidelityPlan;
            }

            await createBudgetQuote(budgetData);
            
            setShowSuccessPage(true);
            
            setFormData({ name: '', email: '', phone: '', street: '', number: '', neighborhood: '', city: '', state: '', zip: '', width: '', length: '', depth: '' });
            setOptions({ hasWellWater: false, isPartyPool: false });
        } catch (error: any) {
            showNotification(error.message || "Falha ao enviar orçamento.", 'error');
        } finally {
            setIsSubmitting(false);
            setIsTermsModalOpen(false);
            setHasAgreedToTerms(false);
        }
    };
    
    if (loading.settings) {
        return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    }

    if (!settings) {
        return <div className="text-center p-8 text-red-500">Não foi possível carregar as configurações. Tente novamente mais tarde.</div>;
    }

    if (showSuccessPage) {
        return <BudgetSuccessView onGoBack={() => setShowSuccessPage(false)} />;
    }

    return (
        <div data-tour-id="welcome">
            <GuidedTour steps={preBudgetTourSteps} isOpen={isTourOpen} onClose={handleCloseTour} />
            <div className="flex justify-between items-center mb-6">
                 <h2 data-tour-id="form-title" className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200">Calculadora de Orçamento</h2>
                 <button
                    onClick={() => setIsTourOpen(true)}
                    className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    aria-label="Fazer tour guiado"
                    title="Fazer tour guiado"
                >
                    <QuestionMarkCircleIcon className="w-6 h-6" />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                <fieldset data-tour-id="dimensions" className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">1. Dimensões da Piscina (metros)</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                        <Input label="Largura" name="width" type="text" inputMode="decimal" value={formData.width} onChange={handleInputChange} required placeholder="ex: 4 ou 4,5" />
                        <Input label="Comprimento" name="length" type="text" inputMode="decimal" value={formData.length} onChange={handleInputChange} required placeholder="ex: 8" />
                        <Input label="Profundidade Média" name="depth" type="text" inputMode="decimal" value={formData.depth} onChange={handleInputChange} required placeholder="ex: 1.4 ou 1,4" />
                    </div>
                     {volume > 0 && <p className="text-center mt-2 text-lg font-medium text-secondary-600 dark:text-secondary-400">Volume: {volume.toLocaleString('pt-BR')} litros</p>}
                </fieldset>

                <fieldset data-tour-id="options" className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">2. Opções Adicionais</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2 items-center">
                        <div className="space-y-2">
                            <label className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    name="hasWellWater" 
                                    checked={options.hasWellWater} 
                                    onChange={handleCheckboxChange} 
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                Água de poço
                            </label>
                            <label className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    name="isPartyPool" 
                                    checked={options.isPartyPool} 
                                    onChange={handleCheckboxChange} 
                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                Piscina para eventos/festa?
                            </label>
                        </div>
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-3 rounded-r-lg">
                            <p className="font-bold text-sm">Atenção:</p>
                            <p className="text-sm">Não trabalhamos com piscinas das marcas e modelos IGUI/SPLASH.</p>
                        </div>
                    </div>
                </fieldset>
                
                 <div data-tour-id="plans">
                    <h3 className="text-lg font-semibold text-center mb-4">3. Selecione um Plano</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PlanCard 
                            title={settings.plans.simple.title}
                            benefits={settings.plans.simple.benefits}
                            isSelected={selectedPlanIdentifier === 'simples'} 
                            onSelect={() => setSelectedPlanIdentifier('simples')} 
                        />
                        {!settings.features.vipPlanEnabled && (
                             <div className="p-6 border-2 rounded-lg transition-all duration-300 relative bg-gray-200 dark:bg-gray-700 opacity-60 cursor-not-allowed">
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-500/50 rounded-lg">
                                    <span className="px-3 py-1 bg-gray-800 text-white text-sm font-bold rounded-full">{settings.features.vipPlanDisabledMessage}</span>
                                </div>
                                <h4 className="text-xl font-bold text-center">{settings.plans.vip.title}</h4>
                                <ul className="mt-4 space-y-2 list-disc list-inside text-gray-600 dark:text-gray-300">
                                    {settings.plans.vip.benefits.map((benefit, i) => <li key={i}>{benefit}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                    {settings.features.vipPlanEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {settings.fidelityPlans.map(plan => (
                                <PlanCard
                                    key={plan.id}
                                    title={`${settings.plans.vip.title} ${plan.months} Meses`}
                                    benefits={[`${plan.discountPercent}% de Desconto`, ...settings.plans.vip.benefits]}
                                    isSelected={selectedPlanIdentifier === plan.id}
                                    onSelect={() => setSelectedPlanIdentifier(plan.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center pt-6 border-t dark:border-gray-700">
                    <h3 className="text-xl font-semibold">Preencha seus dados para ver o valor</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">O valor será revelado após o preenchimento completo.</p>
                </div>

                <fieldset data-tour-id="personal-data" className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">4. Seus Dados</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                        <Input label="Nome Completo" name="name" value={formData.name} onChange={handleInputChange} required />
                        <Input label="Email (para futuro login)" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                        <Input label="Telefone" name="phone" value={formData.phone} onChange={handleInputChange} required />
                    </div>
                </fieldset>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">5. Endereço</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mt-2">
                        <Input
                            containerClassName="sm:col-span-2"
                            label="CEP"
                            name="zip"
                            value={formData.zip}
                            onChange={handleInputChange}
                            required
                            placeholder="00000-000"
                            pattern="[0-9]{5}-[0-9]{3}"
                            title="Formato do CEP: 12345-678"
                            maxLength={9}
                        />
                        <Input containerClassName="sm:col-span-4" label="Rua" name="street" value={formData.street} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-2" label="Número" name="number" value={formData.number} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-4" label="Bairro" name="neighborhood" value={formData.neighborhood} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-4" label="Cidade" name="city" value={formData.city} onChange={handleInputChange} required />
                        <Input containerClassName="sm:col-span-2" label="UF" name="state" value={formData.state} onChange={handleInputChange} required maxLength={2} />
                    </div>
                </fieldset>
                
                {isFormComplete && (
                    <div data-tour-id="final-value" className="text-center p-4 bg-primary-50 dark:bg-primary-900/50 rounded-lg">
                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Valor Mensal Estimado:</p>
                        <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">R$ {monthlyFee.toFixed(2).replace('.', ',')}</p>
                    </div>
                )}

                <Button 
                    type="submit" 
                    isLoading={isSubmitting} 
                    className="w-full" 
                    size="lg"
                    disabled={!isFormComplete || isSubmitting}
                >
                    Enviar Orçamento para Análise
                </Button>
            </form>
            
            {isTermsModalOpen && settings && (
                <Modal
                    isOpen={isTermsModalOpen}
                    onClose={() => setIsTermsModalOpen(false)}
                    title={`Termos do Serviço - ${selectedPlanType === 'Simples' ? settings.plans.simple.title : settings.plans.vip.title}`}
                    size="lg"
                    footer={
                        <div className="flex justify-between w-full items-center">
                             <Button variant="secondary" onClick={() => setIsTermsModalOpen(false)}>Cancelar</Button>
                             <Button
                                onClick={handleFinalSubmit}
                                isLoading={isSubmitting}
                                disabled={!hasAgreedToTerms || isSubmitting}
                            >
                                Finalizar e Enviar
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="prose dark:prose-invert max-h-64 overflow-y-auto p-2 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                            {/* Using whitespace-pre-wrap to respect line breaks from the textarea */}
                            <p className="whitespace-pre-wrap text-sm">{selectedPlanType === 'Simples' ? settings.plans.simple.terms : settings.plans.vip.terms}</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={hasAgreedToTerms}
                                onChange={(e) => setHasAgreedToTerms(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Li e aceito os termos de serviço.
                        </label>
                    </div>
                </Modal>
            )}
        </div>
    );
};

interface PlanCardProps {
    title: string;
    benefits: string[];
    isSelected: boolean;
    onSelect: () => void;
    disabled?: boolean;
    disabledMessage?: string;
}

const PlanCard: React.FC<PlanCardProps> = ({ title, benefits, isSelected, onSelect, disabled = false }) => {
    const handleClick = () => {
        if (!disabled) {
            onSelect();
        }
    };
    
    const baseClasses = "p-6 border-2 rounded-lg transition-all duration-300 relative";
    const selectedClasses = 'border-primary-500 bg-primary-50 dark:bg-primary-900/20';
    const unselectedClasses = 'border-gray-300 dark:border-gray-600';
    const enabledClasses = 'cursor-pointer hover:border-primary-400';
    const disabledClasses = 'bg-gray-200 dark:bg-gray-700 opacity-60 cursor-not-allowed';

    return (
        <div 
            onClick={handleClick} 
            className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses} ${disabled ? disabledClasses : enabledClasses}`}
        >
            <h4 className="text-xl font-bold text-center">{title}</h4>
            <ul className="mt-4 space-y-2 list-disc list-inside text-gray-600 dark:text-gray-300">
                {benefits.map((benefit, i) => <li key={i}>{benefit}</li>)}
            </ul>
        </div>
    )
}


export default PreBudgetView;