
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
import { SparklesIcon, CheckBadgeIcon } from '../../constants';

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

interface ClientFormData extends Omit<Client, 'poolDimensions'> {
    poolDimensions: {
        width: string | number;
        length: string | number;
        depth: string | number;
    }
}


const ClientsView: React.FC<ClientsViewProps> = ({ appContext }) => {
    const { clients, loading, products, banks, updateClient, deleteClient, markAsPaid, showNotification, settings, stockProducts, cancelScheduledPlanChange } = appContext;
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
            let volume = clientData.poolVolume;
            const calculated = calculateVolume(
                clientData.poolDimensions.width,
                clientData.poolDimensions.length,
                clientData.poolDimensions.depth
            );
            
            if (calculated > 0) {
                volume = calculated;
            }

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
        const confirmationMessage = `Tem certeza que deseja excluir ${selectedClient?.name}?\n\nEsta ação removerá os dados do cliente, mas NÃO a sua conta de login.`;
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

        const clientToPay: Client = {
            ...clientData,
            poolDimensions: {
                width: normalizeDimension(clientData.poolDimensions.width),
                length: normalizeDimension(clientData.poolDimensions.length),
                depth: normalizeDimension(clientData.poolDimensions.depth),
            }
        };
    
        const fee = calculateClientMonthlyFee(clientToPay, settings);
        if (!window.confirm(`Confirma o pagamento da mensalidade de R$ ${fee.toFixed(2)} para ${clientToPay.name}? Isso também avançará a data de vencimento em 1 mês.`)) return;
    
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
        e.stopPropagation();
        if (!settings) return;
        setSelectedClientForAnnouncement(client);
        let template = settings.announcementMessageTemplate || "Atenção {CLIENTE}!\n\nLogin: {LOGIN}";
        const message = template.replace(/{CLIENTE}/g, client.name).replace(/{LOGIN}/g, client.email).replace(/{SENHA}/g, "********");
        setAnnouncementMessage(message);
        setIsAnnouncementModalOpen(true);
    };

    const handleSendAnnouncement = () => {
        if (!selectedClientForAnnouncement) return;
        const phone = selectedClientForAnnouncement.phone.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(announcementMessage);
        window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
        setIsAnnouncementModalOpen(false);
    };

    const isAdvancePlanActive = (client: Client): boolean => {
        if (!client.advancePaymentUntil) return false;
        const today = new Date();
        const advanceUntilDate = toDate(client.advancePaymentUntil);
        return advanceUntilDate && advanceUntilDate > today;
    };

    const handleCancelScheduledChange = async () => {
        if (!selectedClient) return;
        setIsSaving(true);
        try {
            await cancelScheduledPlanChange(selectedClient.id);
            showNotification('Mudança de plano cancelada!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao cancelar mudança.', 'error');
        } finally {
            setIsSaving(false);
        }
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
                                <Button size="sm" variant="light" className="shadow-md !p-2" onClick={(e) => handleOpenAnnouncement(e, client)} title="Enviar Aviso/Anúncio">
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
                    onCancelScheduledChange={handleCancelScheduledChange}
                    isSaving={isSaving}
                    isDeleting={isDeleting}
                    stockProducts={stockProducts}
                    banks={banks}
                    settings={settings}
                />
            )}
            
            <Modal isOpen={isAnnouncementModalOpen} onClose={() => setIsAnnouncementModalOpen(false)} title={`Enviar Aviso para ${selectedClientForAnnouncement?.name}`}
                footer={<><Button variant="secondary" onClick={() => setIsAnnouncementModalOpen(false)}>Cancelar</Button><Button onClick={handleSendAnnouncement}>Enviar via WhatsApp</Button></>}>
                <div className="space-y-4">
                    <textarea value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} rows={10} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
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
    onCancelScheduledChange: () => void;
    isSaving: boolean;
    isDeleting: boolean;
    stockProducts: StockProduct[];
    banks: Bank[];
    settings: Settings | null;
}

