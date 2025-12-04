import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AppContextType, PlanType, Settings } from '../../types';
import { Spinner } from '../../components/Spinner';
import { normalizeDimension } from '../../utils/calculations';
import BudgetSuccessView from './BudgetSuccessView';

interface PreBudgetViewProps {
    appContext: AppContextType;
}

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
        includeProducts: false,
    });
    const [selectedPlan, setSelectedPlan] = useState<PlanType>('Simples');
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (options.includeProducts) basePrice += pricing.productsFee;

        if (selectedPlan === 'VIP' && settings.features.vipPlanEnabled) {
            basePrice = basePrice * (1 - pricing.vipDiscountPercent / 100);
        }

        return basePrice;
    }, [volume, options, selectedPlan, settings]);

    useEffect(() => {
        if (selectedPlan === 'VIP' && settings && !settings.features.vipPlanEnabled) {
            setSelectedPlan('Simples');
        }
    }, [selectedPlan, settings]);
    
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!isFormComplete) {
            showNotification("Por favor, preencha todos os campos.", "error");
            return;
        }
        if(!monthlyFee || monthlyFee <= 0) {
            showNotification("Por favor, preencha as dimensões da piscina corretamente.", "error");
            return;
        }
        setIsSubmitting(true);
        try {
            await createBudgetQuote({
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
                includeProducts: options.includeProducts,
                plan: selectedPlan,
                monthlyFee: monthlyFee,
            });
            
            setShowSuccessPage(true); // Show success page instead of notification
            
            setFormData({ name: '', email: '', phone: '', street: '', number: '', neighborhood: '', city: '', state: '', zip: '', width: '', length: '', depth: '' });
            setOptions({ hasWellWater: false, includeProducts: false });
        } catch (error: any) {
            showNotification(error.message || "Falha ao enviar orçamento.", 'error');
        } finally {
            setIsSubmitting(false);
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
        <div>
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-200">Calculadora de Orçamento</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">1. Dimensões da Piscina (metros)</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                        <Input label="Largura" name="width" type="text" value={formData.width} onChange={handleInputChange} required placeholder="ex: 4 ou 4,5" />
                        <Input label="Comprimento" name="length" type="text" value={formData.length} onChange={handleInputChange} required placeholder="ex: 8" />
                        <Input label="Profundidade Média" name="depth" type="text" value={formData.depth} onChange={handleInputChange} required placeholder="ex: 1.4 ou 1,4" />
                    </div>
                     {volume > 0 && <p className="text-center mt-2 text-lg font-medium text-secondary-600 dark:text-secondary-400">Volume: {volume.toLocaleString('pt-BR')} litros</p>}
                </fieldset>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold text-gray-700 dark:text-gray-300">2. Opções Adicionais</legend>
                    <div className="space-y-2 mt-2">
                        <label className="flex items-center gap-3"><input type="checkbox" name="hasWellWater" checked={options.hasWellWater} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>Água de poço</label>
                        <label className="flex items-center gap-3"><input type="checkbox" name="includeProducts" checked={options.includeProducts} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"/>Incluir produtos</label>
                    </div>
                </fieldset>
                
                 <div>
                    <h3 className="text-lg font-semibold text-center mb-4">3. Selecione um Plano</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <PlanCard 
                            plan={settings.plans.simple} 
                            planType="Simples" 
                            selectedPlan={selectedPlan} 
                            onSelect={setSelectedPlan} 
                        />
                        <PlanCard 
                            plan={settings.plans.vip} 
                            planType="VIP" 
                            selectedPlan={selectedPlan} 
                            onSelect={setSelectedPlan}
                            disabled={!settings.features.vipPlanEnabled}
                            disabledMessage={settings.features.vipPlanDisabledMessage}
                        />
                    </div>
                </div>

                <div className="text-center pt-6 border-t dark:border-gray-700">
                    <h3 className="text-xl font-semibold">Preencha seus dados para ver o valor</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">O valor será revelado após o preenchimento completo.</p>
                </div>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
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
                    <div className="text-center p-4 bg-primary-50 dark:bg-primary-900/50 rounded-lg">
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
        </div>
    );
};

interface PlanCardProps {
    plan: { title: string; benefits: string[] };
    planType: PlanType;
    selectedPlan: PlanType;
    onSelect: (plan: PlanType) => void;
    disabled?: boolean;
    disabledMessage?: string;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, planType, selectedPlan, onSelect, disabled = false, disabledMessage = "Em breve!" }) => {
    const isSelected = selectedPlan === planType;
    
    const handleClick = () => {
        if (!disabled) {
            onSelect(planType);
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
            {disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-500/50 rounded-lg">
                    <span className="px-3 py-1 bg-gray-800 text-white text-sm font-bold rounded-full">{disabledMessage}</span>
                </div>
            )}
            <h4 className="text-xl font-bold text-center">{plan.title}</h4>
            <ul className="mt-4 space-y-2 list-disc list-inside text-gray-600 dark:text-gray-300">
                {plan.benefits.map((benefit, i) => <li key={i}>{benefit}</li>)}
            </ul>
        </div>
    )
}


export default PreBudgetView;