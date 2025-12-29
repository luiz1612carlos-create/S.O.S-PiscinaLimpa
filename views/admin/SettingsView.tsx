
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppContextType, AuthContextType, Settings, Bank, AdvancePaymentOption, FidelityPlan, UserData, AffectedClientPreview, PendingPriceChange, RecessPeriod } from '../../types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { TrashIcon, EditIcon, PlusIcon, CalendarDaysIcon, ChartBarIcon, CurrencyDollarIcon, SparklesIcon } from '../../constants';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { calculateClientMonthlyFee } from '../../utils/calculations';
import { firebase } from '../../firebase';

// This is a workaround for the no-build-tool environment
declare const html2canvas: any;

interface SettingsViewProps {
    appContext: AppContextType;
    authContext: AuthContextType;
}

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const RecessManager = ({ appContext }: { appContext: AppContextType }) => {
    const { settings, saveRecessPeriod, deleteRecessPeriod, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentRecess, setCurrentRecess] = useState<Omit<RecessPeriod, 'id'> | RecessPeriod | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    const handleOpenModal = (recess: RecessPeriod | null = null) => {
        if (recess) {
            setCurrentRecess({
                ...recess,
                startDate: toDate(recess.startDate)?.toISOString().split('T')[0],
                endDate: toDate(recess.endDate)?.toISOString().split('T')[0]
            });
        } else {
            setCurrentRecess({ name: '', startDate: '', endDate: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentRecess(null);
    };

    const handleSave = async () => {
        if (!currentRecess || !currentRecess.name || !currentRecess.startDate || !currentRecess.endDate) {
            showNotification('Todos os campos são obrigatórios.', 'error');
            return;
        }
        if (new Date(currentRecess.startDate) > new Date(currentRecess.endDate)) {
            showNotification('A data de início não pode ser posterior à data de término.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const recessToSave = {
                ...currentRecess,
                startDate: new Date(currentRecess.startDate + 'T00:00:00'),
                endDate: new Date(currentRecess.endDate + 'T23:59:59'),
            };
            await saveRecessPeriod(recessToSave);
            showNotification('Período de recesso salvo com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar período de recesso.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (recessId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este período de recesso?')) {
            try {
                await deleteRecessPeriod(recessId);
                showNotification('Recesso excluído com sucesso.', 'success');
            } catch (error: any) {
                showNotification(error.message || 'Erro ao excluir recesso.', 'error');
            }
        }
    };
    
    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestão de Recessos</h3>
                <Button size="sm" onClick={() => handleOpenModal()}>
                    <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Recesso
                </Button>
            </div>
            <div className="space-y-2">
                {settings?.recessPeriods && settings.recessPeriods.length > 0 ? settings.recessPeriods.map(recess => (
                    <div key={recess.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                            <span className="font-medium">{recess.name}</span>
                            <p className="text-xs text-gray-500">
                                {toDate(recess.startDate)?.toLocaleDateString('pt-BR')} - {toDate(recess.endDate)?.toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="danger" onClick={() => handleDelete(recess.id)}><TrashIcon className="w-4 h-4" /></Button>
                        </div>
                    </div>
                )) : <p className="text-sm text-gray-500">Nenhum período de recesso cadastrado.</p>}
            </div>
             {isModalOpen && currentRecess && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    title={'id' in currentRecess ? 'Editar Recesso' : 'Novo Recesso'}
                    footer={
                        <>
                            <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                            <Button onClick={handleSave} isLoading={isSaving}>Salvar</Button>
                        </>
                    }
                >
                    <Input 
                        label="Nome do Recesso" 
                        value={currentRecess.name} 
                        onChange={(e) => setCurrentRecess(prev => ({...prev!, name: e.target.value}))}
                        placeholder="Ex: Recesso de Fim de Ano"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input 
                            label="Data de Início" 
                            type="date"
                            min={today}
                            value={currentRecess.startDate || ''} 
                            onChange={(e) => setCurrentRecess(prev => ({...prev!, startDate: e.target.value}))}
                        />
                        <Input 
                            label="Data de Término" 
                            type="date"
                            min={currentRecess.startDate || today}
                            value={currentRecess.endDate || ''} 
                            onChange={(e) => setCurrentRecess(prev => ({...prev!, endDate: e.target.value}))}
                        />
                    </div>
                </Modal>
             )}
        </div>
    );
};

const UserManager = ({ appContext }: { appContext: AppContextType }) => {
    const { users, loading, createTechnician, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleOpenModal = () => {
        setName('');
        setEmail('');
        setPassword('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };
    
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            showNotification('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            await createTechnician(name, email, password);
            showNotification('Técnico criado com sucesso! Você será desconectado.', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao criar técnico.', 'error');
            setIsSaving(false);
        }
    };

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Gestão de Usuários (Admin/Técnicos)</h3>
                <Button size="sm" onClick={handleOpenModal}>
                    <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Técnico
                </Button>
            </div>
            {loading.users ? <Spinner /> : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="border-b dark:border-gray-700">
                            <tr>
                                <th className="text-left p-2 font-semibold">Nome</th>
                                <th className="text-left p-2 font-semibold">Email</th>
                                <th className="text-left p-2 font-semibold">Função</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.uid} className="border-b dark:border-gray-700">
                                    <td className="p-2">{user.name}</td>
                                    <td className="p-2">{user.email}</td>
                                    <td className="p-2 capitalize">{user.role}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
             <Modal 
                isOpen={isModalOpen} 
                onClose={handleCloseModal} 
                title="Adicionar Novo Técnico"
                footer={
                    <>
                        <Button variant="secondary" onClick={handleCloseModal} disabled={isSaving}>Cancelar</Button>
                    </>
                }
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <Input 
                        label="Nome Completo do Técnico" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <Input 
                        label="Email do Técnico"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input 
                        label="Senha Inicial"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Mínimo 6 caracteres"
                    />
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-r-lg text-sm">
                        <strong>Atenção:</strong> Por segurança, ao criar um novo técnico você será desconectado e precisará fazer login novamente.
                    </div>
                     <div className="flex justify-end">
                        <Button type="submit" isLoading={isSaving}>Salvar Técnico</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

const BankManager = ({ appContext }: { appContext: AppContextType }) => {
    const { banks, saveBank, deleteBank, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBank, setCurrentBank] = useState<Omit<Bank, 'id'> | (Bank & { pixKey?: string, pixKeyRecipient?: string }) | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenModal = (bank: Bank | null = null) => {
        setCurrentBank(bank || { name: '', pixKey: '', pixKeyRecipient: '' });
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
                    <Input 
                        label="Nome do Destinatário (Opcional)" 
                        value={currentBank.pixKeyRecipient || ''} 
                        onChange={(e) => setCurrentBank(prev => ({...prev!, pixKeyRecipient: e.target.value}))}
                        placeholder="Nome do beneficiário"
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
        const newPlans = localSettings.fidelityPlans.filter((_, i) => i !== index);
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

const SettingsView: React.FC<SettingsViewProps> = ({ appContext, authContext }) => {
    const { settings, loading, updateSettings, showNotification, advancePlanUsage, clients, pendingPriceChanges, schedulePriceChange } = appContext;
    const { changePassword } = authContext;
    const [localSettings, setLocalSettings] = useState<Settings | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [shouldRemoveLogo, setShouldRemoveLogo] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);


    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const [isPriceChangeModalOpen, setIsPriceChangeModalOpen] = useState(false);
    const [affectedClientsPreview, setAffectedClientsPreview] = useState<AffectedClientPreview[]>([]);
    const [effectiveDate, setEffectiveDate] = useState<Date | null>(null);
    const [viewAffectedClientsModalOpen, setViewAffectedClientsModalOpen] = useState(false);

    const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);

    const pendingChange = pendingPriceChanges.find(c => c.status === 'pending');

    useEffect(() => {
        if (settings) {
            const initialSettings = JSON.parse(JSON.stringify(settings));
            if (pendingChange) {
                initialSettings.pricing = JSON.parse(JSON.stringify(pendingChange.newPricing));
            }
            setLocalSettings(initialSettings);
            setLogoPreview(settings.logoUrl || null);
        }
    }, [settings, pendingChange]);

    const impactAnalysis = useMemo(() => {
        if (!settings || !localSettings) return [];
        
        return clients
            .filter(c => c.clientStatus === 'Ativo' && !c.customPricing && c.plan === 'Simples')
            .map(client => {
                const currentFee = calculateClientMonthlyFee(client, settings);
                const newFee = calculateClientMonthlyFee(client, localSettings);
                const diff = newFee - currentFee;
                return {
                    id: client.id,
                    name: client.name,
                    currentFee,
                    newFee,
                    diff,
                    percent: currentFee > 0 ? (diff / currentFee) * 100 : 0
                };
            })
            .filter(item => Math.abs(item.diff) > 0.01)
            .sort((a, b) => b.diff - a.diff);
    }, [clients, settings, localSettings]);

    const totalRevenueDiff = useMemo(() => {
        return impactAnalysis.reduce((acc, curr) => acc + curr.diff, 0);
    }, [impactAnalysis]);

    if (loading.settings || loading.pendingPriceChanges || !localSettings) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    const handleSimpleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, section?: keyof Settings | 'features' | 'automation' | 'pricing' | 'logoTransforms') => {
        const { name, value, type } = e.target;
        
        let finalValue: any = value;
        if (e.target.tagName === 'INPUT' && (type === 'number' || type === 'range')) {
            finalValue = parseFloat(value) || 0;
        }
        
        setLocalSettings(prev => {
            if (!prev) return null;
            const newState = JSON.parse(JSON.stringify(prev));
            if (section) {
                const sectionKey = section as keyof Settings;
                 if (!newState[sectionKey]) {
                    (newState as any)[sectionKey] = {};
                }
                (newState[sectionKey] as any)[name] = finalValue;
                return newState
            }
            (newState as any)[name] = finalValue;
            return newState;
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
    
    const handleTierChange = (index: number, field: 'min' | 'max' | 'price', value: number) => {
        setLocalSettings(prev => {
             const newPricing = { ...prev!.pricing };
             const newTiers = prev!.pricing.volumeTiers.map((t, i) => 
                 i === index ? { ...t, [field]: value } : t
             );
             newPricing.volumeTiers = newTiers;
             return { ...prev!, pricing: newPricing };
        });
    };

    const addTier = () => {
        const newTiers = [...localSettings.pricing.volumeTiers, {min: 0, max: 0, price: 0}];
        setLocalSettings(prev => ({...prev!, pricing: {...prev!.pricing, volumeTiers: newTiers}}));
    };

    const removeTier = (index: number) => {
        const newTiers = localSettings.pricing.volumeTiers.filter((_, i) => i !== index);
        setLocalSettings(prev => ({...prev!, pricing: {...prev!.pricing, volumeTiers: newTiers}}));
    };
    
    // FIX: Added missing handleAdvanceOptionChange function
    const handleAdvanceOptionChange = (index: number, field: keyof AdvancePaymentOption, value: number) => {
        setLocalSettings(prev => {
            if (!prev) return null;
            const newOptions = [...prev.advancePaymentOptions];
            newOptions[index] = { ...newOptions[index], [field]: value };
            return { ...prev, advancePaymentOptions: newOptions };
        });
    };

    // FIX: Added missing addAdvanceOption function
    const addAdvanceOption = () => {
        setLocalSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                advancePaymentOptions: [...prev.advancePaymentOptions, { months: 0, discountPercent: 0 }]
            };
        });
    };

    // FIX: Added missing removeAdvanceOption function
    const removeAdvanceOption = (index: number) => {
        setLocalSettings(prev => {
            if (!prev) return null;
            return {
                ...prev,
                advancePaymentOptions: prev.advancePaymentOptions.filter((_, i) => i !== index)
            };
        });
    };

    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setShouldRemoveLogo(false);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setShouldRemoveLogo(true);
        setLogoFile(null);
        setLogoPreview(null);
        setLocalSettings(prev => ({ ...prev!, logoUrl: undefined }));
    };

    const handleResetTemplate = () => {
        const defaultTemplate = "Olá {CLIENTE}, tudo bem? Passando para lembrar sobre o vencimento da sua mensalidade no valor de R$ {VALOR} no dia {VENCIMENTO}. \n\nChave PIX: {PIX} \nDestinatário: {DESTINATARIO}\n\nAgradecemos a parceria!";
        handleSimpleChange({ target: { name: 'whatsappMessageTemplate', value: defaultTemplate } } as any);
        showNotification('Modelo de mensagem restaurado para o padrão.', 'info');
    };

    const handleSave = async () => {
        if (!settings || !localSettings) return;
        setIsSaving(true);
        setUploadProgress(logoFile ? 0 : null);
        try {
            const hasPriceChanged = JSON.stringify(localSettings.pricing) !== JSON.stringify(settings.pricing);
            const hasPlansChanged = JSON.stringify(localSettings.plans) !== JSON.stringify(settings.plans);

            // Importante: Mantemos o localSettings completo (incluindo pricing) para atualizar o documento principal.
            // Isso garante que a calculadora pública (PreBudgetView) use as faixas mais recentes.
            const settingsToSave = { ...localSettings };
            
            if (hasPlansChanged) {
                settingsToSave.termsUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
            }

            await updateSettings(
                settingsToSave, 
                logoFile || undefined, 
                shouldRemoveLogo,
                (progress) => setUploadProgress(progress)
            );
            
            setLogoFile(null);
            setShouldRemoveLogo(false);

            if (hasPriceChanged) {
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                const affected = impactAnalysis.map(c => ({ id: c.id, name: c.name }));
                
                setAffectedClientsPreview(affected);
                setEffectiveDate(thirtyDaysFromNow);
                setIsPriceChangeModalOpen(true);
            } else {
                showNotification('Configurações salvas com sucesso!', 'success');
            }
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar configurações.', 'error');
        } finally {
            setIsSaving(false);
            setUploadProgress(null);
        }
    };

    const handleConfirmPriceChange = async () => {
        setIsSaving(true);
        try {
            await schedulePriceChange(localSettings!.pricing, affectedClientsPreview);
            showNotification('Alteração de preço agendada com sucesso!', 'success');
            setIsPriceChangeModalOpen(false);
        } catch (error: any) {
             showNotification(error.message || 'Erro ao agendar alteração de preço.', 'error');
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
                <div>
                    <Button onClick={handleSave} isLoading={isSaving}>Salvar Alterações</Button>
                </div>
            </div>

            {isSaving && uploadProgress !== null && (
                <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div 
                            className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                    </div>
                    <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {logoFile ? `Enviando logo... ${Math.round(uploadProgress)}%` : 'Salvando...'}
                    </p>
                </div>
            )}

            {pendingChange && (
                <div className="p-4 mb-6 bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200 rounded-md">
                    <div className="flex items-center">
                        <CalendarDaysIcon className="w-6 h-6 mr-3" />
                        <div>
                            <p className="font-bold">Alteração de Preço Agendada</p>
                            <p>Novos preços entrarão em vigor em: <strong>{toDate(pendingChange.effectiveDate)?.toLocaleDateString('pt-BR')}</strong>.</p>
                            <button onClick={() => setViewAffectedClientsModalOpen(true)} className="text-sm text-blue-600 dark:text-blue-300 hover:underline">
                                Ver {pendingChange.affectedClients.length} cliente(s) afetado(s)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-8">
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Identidade Visual e Informações</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <Input label="Nome da Empresa (para painéis)" name="companyName" value={localSettings.companyName} onChange={(e) => handleSimpleChange(e)} />
                            <Input label="Título Principal (Tela Inicial)" name="mainTitle" value={localSettings.mainTitle || ''} onChange={(e) => handleSimpleChange(e)} />
                            <Input label="Subtítulo (Tela Inicial)" name="mainSubtitle" value={localSettings.mainSubtitle || ''} onChange={(e) => handleSimpleChange(e)} />
                            <Input label="Chave PIX Padrão" name="pixKey" value={localSettings.pixKey} onChange={(e) => handleSimpleChange(e)} />
                            <Input label="Nome do Destinatário PIX (Padrão)" name="pixKeyRecipient" value={localSettings.pixKeyRecipient || ''} onChange={(e) => handleSimpleChange(e)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Logomarca da Empresa
                            </label>
                            {logoPreview && (
                                <div className="h-24 w-full mb-2 border p-2 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={logoPreview}
                                        alt="Preview da logo"
                                        className="max-w-full max-h-full"
                                        style={{
                                            objectFit: localSettings.logoObjectFit,
                                            transform: `scale(${localSettings.logoTransforms?.scale || 1}) rotate(${localSettings.logoTransforms?.rotate || 0}deg)`,
                                            filter: `brightness(${localSettings.logoTransforms?.brightness || 1}) contrast(${localSettings.logoTransforms?.contrast || 1}) grayscale(${localSettings.logoTransforms?.grayscale || 0})`,
                                            transition: 'transform 0.2s ease, filter 0.2s ease',
                                        }}
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input name="logo-upload" label="" type="file" accept="image/png, image/jpeg" onChange={handleLogoFileChange} containerClassName="flex-grow mb-0" />
                                    {logoPreview && (
                                        <Button variant="danger" size="sm" onClick={handleRemoveLogo} title="Remover Logo">
                                            <TrashIcon className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                {logoPreview && (
                                    <>
                                    <div className="mt-4">
                                        <Select
                                            label="Ajuste da Imagem da Logo"
                                            name="logoObjectFit"
                                            value={localSettings.logoObjectFit}
                                            onChange={(e) => handleSimpleChange(e)}
                                            options={[
                                                { value: 'contain', label: 'Conter (mostrar imagem inteira)' },
                                                { value: 'cover', label: 'Preencher (pode cortar)' },
                                                { value: 'fill', label: 'Esticar (pode distorcer)' },
                                                { value: 'scale-down', label: 'Reduzir para caber' }
                                            ]}
                                        />
                                    </div>
                                    <div className="mt-4 pt-4 border-t dark:border-gray-600">
                                        <h4 className="font-semibold mb-2">Ajustes da Imagem</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm">Zoom (Escala): {Number(localSettings.logoTransforms?.scale || 1).toFixed(2)}x</label>
                                                <input type="range" min="0.5" max="2" step="0.05" name="scale"
                                                    value={localSettings.logoTransforms?.scale || 1}
                                                    onChange={(e) => handleSimpleChange(e, 'logoTransforms')}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm">Rotação: {localSettings.logoTransforms?.rotate}°</label>
                                                <input type="range" min="-180" max="180" step="1" name="rotate"
                                                    value={localSettings.logoTransforms?.rotate || 0}
                                                    onChange={(e) => handleSimpleChange(e, 'logoTransforms')}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm">Preto e Branco: {Math.round((localSettings.logoTransforms?.grayscale || 0) * 100)}%</label>
                                                <input type="range" min="0" max="1" step="0.05" name="grayscale"
                                                    value={localSettings.logoTransforms?.grayscale || 0}
                                                    onChange={(e) => handleSimpleChange(e, 'logoTransforms')}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm">Brilho: {Math.round((localSettings.logoTransforms?.brightness || 1) * 100)}%</label>
                                                <input type="range" min="0" max="2" step="0.05" name="brightness"
                                                    value={localSettings.logoTransforms?.brightness || 1}
                                                    onChange={(e) => handleSimpleChange(e, 'logoTransforms')}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm">Contraste: {Math.round((localSettings.logoTransforms?.contrast || 1) * 100)}%</label>
                                                <input type="range" min="0" max="2" step="0.05" name="contrast"
                                                    value={localSettings.logoTransforms?.contrast || 1}
                                                    onChange={(e) => handleSimpleChange(e, 'logoTransforms')}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    </>
                                )}
                            </div>
                        </div>
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
                
                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Configuração de Mensagens</h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Template de Cobrança WhatsApp
                                </label>
                                <Button size="sm" variant="secondary" onClick={handleResetTemplate}>
                                    <SparklesIcon className="w-4 h-4 mr-1 text-yellow-500" />
                                    Restaurar Modelo Padrão
                                </Button>
                            </div>
                            <textarea
                                name="whatsappMessageTemplate"
                                value={localSettings.whatsappMessageTemplate || ''}
                                onChange={(e) => handleSimpleChange(e)}
                                rows={5}
                                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                                placeholder="Olá {CLIENTE}, ..."
                            />
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                <p>Variáveis disponíveis para substituição:</p>
                                <ul className="list-disc list-inside mt-1">
                                    <li><strong>{`{CLIENTE}`}</strong>: Nome do Cliente</li>
                                    <li><strong>{`{VALOR}`}</strong>: Valor da mensalidade</li>
                                    <li><strong>{`{VENCIMENTO}`}</strong>: Data de vencimento</li>
                                    <li><strong>{`{PIX}`}</strong>: Chave PIX</li>
                                    <li><strong>{`{DESTINATARIO}`}</strong>: Nome do beneficiário</li>
                                </ul>
                            </div>
                        </div>

                         <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Template de Aviso/Anúncio WhatsApp
                                </label>
                            </div>
                            <textarea
                                name="announcementMessageTemplate"
                                value={localSettings.announcementMessageTemplate || ''}
                                onChange={(e) => handleSimpleChange(e)}
                                rows={6}
                                className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                                placeholder="Atenção! ..."
                            />
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                <p>Variáveis disponíveis para substituição:</p>
                                <ul className="list-disc list-inside mt-1">
                                    <li><strong>{`{CLIENTE}`}</strong>: Nome do Cliente</li>
                                    <li><strong>{`{LOGIN}`}</strong>: E-mail do cliente</li>
                                    <li><strong>{`{SENHA}`}</strong>: Senha fictícia</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <BankManager appContext={appContext} />
                <RecessManager appContext={appContext} />
                <UserManager appContext={appContext} />

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

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow relative">
                    <fieldset>
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-xl font-semibold">Precificação</h3>
                             <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => setIsImpactModalOpen(true)}
                                className={impactAnalysis.length > 0 ? "border-yellow-500 text-yellow-600" : ""}
                            >
                                <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                                Visualizar Impacto ({impactAnalysis.length})
                             </Button>
                        </div>
                        
                        {impactAnalysis.length > 0 && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-blue-800 dark:text-blue-200">Simulação de Impacto em Tempo Real</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-300">Com estas alterações, o faturamento mensal variará em:</p>
                                </div>
                                <div className={`text-lg font-bold ${totalRevenueDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {totalRevenueDiff >= 0 ? '+' : ''}R$ {totalRevenueDiff.toFixed(2)}
                                </div>
                            </div>
                        )}

                        <p className="text-sm text-yellow-600 dark:text-yellow-400 mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-md">
                            <strong>Atenção:</strong> Alterar as faixas de volume atualizará a calculadora de novos orçamentos imediatamente. Para clientes ativos (Plano Simples), a mudança de preço será agendada para entrar em vigor em 30 dias.
                        </p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <Input label="Valor por KM" name="perKm" type="number" value={localSettings.pricing.perKm} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                            <Input label="Taxa Água de Poço" name="wellWaterFee" type="number" value={localSettings.pricing.wellWaterFee} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                            <Input label="Taxa de Produtos" name="productsFee" type="number" value={localSettings.pricing.productsFee} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                            <Input label="Taxa Piscina de Festa" name="partyPoolFee" type="number" value={localSettings.pricing.partyPoolFee} onChange={(e) => handleSimpleChange(e, 'pricing')} />
                        </div>
                        <h4 className="font-semibold mt-6 mb-2">Faixas de Preço por Volume</h4>
                        {localSettings.pricing.volumeTiers.map((tier, index) => (
                            <div key={index} className="flex items-center gap-2 mb-2">
                            <span>De</span>
                            <Input label="" type="number" value={tier.min} onChange={(e) => handleTierChange(index, 'min', +e.target.value)} containerClassName="mb-0" />
                            <span>até</span>
                            <Input label="" type="number" value={tier.max} onChange={(e) => handleTierChange(index, 'max', +e.target.value)} containerClassName="mb-0" />
                            <span>litros, custa R$</span>
                            <Input label="" type="number" value={tier.price} onChange={(e) => handleTierChange(index, 'price', +e.target.value)} containerClassName="mb-0" />
                            <Button variant="danger" size="sm" onClick={() => removeTier(index)}><TrashIcon className="w-4 h-4"/></Button>
                            </div>
                        ))}
                        <Button variant="secondary" size="sm" onClick={addTier}>Adicionar Faixa</Button>
                    </fieldset>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <PlanEditor title="Plano Simples" planKey="simple" plan={localSettings.plans.simple} setLocalSettings={setLocalSettings} />
                    <FidelityPlanEditor localSettings={localSettings} setLocalSettings={setLocalSettings} />
                </div>

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <h3 className="text-xl font-semibold mb-4">Gerenciamento de Funcionalidades</h3>
                    <div className="space-y-4">
                        <ToggleSwitch label="Ativar Plano VIP" enabled={localSettings.features.vipPlanEnabled} onChange={() => handleToggle('vipPlanEnabled')} />
                        {!localSettings.features.vipPlanEnabled && (
                            <div className="pl-8 mt-2">
                                <Input label="Mensagem para Plano VIP desativado" name="vipPlanDisabledMessage" value={localSettings.features.vipPlanDisabledMessage || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                            </div>
                        )}
                        {localSettings.features.vipPlanEnabled && (
                            <div className="pl-8 mt-2 space-y-2">
                                <ToggleSwitch label="Permitir Solicitação de Upgrade de Plano pelo Cliente" enabled={localSettings.features.planUpgradeEnabled} onChange={() => handleToggle('planUpgradeEnabled')} />
                                 <Input label="Título do Banner de Upgrade" name="vipUpgradeTitle" value={localSettings.features.vipUpgradeTitle || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                                <Input label="Descrição do Banner de Upgrade" name="vipUpgradeDescription" value={localSettings.features.vipUpgradeDescription || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                            </div>
                        )}
                        <ToggleSwitch label="Ativar Loja para Clientes" enabled={localSettings.features.storeEnabled} onChange={() => handleToggle('storeEnabled')} />
                        <ToggleSwitch label="Ativar Plano de Adiantamento" enabled={localSettings.features.advancePaymentPlanEnabled} onChange={() => handleToggle('advancePaymentPlanEnabled')} />
                        
                        {localSettings.features.advancePaymentPlanEnabled && (
                            <div className="pl-8 mt-4 space-y-2">
                                <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                                    <h4 className="font-semibold">Textos do Banner Promocional</h4>
                                     <Input label="Título do Banner" name="advancePaymentTitle" value={localSettings.features.advancePaymentTitle || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                                     <Input label="Subtítulo (Plano VIP)" name="advancePaymentSubtitleVIP" value={localSettings.features.advancePaymentSubtitleVIP || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                                     <Input label="Subtítulo (Plano Simples)" name="advancePaymentSubtitleSimple" value={localSettings.features.advancePaymentSubtitleSimple || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                                </div>
                                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md text-sm mt-6">
                                    <p><strong>Status da Adesão:</strong></p>
                                    <p>{advancePlanUsage.count} de {activeClientsCount} clientes ativos aderiram ({advancePlanUsage.percentage.toFixed(2)}%).</p>
                                </div>
                                <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                                    <h4 className="font-semibold">Opções de Adiantamento</h4>
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

                        <div className="pt-4 mt-4 border-t dark:border-gray-700">
                             <ToggleSwitch label="Modo Manutenção" enabled={localSettings.features.maintenanceModeEnabled} onChange={() => handleToggle('maintenanceModeEnabled')} />
                            {localSettings.features.maintenanceModeEnabled && (
                                <div className="pl-8 mt-2">
                                    <Input label="Mensagem de Manutenção" name="maintenanceMessage" value={localSettings.features.maintenanceMessage || ''} onChange={(e) => handleSimpleChange(e, 'features')} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

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
            
            {isPriceChangeModalOpen && (
                <Modal
                    isOpen={isPriceChangeModalOpen}
                    onClose={() => setIsPriceChangeModalOpen(false)}
                    title="Confirmar Alteração de Preço"
                    size="lg"
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setIsPriceChangeModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleConfirmPriceChange} isLoading={isSaving}>Agendar Alteração</Button>
                        </>
                    }
                >
                    <p>Você está prestes a agendar uma alteração nos preços para clientes existentes.</p>
                    <p className="font-semibold my-2">Os novos valores entrarão em vigor em <strong>{effectiveDate?.toLocaleDateString('pt-BR')}</strong>.</p>
                    <p>A alteração afetará os seguintes <strong>{affectedClientsPreview.length}</strong> clientes do Plano Simples:</p>
                    <div className="mt-2 p-2 border rounded-md max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                        {affectedClientsPreview.length > 0 ? (
                            <ul className="list-disc list-inside">
                                {affectedClientsPreview.map(c => <li key={c.id}>{c.name}</li>)}
                            </ul>
                        ) : (
                            <p>Nenhum cliente será afetado por esta mudança no momento.</p>
                        )}
                    </div>
                </Modal>
            )}

            {pendingChange && viewAffectedClientsModalOpen && (
                <Modal
                    isOpen={viewAffectedClientsModalOpen}
                    onClose={() => setViewAffectedClientsModalOpen(false)}
                    title="Clientes Afetados"
                    size="lg"
                    footer={<Button onClick={() => setViewAffectedClientsModalOpen(false)}>Fechar</Button>}
                >
                    <p>Clientes afetados pela mudança de <strong>{toDate(pendingChange.effectiveDate)?.toLocaleDateString('pt-BR')}</strong>:</p>
                    <div className="mt-2 p-2 border rounded-md max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-700">
                        <ul className="list-disc list-inside">
                            {pendingChange.affectedClients.map(c => <li key={c.id}>{c.name}</li>)}
                        </ul>
                    </div>
                </Modal>
            )}
            
            {isImpactModalOpen && (
                <Modal
                    isOpen={isImpactModalOpen}
                    onClose={() => setIsImpactModalOpen(false)}
                    title="Simulação de Impacto Financeiro"
                    size="xl"
                    footer={<Button onClick={() => setIsImpactModalOpen(false)}>Fechar</Button>}
                >
                    <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">Total de Clientes Afetados:</span>
                            <span>{impactAnalysis.length}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="font-semibold">Variação Total no Faturamento:</span>
                            <span className={`font-bold text-lg ${totalRevenueDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {totalRevenueDiff >= 0 ? '+' : ''}R$ {totalRevenueDiff.toFixed(2)}
                            </span>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-600">
                                <tr>
                                    <th className="px-4 py-2 text-left">Cliente</th>
                                    <th className="px-4 py-2 text-right">Valor Atual</th>
                                    <th className="px-4 py-2 text-right">Novo Valor</th>
                                    <th className="px-4 py-2 text-right">Diferença</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {impactAnalysis.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-2 font-medium">{item.name}</td>
                                        <td className="px-4 py-2 text-right">R$ {item.currentFee.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-bold">R$ {item.newFee.toFixed(2)}</td>
                                        <td className={`px-4 py-2 text-right font-bold ${item.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {item.diff >= 0 ? '+' : ''}R$ {item.diff.toFixed(2)} ({item.percent.toFixed(1)}%)
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SettingsView;