const ClientEditModal: React.FC<ClientEditModalProps> = (props) => {
    const { client, isOpen, onClose, onSave, onDelete, onMarkPaid, onCancelScheduledChange, isSaving, isDeleting, stockProducts, banks, settings } = props;
    const [clientData, setClientData] = useState<ClientFormData>(client);
    const [errors, setErrors] = useState<{ dueDate?: string; pixKey?: string; }>({});
    const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

     useEffect(() => {
        setClientData(client);
    }, [client]);

    useEffect(() => {
        const newErrors: { dueDate?: string; pixKey?: string; } = {};
        const dueDateString = clientData.payment.dueDate.split('T')[0];
        if (!dueDateString) {
            newErrors.dueDate = 'Data é obrigatória.';
        } else {
            const selectedDate = new Date(dueDateString + 'T00:00:00');
            // Allow editing past dates in case of errors
            if (isNaN(selectedDate.getTime())) {
                newErrors.dueDate = 'Data inválida.';
            }
        }
        setErrors(newErrors);
    }, [clientData.payment.dueDate, clientData.pixKey]);
    
    const isFormValid = Object.values(errors).every(error => !error);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        let finalValue: any = value;

        if (name.endsWith('.zip')) {
            finalValue = value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
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
                if (current[keys[i]] === undefined) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = finalValue;
            
            if (name.startsWith('poolDimensions')) {
                 const calc = calculateVolume(
                    newState.poolDimensions.width,
                    newState.poolDimensions.length,
                    newState.poolDimensions.depth
                );
                if (calc > 0) {
                    newState.poolVolume = calc;
                }
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
        setClientData(prev => ({ ...prev, [name]: checked }));
    };

    const handleAutoCalculateDistance = async () => {
        if (!settings) return;
        setIsCalculatingDistance(true);
        try {
            const origin = `${settings.baseAddress.street}, ${settings.baseAddress.number}, ${settings.baseAddress.city}`;
            const destination = `${clientData.address.street}, ${clientData.address.number}, ${clientData.address.city}`;
            const km = await calculateDrivingDistance(origin, destination);
            if (km >= 0) {
                setClientData(prev => ({ ...prev, distanceFromHq: km }));
                alert(`Distância: ${km} km`);
            }
        } catch (error: any) {
            alert("Erro ao calcular distância.");
        } finally {
            setIsCalculatingDistance(false);
        }
    };

    const calculatedFee = useMemo(() => {
        if (!settings) return 0;
        return calculateClientMonthlyFee(clientData, settings, settings.pricing);
    }, [clientData, settings]);

    const planOptions = useMemo(() => {
        if (!settings) return [];
        return [
            { value: 'Simples', label: 'Plano Simples' },
            ...settings.fidelityPlans.map(fp => ({
                value: fp.id,
                label: `VIP - ${fp.months} Meses (${fp.discountPercent}%)`
            }))
        ];
    }, [settings]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Editar Cliente: ${client.name}`} size="xl">
            <div className="space-y-4">
                {client.scheduledPlanChange && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-md mb-4 flex justify-between items-start">
                        <div>
                            <p className="font-bold text-yellow-800 dark:text-yellow-200 flex items-center"><CheckBadgeIcon className="w-5 h-5 mr-2" /> Mudança Agendada</p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">Novo Plano: <strong>{client.scheduledPlanChange.newPlan}</strong> (R$ {client.scheduledPlanChange.newPrice.toFixed(2)})</p>
                        </div>
                        <Button variant="danger" size="sm" onClick={onCancelScheduledChange} isLoading={isSaving}>Desativar</Button>
                    </div>
                )}

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Dados Pessoais</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                         <Input label="Nome" name="name" value={clientData.name} onChange={handleChange} />
                         <Input label="Email" name="email" type="email" value={clientData.email} onChange={handleChange} />
                         <Input label="Telefone" name="phone" value={clientData.phone} onChange={handleChange} />
                         <Select label="Plano Atual" value={clientData.plan === 'VIP' ? clientData.fidelityPlan?.id : 'Simples'} onChange={handlePlanChange} options={planOptions} />
                         <Select label="Status" name="clientStatus" value={clientData.clientStatus} onChange={handleChange} options={[{value: 'Ativo', label: 'Ativo'}, {value: 'Pendente', label: 'Pendente'}]} />
                    </div>
                </fieldset>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Endereço</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mt-2">
                        <Input containerClassName="sm:col-span-2" label="CEP" name="address.zip" value={clientData.address.zip} onChange={handleChange} maxLength={9} />
                        <Input containerClassName="sm:col-span-4" label="Rua" name="address.street" value={clientData.address.street} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-2" label="Número" name="address.number" value={clientData.address.number} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-4" label="Bairro" name="address.neighborhood" value={clientData.address.neighborhood} onChange={handleChange} />
                        <Input containerClassName="sm:col-span-4" label="Cidade" name="address.city" value={clientData.address.city} onChange={handleChange} />
                        <div className="sm:col-span-2 flex items-end gap-2">
                            <Input label="Distância (Km)" name="distanceFromHq" type="number" value={clientData.distanceFromHq || 0} onChange={handleChange} containerClassName="mb-0 flex-grow" />
                            <Button type="button" onClick={handleAutoCalculateDistance} isLoading={isCalculatingDistance} variant="secondary" title="Mapa"><SparklesIcon className="w-5 h-5 text-purple-600" /></Button>
                        </div>
                    </div>
                </fieldset>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Detalhes da Piscina e Orçamento</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-2">
                        <Input label="Largura (m)" name="poolDimensions.width" type="text" inputMode="decimal" value={String(clientData.poolDimensions.width)} onChange={handleChange} />
                        <Input label="Comprim. (m)" name="poolDimensions.length" type="text" inputMode="decimal" value={String(clientData.poolDimensions.length)} onChange={handleChange} />
                        <Input label="Profund. (m)" name="poolDimensions.depth" type="text" inputMode="decimal" value={String(clientData.poolDimensions.depth)} onChange={handleChange} />
                        <Input label="Volume Manual (L)" name="poolVolume" type="number" value={clientData.poolVolume} onChange={handleChange} />
                    </div>
                    <p className="text-center mt-2 text-lg font-bold text-secondary-600 dark:text-secondary-400">Volume Atual: {clientData.poolVolume.toLocaleString('pt-BR')} litros</p>
                    <div className="flex gap-4 mt-4 flex-wrap">
                        <label className="flex items-center gap-3"><input type="checkbox" name="hasWellWater" checked={clientData.hasWellWater} onChange={handleCheckboxChange} className="h-4 w-4 rounded" />Água de poço</label>
                        <label className="flex items-center gap-3"><input type="checkbox" name="includeProducts" checked={clientData.includeProducts} onChange={handleCheckboxChange} className="h-4 w-4 rounded" />Incluir produtos</label>
                        <label className="flex items-center gap-3"><input type="checkbox" name="isPartyPool" checked={clientData.isPartyPool} onChange={handleCheckboxChange} className="h-4 w-4 rounded" />Piscina para eventos</label>
                    </div>
                </fieldset>

                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Status da Piscina</legend>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <Input label="pH" name="poolStatus.ph" type="number" step="0.1" value={clientData.poolStatus.ph} onChange={handleChange}/>
                        <Input label="Cloro" name="poolStatus.cloro" type="number" step="0.1" value={clientData.poolStatus.cloro} onChange={handleChange}/>
                        <Input label="Alcalinid." name="poolStatus.alcalinidade" type="number" value={clientData.poolStatus.alcalinidade} onChange={handleChange}/>
                        <Select label="Uso" name="poolStatus.uso" value={clientData.poolStatus.uso} onChange={handleChange} options={[{value: 'Livre para uso', label: 'Livre'}, {value: 'Em tratamento', label: 'Tratamento'}]} />
                    </div>
                </fieldset>
                
                <fieldset className="border p-4 rounded-md dark:border-gray-600">
                    <legend className="px-2 font-semibold">Pagamento</legend>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select label="Banco" name="bankId" value={clientData.bankId || ''} onChange={handleChange} options={[{ value: '', label: 'Nenhum' }, ...banks.map(b => ({ value: b.id, label: b.name }))]} />
                        <Select label="Status de Pagamento" name="payment.status" value={clientData.payment.status} onChange={handleChange} options={[{value: 'Pago', label: 'Pago'}, {value: 'Pendente', label: 'Pendente'}, {value: 'Atrasado', label: 'Atrasado'}]} />
                        <Input label="Próximo Vencimento" name="payment.dueDate" type="date" value={clientData.payment.dueDate.split('T')[0]} onChange={handleChange} error={errors.dueDate} />
                    </div>
                    <div className="flex justify-between items-center mt-4 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                        <div>
                            <p className="text-sm font-semibold">Valor Mensal Estimado:</p>
                            <p className="text-2xl font-bold text-primary-600">R$ {calculatedFee.toFixed(2)}</p>
                        </div>
                        <Button 
                            onClick={() => onMarkPaid(clientData)} 
                            isLoading={isSaving} 
                            variant={clientData.payment.status === 'Pago' ? 'secondary' : 'primary'}
                        >
                            Registrar Pagamento de Ciclo
                        </Button>
                    </div>
                    {clientData.payment.status === 'Pago' && (
                        <p className="text-xs text-center text-gray-500 mt-2">Dica: Para reverter o status, use o campo "Status de Pagamento" acima e salve as alterações.</p>
                    )}
                </fieldset>
                
                <ClientStockManager stock={clientData.stock} allStockProducts={stockProducts} onStockChange={(newStock) => setClientData(prev => ({...prev, stock: newStock}))} />
            </div>
            <div className="mt-6 flex justify-between">
                <Button variant="danger" onClick={onDelete} isLoading={isDeleting}>Excluir Cliente</Button>
                <div className="flex space-x-2">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={() => onSave(clientData)} isLoading={isSaving} disabled={!isFormValid}>Salvar Alterações</Button>
                </div>
            </div>
        </Modal>
    );
};

export default ClientsView;
