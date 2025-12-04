

import React, { useState, useEffect } from 'react';
import { AppContextType, AuthContextType, Settings, Bank, AdvancePaymentOption, FidelityPlan } from '../../types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { TrashIcon, EditIcon, PlusIcon } from '../../constants';
import { Modal } from '../../components/Modal';

interface SettingsViewProps {
    appContext: AppContextType;
    authContext: AuthContextType;
}

const SettingsView: React.FC<SettingsViewProps> = ({ appContext, authContext }) => {
    const { settings, loading, updateSettings, showNotification, advancePlanUsage, clients } = appContext;
    const { changePassword } = authContext;
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    useEffect(() => {
        if (settings) {
            setLocalSettings(JSON.parse(JSON.stringify(settings)));
        }
    }, [settings]);

    if (loading.settings || !localSettings) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    const handleSimpleChange = (e: React.ChangeEvent<HTMLInputElement>, section?: keyof Settings | 'features' | 'automation' | 'pricing') => {
        const { name, value, type } = e.target;
        const finalValue = type === 'number' ? parseFloat(value) || 0 : value;
        
        setLocalSettings(prev => {
            if (!prev) return null;
            if (section) {
                const sectionKey = section as keyof Settings;
                return {
                    ...prev,
                    [sectionKey]: {
                        ...(prev[sectionKey] as any),
                        [name]: finalValue,
                    }
                }
            }
            return {...prev, [name]: finalValue };
        });
    };
    
    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue = value;
        if (name === 'zip') {
            finalValue = value
                .replace(/\D/g, '')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .slice(0, 9);
        }
        setLocalSettings(prev => {
            if (!prev) return null;
            return {
                ...prev!,
                baseAddress: {
                    ...prev!.baseAddress,
                    [name]: finalValue,
                },
            };
        });
    };

    const handleToggle = (feature: keyof Settings['features']) => {
        setLocalSettings(prev => ({
            ...prev!,
            features: {
                ...prev!.features,
                [feature]: !prev!.features[feature]
            }
        }));
    };
    
     const handleTierChange = (index: number, field: 'upTo' | 'price', value: number) => {
        const newTiers = [...localSettings.pricing.volumeTiers];
        newTiers[index][field] = value;
        setLocalSettings(prev => ({...prev!, pricing: {...prev!.pricing, volumeTiers: newTiers}}));
    };

    const addTier = () => {
        const newTiers = [...localSettings.pricing.volumeTiers, {upTo: 0, price: 0}];
        setLocalSettings(prev => ({...prev!, pricing: {...prev!.pricing, volumeTiers: newTiers}}));
    };

    const removeTier = (index: number) => {
        const newTiers = localSettings.pricing.volumeTiers.filter((_, i) => i !== index);
        setLocalSettings(prev => ({...prev!, pricing: {...prev!.pricing, volumeTiers: newTiers}}));
    };
    
    const handleFidelityPlanChange = (index: number, field: keyof Omit<FidelityPlan, 'id'>, value: number) => {
        const newPlans = [...localSettings.fidelityPlans];
        newPlans[index][field] = value;
        setLocalSettings(prev => ({ ...prev!, fidelityPlans: newPlans }));
    };

    const addFidelityPlan = () => {
        const newPlan = { id: Date.now().toString(), months: 0, discountPercent: 0 };
        const newPlans = [...localSettings.fidelityPlans, newPlan];
        setLocalSettings(prev => ({ ...prev!, fidelityPlans: newPlans }));
    };

    const removeFidelityPlan = (index: number) => {
        const newPlans = localSettings.fidelityPlans.filter((_, i) => i !== index);
        setLocalSettings(prev => ({ ...prev!, fidelityPlans: newPlans }));
    };

    const handleAdvanceOptionChange = (index: number, field: keyof AdvancePaymentOption, value: number) => {
        const newOptions = [...localSettings.advancePaymentOptions];
        newOptions[index][field] = value;
        setLocalSettings(prev => ({ ...prev!, advancePaymentOptions: newOptions }));
    };

    const addAdvanceOption = () => {
        const newOptions = [...localSettings.advancePaymentOptions, { months: 0, discountPercent: 0 }];
        setLocalSettings(prev => ({ ...prev!, advancePaymentOptions: newOptions }));
    };

    const removeAdvanceOption = (index: number) => {
        const newOptions = localSettings.advancePaymentOptions.filter((_, i) => i !== index);
        setLocalSettings(prev => ({ ...prev!, advancePaymentOptions: newOptions }));
    };


    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateSettings(localSettings);
            showNotification('Configurações salvas com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar configurações.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showNotification('As senhas não coincidem.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showNotification('A senha precisa ter no mínimo 6 caracteres.', 'error');
            return;
        }
        setIsSavingPassword(true);
        try {
            await changePassword(newPassword);
            showNotification('Senha alterada com sucesso!', 'success');
            setNewPassword('');
            setConfirmPassword('');
        } catch(error: any) {
            showNotification(error.message || 'Erro ao alterar a senha.', 'error');
        } finally {
            setIsSavingPassword(false);
        }
    };
    
    const activeClientsCount = clients.filter(c => c.clientStatus === 'Ativo').length;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Configurações Gerais</h2>
                <Button onClick={handleSave} isLoading={isSaving}>Salvar Alterações</Button>
            </div>
            <div className="space-y-8">
                {/* Company Info */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Informações da Empresa e Tela Inicial</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <Input label="Nome da Empresa (para painéis)" name="companyName" value={localSettings.companyName} onChange={(e) => handleSimpleChange(e)} />
                        <Input label="Chave PIX Padrão" name="pixKey" value={localSettings.pixKey} onChange={(e) => handleSimpleChange(e)} />
                        <Input containerClassName="md:col-span-2" label="Título Principal (Tela Inicial)" name="mainTitle" value={localSettings.mainTitle || ''} onChange={(e) => handleSimpleChange(e)} />
                        <Input containerClassName="md:col-span-2" label="Subtítulo (Tela Inicial)" name="mainSubtitle" value={localSettings.mainSubtitle || ''} onChange={(e) => handleSimpleChange(e)} />
                    </div>
                     <fieldset className="mt-4 border p-4 rounded-md dark:border-gray-600">
                        <legend className="px-2 font-semibold">Endereço da Empresa</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mt-2">
                            <Input
                                containerClassName="sm:col-span-2"
                                label="CEP"
                                name="zip"
                                value={localSettings.baseAddress.zip}
                                onChange={handleAddressChange}
                                placeholder="00000-000"
                                pattern="[0-9]{5}-[0-9]{3}"
                                title="Formato do CEP: 12345-678"
                                maxLength={9}
                            />
                            <Input containerClassName="sm:col-span-4" label="Rua" name="street" value={localSettings.baseAddress.street} onChange={handleAddressChange} />
                            <Input containerClassName="sm:col-span-2" label="Número" name="number" value={localSettings.baseAddress.number} onChange={handleAddressChange} />
                            <Input containerClassName="sm:col-span-4" label="Bairro" name="neighborhood" value={localSettings.baseAddress.neighborhood} onChange={handleAddressChange} />
                            <Input containerClassName="sm:col-span-4" label="Cidade" name="city" value={localSettings.baseAddress.city} onChange={handleAddressChange} />
                            <Input containerClassName="sm:col-span-2" label="UF" name="state" value={localSettings.baseAddress.state} onChange={handleAddressChange} maxLength={2} />
                        </div>
                    </fieldset>
                </div>
                
                {/* Bank Management */}
                <BankManager appContext={appContext} />

                 {/* Automations */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Automações</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <Input 
                            label="Gerar sugestão de reposição quando estoque for menor ou igual a (unidades)" 
                            name="replenishmentStockThreshold" 
                            type="number" 
                            value={localSettings.automation.replenishmentStockThreshold} 
                            onChange={(e) => handleSimpleChange(e, 'automation')} 
                        />
                    </div>
                </div>

                {/* Pricing */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Precificação</h3>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-md">
                        <strong>Atenção:</strong> Alterar estes valores afetará o preço da mensalidade de <strong>todos</strong> os clientes existentes.
                    </p>
                     <div className="grid md:grid-cols-3 gap-4 mb-4">
                         <Input label="Valor por KM" name="perKm" type="number" value={localSettings.pricing.perKm} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                         <Input label="Taxa Água de Poço" name="wellWaterFee" type="number" value={localSettings.pricing.wellWaterFee} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                         <Input label="Taxa de Produtos" name="productsFee" type="number" value={localSettings.pricing.productsFee} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                    </div>
                    <h4 className="font-semibold mt-6 mb-2">Faixas de Preço por Volume</h4>
                    {localSettings.pricing.volumeTiers.map((tier, index) => (
                        <div key={index} className="flex items-center gap-2 mb-2">
                           <span>Até</span>
                           <Input label="" type="number" value={tier.upTo} onChange={(e) => handleTierChange(index, 'upTo', +e.target.value)} containerClassName="mb-0" />
                           <span>litros, custa R$</span>
                           <Input label="" type="number" value={tier.price} onChange={(e) => handleTierChange(index, 'price', +e.target.value)} containerClassName="mb-0" />
                           <Button variant="danger" size="sm" onClick={() => removeTier(index)}><TrashIcon className="w-4 h-4"/></Button>
                        </div>
                    ))}
                    <Button variant="secondary" size="sm" onClick={addTier}>Adicionar Faixa</Button>
                </div>

                {/* Plans */}
                <div className="grid md:grid-cols-2 gap-8">
                    <PlanEditor title="Plano Simples" planKey="simple" plan={localSettings.plans.simple} setLocalSettings={setLocalSettings} />
                    <FidelityPlanEditor localSettings={localSettings} setLocalSettings={setLocalSettings} />
                </div>

                {/* Features */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Gerenciamento de Funcionalidades</h3>
                    <div className="space-y-4">
                        <ToggleSwitch label="Ativar Plano VIP" enabled={localSettings.features.vipPlanEnabled} onChange={() => handleToggle('vipPlanEnabled')} />
                        {!localSettings.features.vipPlanEnabled && (
                            <div className="pl-8 mt-2">
                                <Input 
                                    label="Mensagem para Plano VIP desativado" 
                                    name="vipPlanDisabledMessage" 
                                    value={localSettings.features.vipPlanDisabledMessage || ''} 
                                    onChange={(e) => handleSimpleChange(e, 'features')} 
                                />
                            </div>
                        )}
                        <ToggleSwitch label="Ativar Loja para Clientes" enabled={localSettings.features.storeEnabled} onChange={() => handleToggle('storeEnabled')} />
                        <ToggleSwitch label="Ativar Plano de Adiantamento" enabled={localSettings.features.advancePaymentPlanEnabled} onChange={() => handleToggle('advancePaymentPlanEnabled')} />
                        
                        {localSettings.features.advancePaymentPlanEnabled && (
                            <div className="pl-8 mt-4 space-y-2">
                                <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                                    <h4 className="font-semibold">Textos do Banner Promocional</h4>
                                     <Input 
                                        label="Título do Banner" 
                                        name="advancePaymentTitle" 
                                        value={localSettings.features.advancePaymentTitle || ''} 
                                        onChange={(e) => handleSimpleChange(e, 'features')} 
                                    />
                                     <Input 
                                        label="Subtítulo (Plano VIP)" 
                                        name="advancePaymentSubtitleVIP" 
                                        value={localSettings.features.advancePaymentSubtitleVIP || ''} 
                                        onChange={(e) => handleSimpleChange(e, 'features')} 
                                    />
                                     <Input 
                                        label="Subtítulo (Plano Simples)" 
                                        name="advancePaymentSubtitleSimple" 
                                        value={localSettings.features.advancePaymentSubtitleSimple || ''} 
                                        onChange={(e) => handleSimpleChange(e, 'features')} 
                                    />
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm mt-6">
                                    <p><strong>Status da Adesão:</strong></p>
                                    <p>{advancePlanUsage.count} de {activeClientsCount} clientes ativos aderiram ({advancePlanUsage.percentage.toFixed(2)}%).</p>
                                    {advancePlanUsage.percentage >= 10 && (
                                        <p className="font-bold text-yellow-600 dark:text-yellow-400 mt-2">
                                            O plano está desativado automaticamente para novos clientes pois o limite de 10% foi atingido.
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                                    <h4 className="font-semibold">Opções de Adiantamento com Desconto</h4>
                                    {localSettings.advancePaymentOptions.map((option, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <span>Pagar</span>
                                            <Input label="" type="number" value={option.months} onChange={(e) => handleAdvanceOptionChange(index, 'months', +e.target.value)} containerClassName="mb-0 w-20" />
                                            <span>meses com</span>
                                            <Input label="" type="number" value={option.discountPercent} onChange={(e) => handleAdvanceOptionChange(index, 'discountPercent', +e.target.value)} containerClassName="mb-0 w-20" />
                                            <span>% de desconto</span>
                                            <Button variant="danger" size="sm" onClick={() => removeAdvanceOption(index)}><TrashIcon className="w-4 h-4"/></Button>
                                        </div>
                                    ))}
                                    <Button variant="secondary" size="sm" onClick={addAdvanceOption}>Adicionar Opção</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* My Account */}
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Minha Conta</h3>
                     <form onSubmit={handlePasswordChange} className="space-y-4">
                        <h4 className="font-semibold">Alterar Senha</h4>
                        <div className="grid md:grid-cols-3 gap-4 items-end">
                             <Input label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} containerClassName="mb-0" />
                             <Input label="Confirmar Nova Senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} containerClassName="mb-0" />
                             <Button type="submit" isLoading={isSavingPassword}>Salvar Nova Senha</Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const BankManager = ({ appContext }: { appContext: AppContextType }) => {
    const { banks, saveBank, deleteBank, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBank, setCurrentBank] = useState<Omit<Bank, 'id'> | (Bank & { pixKey?: string }) | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenModal = (bank: Bank | null = null) => {
        setCurrentBank(bank || { name: '', pixKey: '' });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentBank(null);
    };

    const handleSave = async () => {
        if (!currentBank || !currentBank.name) {
            showNotification('O nome do banco é obrigatório.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            await saveBank(currentBank);
            showNotification('Banco salvo com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar banco.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (bankId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este banco?')) {
            try {
                await deleteBank(bankId);
                showNotification('Banco excluído com sucesso.', 'success');
            } catch (error: any) {
                showNotification(error.message || 'Erro ao excluir banco.', 'error');
            }
        }
    };
    
    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestão de Bancos/Contas</h3>
                <Button size="sm" onClick={() => handleOpenModal()}>
                    <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Banco
                </Button>
            </div>
            <div className="space-y-2">
                {banks.map(bank => (
                    <div key={bank.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                            <span className="font-medium">{bank.name}</span>
                            {bank.pixKey && <p className="text-xs text-gray-500">PIX: {bank.pixKey}</p>}
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleOpenModal(bank)}><EditIcon className="w-4 h-4" /></Button>
                            <Button size="sm" variant="danger" onClick={() => handleDelete(bank.id)}><TrashIcon className="w-4 h-4" /></Button>
                        </div>
                    </div>
                ))}
            </div>
             {isModalOpen && currentBank && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={'id' in currentBank ? 'Editar Banco' : 'Novo Banco'}
                    footer={
                        <>
                            <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                            <Button onClick={handleSave} isLoading={isSaving}>Salvar</Button>
                        </>
                    }
                >
                    <Input 
                        label="Nome do Banco/Conta" 
                        value={currentBank.name} 
                        onChange={(e) => setCurrentBank(prev => ({...prev!, name: e.target.value}))}
                        placeholder="Ex: PicPay, Itaú, Dinheiro"
                    />
                     <Input 
                        label="Chave PIX (Opcional)" 
                        value={currentBank.pixKey || ''} 
                        onChange={(e) => setCurrentBank(prev => ({...prev!, pixKey: e.target.value}))}
                        placeholder="Chave PIX da conta"
                    />
                </Modal>
             )}
        </div>
    );
};

const PlanEditor = ({ title, planKey, plan, setLocalSettings }: any) => {
    
    const handleChange = (field: string, value: string) => {
        setLocalSettings((prev: Settings | null) => ({...prev!, plans: {...prev!.plans, [planKey]: {...prev!.plans[planKey], [field]: value}}}));
    };
    
    const handleBenefitChange = (index: number, value: string) => {
        const newBenefits = [...plan.benefits];
        newBenefits[index] = value;
        setLocalSettings((prev: Settings | null) => ({...prev!, plans: {...prev!.plans, [planKey]: {...prev!.plans[planKey], benefits: newBenefits}}}));
    };
    
    const addBenefit = () => {
        const newBenefits = [...plan.benefits, 'Novo benefício'];
        setLocalSettings((prev: Settings | null) => ({...prev!, plans: {...prev!.plans, [planKey]: {...prev!.plans[planKey], benefits: newBenefits}}}));
    };

    const removeBenefit = (index: number) => {
        const newBenefits = plan.benefits.filter((_: any, i: number) => i !== index);
        setLocalSettings((prev: Settings | null) => ({...prev!, plans: {...prev!.plans, [planKey]: {...prev!.plans[planKey], benefits: newBenefits}}}));
    };


    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4">{title}</h3>
            <Input label="Título do Plano" value={plan.title} onChange={(e) => handleChange('title', e.target.value)} />
            <h4 className="font-semibold mt-4 mb-2">Benefícios</h4>
            {plan.benefits.map((benefit: string, index: number) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                    <Input label="" value={benefit} onChange={(e) => handleBenefitChange(index, e.target.value)} containerClassName="flex-grow mb-0" />
                    <Button variant="danger" size="sm" onClick={() => removeBenefit(index)}><TrashIcon className="w-4 h-4"/></Button>
                </div>
            ))}
            <Button variant="secondary" size="sm" onClick={addBenefit}>Adicionar Benefício</Button>
            
            <h4 className="font-semibold mt-6 mb-2">Termos do Plano</h4>
            <textarea
                value={plan.terms}
                onChange={(e) => handleChange('terms', e.target.value)}
                rows={5}
                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
        </div>
    );
};

const FidelityPlanEditor = ({ localSettings, setLocalSettings }: any) => {
    const handleFidelityPlanChange = (index: number, field: keyof Omit<FidelityPlan, 'id'>, value: number) => {
        const newPlans = [...localSettings.fidelityPlans];
        newPlans[index][field] = value;
        setLocalSettings((prev: any) => ({ ...prev!, fidelityPlans: newPlans }));
    };

    const addFidelityPlan = () => {
        const newPlan = { id: Date.now().toString(), months: 0, discountPercent: 0 };
        const newPlans = [...localSettings.fidelityPlans, newPlan];
        setLocalSettings((prev: any) => ({ ...prev!, fidelityPlans: newPlans }));
    };

    const removeFidelityPlan = (index: number) => {
        const newPlans = localSettings.fidelityPlans.filter((_: any, i: number) => i !== index);
        setLocalSettings((prev: any) => ({ ...prev!, fidelityPlans: newPlans }));
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4">Planos de Fidelidade (VIP)</h3>
            <div className="space-y-2">
                {localSettings.fidelityPlans.map((plan: FidelityPlan, index: number) => (
                    <div key={plan.id} className="flex items-center gap-2">
                        <span>Fidelidade de</span>
                        <Input label="" type="number" value={plan.months} onChange={(e) => handleFidelityPlanChange(index, 'months', +e.target.value)} containerClassName="mb-0 w-20" />
                        <span>meses com</span>
                        <Input label="" type="number" value={plan.discountPercent} onChange={(e) => handleFidelityPlanChange(index, 'discountPercent', +e.target.value)} containerClassName="mb-0 w-20" />
                        <span>% de desconto</span>
                        <Button variant="danger" size="sm" onClick={() => removeFidelityPlan(index)}><TrashIcon className="w-4 h-4"/></Button>
                    </div>
                ))}
            </div>
            <Button variant="secondary" size="sm" onClick={addFidelityPlan} className="mt-4">Adicionar Plano de Fidelidade</Button>
             <PlanEditor title="Detalhes Gerais do Plano VIP" planKey="vip" plan={localSettings.plans.vip} setLocalSettings={setLocalSettings} />
        </div>
    );
};


export default SettingsView;