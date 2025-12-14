
import React, { useState, useMemo, useEffect } from 'react';
import { calculateClientMonthlyFee, calculateVolume, normalizeDimension, calculateDrivingDistance } from '../../utils/calculations';
import { AppContextType, Client, ClientProduct, PlanType, ClientStatus, PoolUsageStatus, PaymentStatus, Product, Address, Settings, Bank, FidelityPlan, Visit, StockProduct } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { ClientStockManager } from '../../components/ClientStockManager';
import { SparklesIcon } from '../../constants';

interface ClientsViewProps {
    appContext: AppContextType;
}

const formatAddress = (address: Address) => {
    if (!address) return 'N/A';
    return `${address.street}, ${address.number} - ${address.city}`;
};

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

// Moved from modal to be accessible by parent component
interface ClientFormData extends Omit<Client, 'poolDimensions'> {
    poolDimensions: {
        width: string | number;
        length: string | number;
        depth: string | number;
    }
}


const ClientsView: React.FC<ClientsViewProps> = ({ appContext }) => {
    const { clients, loading, products, banks, updateClient, deleteClient, markAsPaid, showNotification, settings, stockProducts } = appContext;
    const [filterPlan, setFilterPlan] = useState<PlanType | 'Todos'>('Todos');
    const [filterStatus, setFilterStatus] = useState<ClientStatus | 'Todos'>('Todos');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Announcement state
    const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
    const [selectedClientForAnnouncement, setSelectedClientForAnnouncement] = useState<Client | null>(null);
    const [announcementMessage, setAnnouncementMessage] = useState('');

    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            const planMatch = filterPlan === 'Todos' || client.plan === filterPlan;
            const statusMatch = filterStatus === 'Todos' || client.clientStatus === filterStatus;
            return planMatch && statusMatch;
        });
    }, [clients, filterPlan, filterStatus]);

    const handleOpenModal = (client: Client) => {
        setSelectedClient(client);
    };

    const handleCloseModal = () => {
        setSelectedClient(null);
    };
    
    const handleSaveChanges = async (clientData: ClientFormData) => {
        if (!clientData) return;
        setIsSaving(true);
        try {
            const volume = calculateVolume(
                clientData.poolDimensions.width,
                clientData.poolDimensions.length,
                clientData.poolDimensions.depth
            );
            const clientToSave: Client = {
                ...clientData,
                poolDimensions: {
                    width: normalizeDimension(clientData.poolDimensions.width),
                    length: normalizeDimension(clientData.poolDimensions.length),
                    depth: normalizeDimension(clientData.poolDimensions.depth),
                },
                poolVolume: volume,
            };
            const { id, ...dataToUpdate } = clientToSave;

            await updateClient(id, dataToUpdate);
            showNotification('Cliente atualizado com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Falha ao salvar alterações.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClient = async () => {
        const confirmationMessage = `Tem certeza que deseja excluir ${selectedClient?.name}?\n\nEsta ação removerá os dados do cliente, mas NÃO a sua conta de login.\n\nPara permitir que este email seja usado em um novo cadastro, você precisará apagar o usuário manualmente no painel do Firebase Authentication.`;
        if (!selectedClient || !window.confirm(confirmationMessage)) return;
        
        setIsDeleting(true);
        try {
            await deleteClient(selectedClient.id);
            showNotification('Cliente excluído com sucesso!', 'success');
            handleCloseModal();
        } catch(error: any) {
            showNotification(error.message || 'Falha ao excluir cliente.', 'error');
        } finally {
            setIsDeleting(false);
        }
    }
    
    const handleMarkPaid = async (clientData: ClientFormData) => {
        if (!clientData || !settings) return;

        const volume = calculateVolume(
            clientData.poolDimensions.width,
            clientData.poolDimensions.length,
            clientData.poolDimensions.depth
        );

        const clientToPay: Client = {
            ...clientData,
            poolDimensions: {
                width: normalizeDimension(clientData.poolDimensions.width),
                length: normalizeDimension(clientData.poolDimensions.length),
                depth: normalizeDimension(clientData.poolDimensions.depth),
            },
            poolVolume: volume,
        };
    
        const fee = calculateClientMonthlyFee(clientToPay, settings);
        if (!window.confirm(`Confirma o pagamento da mensalidade de R$ ${fee.toFixed(2)} para ${clientToPay.name}?`)) return;
    
        setIsSaving(true);
        try {
            await markAsPaid(clientToPay, 1, fee);
            showNotification('Pagamento registrado com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Falha ao registrar pagamento.', 'error');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleOpenAnnouncement = (e: React.MouseEvent, client: Client) => {
        e.stopPropagation(); // Prevent opening the edit modal
        if (!settings) return;
        
        setSelectedClientForAnnouncement(client);
        
        // Prepare template
        let template = settings.announcementMessageTemplate || "Atenção {CLIENTE}!\n\nAcesse: https://s-o-s-piscina-limpa.vercel.app/\nLogin: {LOGIN}";
        
        const message = template
            .replace(/{CLIENTE}/g, client.name)
            .replace(/{LOGIN}/g, client.email)
            .replace(/{SENHA}/g, "********"); // Passwords cannot be retrieved

        setAnnouncementMessage(message);
        setIsAnnouncementModalOpen(true);
    };

    const handleSendAnnouncement = () => {
        if (!selectedClientForAnnouncement) return;
        const phone = selectedClientForAnnouncement.phone.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(announcementMessage);
        window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
        setIsAnnouncementModalOpen(false);
        setSelectedClientForAnnouncement(null);
    };

    const isAdvancePlanActive = (client: Client): boolean => {
        if (!client.advancePaymentUntil) return false;
        const today = new Date();
        const advanceUntilDate = toDate(client.advancePaymentUntil);
        return advanceUntilDate && advanceUntilDate > today;
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Gerenciamento de Clientes</h2>
            <div className="flex space-x-4 mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <Select
                    label="Filtrar por Plano"
                    value={filterPlan}
                    onChange={(e) => setFilterPlan(e.target.value as any)}
                    options={[{ value: 'Todos', label: 'Todos' }, { value: 'Simples', label: 'Simples' }, { value: 'VIP', label: 'VIP' }]}
                    containerClassName="mb-0"
                />
                <Select
                    label="Filtrar por Status"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    options={[{ value: 'Todos', label: 'Todos' }, { value: 'Ativo', label: 'Ativo' }, { value: 'Pendente', label: 'Pendente' }]}
                    containerClassName="mb-0"
                />
            </div>

            {loading.clients ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredClients.map(client => (
                        <Card key={client.id} className="cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group" onClick={() => handleOpenModal(client)}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-semibold truncate pr-2">{client.name}</h3>
                                    {isAdvancePlanActive(client) && (
                                        <span className="flex-shrink-0 text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded-full dark:bg-green-900 dark:text-green-200">
                                            Adiantado
                                        </span>
                                    )}
                                </div>
                                <p className={`text-sm font-bold ${client.plan === 'VIP' ? 'text-yellow-500' : 'text-blue-500'}`}>
                                    {client.plan} {client.fidelityPlan ? `(${client.fidelityPlan.months} meses)` : ''}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{formatAddress(client.address)}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{client.phone}</p>
                            </CardContent>
                             <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    size="sm" 
                                    variant="light"
                                    className="shadow-md !p-2" 
                                    onClick={(e) => handleOpenAnnouncement(e, client)} 
                                    title="Enviar Aviso/Anúncio"
                                >
                                    <SparklesIcon className="w-5 h-5 text-purple-600" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            
            {selectedClient && (
                <ClientEditModal 
                    client={selectedClient} 
                    isOpen={!!selectedClient} 
                    onClose={handleCloseModal}
                    onSave={handleSaveChanges}
                    onDelete={handleDeleteClient}
                    onMarkPaid={handleMarkPaid}
                    isSaving={isSaving}
                    isDeleting={isDeleting}
                    stockProducts={stockProducts}
                    banks={banks}
                    settings={settings}
                />
            )}
            
            {/* Announcement Modal */}
            <Modal
                isOpen={isAnnouncementModalOpen}
                onClose={() => setIsAnnouncementModalOpen(false)}
                title={`Enviar Aviso para ${selectedClientForAnnouncement?.name}`}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsAnnouncementModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSendAnnouncement}>Enviar via WhatsApp</Button>
                    </>
                }
            >
                <div className="space-y-4">
                     <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 text-sm text-blue-700 dark:text-blue-300">
                        <strong>Dica:</strong> Se precisar enviar uma imagem, anexe-a manualmente no WhatsApp após clicar em enviar. O link abrirá a conversa com o texto abaixo pré-preenchido.
                    </div>
                    <textarea
                        value={announcementMessage}
                        onChange={(e) => setAnnouncementMessage(e.target.value)}
                        rows={10}
                        className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                     <div className="flex items-center gap-2 text-sm text-gray-500">
                         <span className="font-bold">Anexar Imagem:</span> 
                         {/* Dummy file input to satisfy visual requirement, explicitly stating functionality limitation */}
                         <input type="file" disabled className="text-xs file:py-1 file:px-2 cursor-not-allowed opacity-50" title="Anexe a imagem diretamente no WhatsApp." />
                         <span className="text-xs">(Anexar no App do WhatsApp)</span>
                     </div>
                </div>
            </Modal>
        </div>
    );
};

interface ClientEditModalProps {
    client: Client;
    isOpen: boolean;
    onClose: () => void;
    onSave: (clientData: ClientFormData) => void;
    onDelete: () => void;
    onMarkPaid: (clientData: ClientFormData) => void;
    isSaving: boolean;
    isDeleting: boolean;
    stockProducts: StockProduct[];
    banks: Bank[];
    settings: Settings | null;
}

const ClientEditModal: React.FC<ClientEditModalProps> = (props) => {
    const { client, isOpen, onClose, onSave, onDelete, onMarkPaid, isSaving, isDeleting, stockProducts, banks, settings } = props;
    const [clientData, setClientData] = useState<ClientFormData>(client);
    const [errors, setErrors] = useState<{ dueDate?: string; pixKey?: string; }>({});
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

     useEffect(() => {
        setClientData(client);
    }, [client]);

     // Real-time validation
    useEffect(() => {
        const newErrors: { dueDate?: string; pixKey?: string; } = {};

        // 1. Due Date Validation
        const dueDateString = clientData.payment.dueDate.split('T')[0];
        if (!dueDateString) {
            newErrors.dueDate = 'Data é obrigatória.';
        } else {
            const selectedDate = new Date(dueDateString + 'T00:00:00'); // Normalize to avoid timezone issues
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Normalize to start of day

            if (isNaN(selectedDate.getTime())) {
                newErrors.dueDate = 'Data inválida.';
            } else if (selectedDate < today) {
                newErrors.dueDate = 'A data de vencimento deve ser hoje ou no futuro.';
            }
        }
        
        // 2. PIX Key Validation
        const pixKey = clientData.pixKey || '';
        const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
        const isValidCPF = (cpf: string) => /^\d{11}$/.test(cpf.replace(/[^\d]/g, ''));
        const isValidCNPJ = (cnpj: string) => /^\d{14}$/.test(cnpj.replace(/[^\d]/g, ''));

        if (pixKey && !isValidEmail(pixKey) && !isValidCPF(pixKey) && !isValidCNPJ(pixKey)) {
            newErrors.pixKey = 'Formato inválido. Use E-mail, CPF ou CNPJ.';
        }

        setErrors(newErrors);
    }, [clientData.payment.dueDate, clientData.pixKey]);
    
    const isFormValid = Object.values(errors).every(error => !error);


    const volume = useMemo(() => {
        if (!clientData.poolDimensions) return 0;
        return calculateVolume(
            clientData.poolDimensions.width,
            clientData.poolDimensions.length,
            clientData.poolDimensions.depth
        );
    }, [clientData.poolDimensions]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        let finalValue: any = value;

        if (name.endsWith('.zip')) {
            finalValue = value
                .replace(/\D/g, '')
                .replace(/(\d{5})(\d)/, '$1-$2')
                .slice(0, 9);
        } else if (name === 'payment.dueDate') {
            finalValue = new Date(value + 'T00:00:00').toISOString();
        } else if (type === 'number') {
            finalValue = parseFloat(value) || 0;
        }

        const keys = name.split('.');
        
        setClientData(prev => {
            const newState = JSON.parse(JSON.stringify(prev));
            
            let current: any = newState;
            for (let i = 0; i < keys.length - 1; i++) {
                if (current[keys[i]] === undefined) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = finalValue;
            
            if (name.startsWith('poolDimensions')) {
                 newState.poolVolume = calculateVolume(
                    newState.poolDimensions.width,
                    newState.poolDimensions.length,
                    newState.poolDimensions.depth
                );
            }

            return newState;
        });
    };
    
    const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'Simples') {
            setClientData(prev => ({ ...prev, plan: 'Simples', fidelityPlan: undefined }));
        } else {
            const selectedFidelityPlan = settings?.fidelityPlans.find(fp => fp.id === value);
            if (selectedFidelityPlan) {
                setClientData(prev => ({ ...prev, plan: 'VIP', fidelityPlan: selectedFidelityPlan }));
            }
        }
    };
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setClientData(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleSaveClick = () => {
        onSave(clientData);
    };

    const handleMarkPaidClick = () => {
        onMarkPaid(clientData);
    };

    const handleAutoCalculateDistance = async () => {
        if (!settings) return;

        setIsCalculatingDistance(true);
        try {
            const origin = `${settings.baseAddress.street}, ${settings.baseAddress.number}, ${settings.baseAddress.city} - ${settings.baseAddress.state}`;
            const destination = `${clientData.address.street}, ${clientData.address.number}, ${clientData.address.city} - ${clientData.address.state}`;

            const km = await calculateDrivingDistance(origin, destination);

            if (km >= 0) {
                setClientData(prev => ({ ...prev, distanceFromHq: km }));
                alert(`Distância calculada: ${km} km`);
            } else {
                throw new Error("Erro ao calcular distância.");
            }

        } catch (error: any) {
            console.error(error);
            alert("Erro ao calcular distância automaticamente. Verifique os endereços e tente novamente.");
        } finally {
            setIsCalculatingDistance(false);
        }
    };

    const calculatedFee = useMemo(() => {
        if (!settings) return 0;
        // Use a temporary client object with updated volume for accurate calculation
        const tempClientForCalc = { ...clientData, poolVolume: volume };
        // FORCE GLOBAL PRICING: Pass settings.pricing as the override argument (3rd arg).
        // This ensures that when editing, we see the price based on CURRENT settings,
        // ignoring any 'customPricing' lock the client might have.
        return calculateClientMonthlyFee(tempClientForCalc, settings, settings.pricing);
    }, [clientData, volume, settings]);

    const planOptions = useMemo(() => {
        if (!settings) return [];
        return [
            { value: 'Simples', label: 'Plano Simples' },
            ...settings.fidelityPlans.map(fp => ({
                value: fp.id,
                label: `VIP - Fidelidade ${fp.months} Meses (${fp.discountPercent}%)`
            }))
        ];
    }, [settings]);

    const isAdvancePlanActive = useMemo(() => {
        if (!clientData.advancePaymentUntil) return false;
        const today = new Date();
        const advanceUntilDate = toDate(clientData.advancePaymentUntil);
        return advanceUntilDate && advanceUntilDate > today;
    }, [clientData.advancePaymentUntil]);
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Cliente: ${client.name}`} size="xl">
            <div className="space-y-4">
                {/* Personal Info */}
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Dados Pessoais</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                         <Input label="Nome" name="name" value={clientData.name} onChange={handleChange} />
                         <Input label="Email" name="email" type="email" value={clientData.email} onChange={handleChange} />
                         <Input label="Telefone" name="phone" value={clientData.phone} onChange={handleChange} />
                         <div />
                         <Select 
                            label="Plano" 
                            value={clientData.plan === 'VIP' ? clientData.fidelityPlan?.id : 'Simples'} 
                            onChange={handlePlanChange} 
                            options={planOptions} 
                         />
                         <Select label="Status do Cliente" name="clientStatus" value={clientData.clientStatus} onChange={handleChange} options={[{value: 'Ativo', label: 'Ativo'}, {value: 'Pendente', label: 'Pendente'}]} />
                    </div>
                    <div className="mt-4 border-t pt-4 dark:border-gray-700">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="allowAccessInMaintenance"
                                checked={!!clientData.allowAccessInMaintenance}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium">Permitir acesso durante manutenção (VIP/Admin Override)</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-7">Se marcado, este cliente poderá acessar o aplicativo mesmo quando o "Modo Manutenção" estiver ativado nas configurações gerais.</p>
                    </div>
                </fieldset>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Endereço</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mt-2">
                        <Input
                            containerClassName="sm:col-span-2"
                            label="CEP"
                            name="address.zip"
                            value={clientData.address.zip}
                            onChange={handleChange}
                            placeholder="00000-000"
                            pattern="[0-9]{5}-[0-9]{3}"
                            title="Formato do CEP: 12345-678"
                            maxLength={9}
                        />
                        <Input containerClassName="sm:col-span-4" label="Rua" name="address.street" value={clientData.address.street} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-2" label="Número" name="address.number" value={clientData.address.number} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-4" label="Bairro" name="address.neighborhood" value={clientData.address.neighborhood} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-4" label="Cidade" name="address.city" value={clientData.address.city} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-2" label="UF" name="address.state" value={clientData.address.state} onChange={handleChange} maxLength={2} />
                        
                        <div className="sm:col-span-2 flex items-end gap-2">
                            <Input 
                                label="Distância da Base (Km)" 
                                name="distanceFromHq" 
                                type="number" 
                                value={clientData.distanceFromHq || 0} 
                                onChange={handleChange} 
                                containerClassName="mb-0 flex-grow"
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
                    </div>
                </fieldset>

                {/* Pool & Budget Details */}
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Detalhes da Piscina e Orçamento</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                        <Input label="Largura (m)" name="poolDimensions.width" type="text" inputMode="decimal" value={String(clientData.poolDimensions.width)} onChange={handleChange} />
                        <Input label="Comprimento (m)" name="poolDimensions.length" type="text" inputMode="decimal" value={String(clientData.poolDimensions.length)} onChange={handleChange} />
                        <Input label="Profundidade (m)" name="poolDimensions.depth" type="text" inputMode="decimal" value={String(clientData.poolDimensions.depth)} onChange={handleChange} />
                    </div>
                    {volume > 0 && <p className="text-center mt-2 text-lg font-medium text-secondary-600 dark:text-secondary-400">Volume: {volume.toLocaleString('pt-BR')} litros</p>}
                    <div className="flex gap-4 mt-4">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                name="hasWellWater"
                                checked={clientData.hasWellWater}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Água de poço
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                name="includeProducts"
                                checked={clientData.includeProducts}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Incluir produtos
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                name="isPartyPool"
                                checked={clientData.isPartyPool}
                                onChange={handleCheckboxChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            Piscina para eventos/festa
                        </label>
                    </div>
                </fieldset>


                {/* Pool Status */}
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Status da Piscina</legend>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-2">
                        <Input label="pH" name="poolStatus.ph" type="number" step="0.1" value={clientData.poolStatus.ph} onChange={handleChange}/>
                        <Input label="Cloro" name="poolStatus.cloro" type="number" step="0.1" value={clientData.poolStatus.cloro} onChange={handleChange}/>
                        <Input label="Alcalinidade" name="poolStatus.alcalinidade" type="number" value={clientData.poolStatus.alcalinidade} onChange={handleChange}/>
                        <Select label="Uso" name="poolStatus.uso" value={clientData.poolStatus.uso} onChange={handleChange} options={[{value: 'Livre para uso', label: 'Livre para uso'}, {value: 'Em tratamento', label: 'Em tratamento'}]} />
                        <Input label="Duração da Última Visita (minutos)" name="lastVisitDuration" type="number" value={clientData.lastVisitDuration || 0} onChange={handleChange} />
                    </div>
                </fieldset>
                
                 {/* Payment Info */}
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Pagamento</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <Select
                            label="Banco de Recebimento"
                            name="bankId"
                            value={clientData.bankId || ''}
                            onChange={handleChange}
                            options={[{ value: '', label: 'Nenhum' }, ...banks.map(b => ({ value: b.id, label: b.name }))]}
                        />
                        <Input
                            label="Chave PIX do Cliente (Opcional)"
                            name="pixKey"
                            value={clientData.pixKey || ''}
                            onChange={handleChange}
                            placeholder="Deixe em branco para usar a chave padrão"
                            error={errors.pixKey}
                        />
                        <div className="col-span-2 md:col-span-1">
                            <Input
                                label="Nome do Destinatário (Opcional)"
                                name="pixKeyRecipient"
                                value={clientData.pixKeyRecipient || ''}
                                onChange={handleChange}
                                placeholder="Nome do beneficiário para este cliente"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 items-start">
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Plano de Adiantamento</p>
                                <p>Status: <span className={`font-bold ${isAdvancePlanActive ? 'text-green-500' : 'text-gray-500'}`}>{isAdvancePlanActive ? 'Ativo' : 'Inativo'}</span></p>
                            </div>
                            <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Mensalidade Atual</p>
                                <p>Status: <span className="font-bold">{clientData.payment.status}</span></p>
                                <p>Valor (calculado): <span className="font-bold text-lg text-primary-600">R$ {calculatedFee.toFixed(2)}</span></p>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <Input
                                label="Próximo Vencimento"
                                name="payment.dueDate"
                                type="date"
                                value={clientData.payment.dueDate.split('T')[0]}
                                onChange={handleChange}
                                containerClassName="mb-0"
                                error={errors.dueDate}
                            />
                            <div className="flex justify-end pt-5">
                                <Button onClick={handleMarkPaidClick} isLoading={isSaving} disabled={clientData.payment.status === 'Pago'}>
                                    Marcar como Pago
                                </Button>
                            </div>
                        </div>
                    </div>
                </fieldset>
                
                {/* Client Stock */}
                <ClientStockManager stock={clientData.stock} allStockProducts={stockProducts} onStockChange={(newStock) => setClientData(prev => ({...prev, stock: newStock}))} />

                {/* Visit History */}
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Histórico de Visitas</legend>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2 mt-2">
                        {(clientData.visitHistory && clientData.visitHistory.length > 0) ? [...clientData.visitHistory].sort((a, b) => (toDate(b.timestamp)?.getTime() || 0) - (toDate(a.timestamp)?.getTime() || 0)).map(visit => (
                            <div key={visit.id} className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                                <p className="font-semibold text-sm">
                                    {toDate(visit.timestamp)?.toLocaleString('pt-BR')} por {visit.technicianName}
                                </p>
                                <p className="text-xs">pH: {visit.ph} | Cloro: {visit.cloro} | Alc: {visit.alcalinidade} | Uso: {visit.uso}</p>
                                {visit.notes && <p className="mt-1 text-sm italic">"{visit.notes}"</p>}
                                {visit.photoUrl && <a href={visit.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-500 hover:underline mt-1 inline-block">Ver Foto</a>}
                            </div>
                        )) : <p className="text-gray-500">Nenhuma visita registrada.</p>}
                    </div>
                </fieldset>
            </div>
            <div className="mt-6 flex justify-between">
                <Button variant="danger" onClick={onDelete} isLoading={isDeleting}>
                    Excluir Cliente
                </Button>
                <div className="flex space-x-2">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSaveClick} isLoading={isSaving} disabled={!isFormValid}>Salvar Alterações</Button>
                </div>
            </div>
        </Modal>
    )
}

export default ClientsView;