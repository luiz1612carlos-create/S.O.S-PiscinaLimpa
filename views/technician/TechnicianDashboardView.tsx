

import React, { useState, useMemo, useEffect } from 'react';
import { AppContextType, Client, PoolUsageStatus, Visit, ClientProduct, StockProduct } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { PlusIcon, XMarkIcon } from '../../constants';
import { ClientStockManager } from '../../components/ClientStockManager';

interface TechnicianDashboardViewProps {
    appContext: AppContextType;
}

const formatAddress = (address: Client['address']) => {
    if (!address) return 'N/A';
    return `${address.street}, ${address.number} - ${address.city}`;
};

const TechnicianDashboardView: React.FC<TechnicianDashboardViewProps> = ({ appContext }) => {
    const { clients, loading, addVisitRecord, showNotification, products, updateClientStock, stockProducts } = appContext;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const filteredClients = useMemo(() => {
        if (!clients) return [];
        return clients
            .filter(c => c.clientStatus === 'Ativo')
            .filter(client =>
                client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (client.address.street && client.address.street.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (client.address.city && client.address.city.toLowerCase().includes(searchTerm.toLowerCase()))
            );
    }, [clients, searchTerm]);

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Meus Clientes</h2>
            <div className="mb-6">
                <Input
                    label="Buscar Cliente (nome, rua, cidade...)"
                    placeholder="Digite para buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {loading.clients ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredClients.map(client => (
                        <Card key={client.id} className="cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300" onClick={() => setSelectedClient(client)}>
                            <CardHeader>
                                <h3 className="text-lg font-semibold truncate">{client.name}</h3>
                                <p className={`text-sm font-bold ${client.plan === 'VIP' ? 'text-yellow-500' : 'text-blue-500'}`}>
                                    {client.plan}
                                </p>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{formatAddress(client.address)}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{client.phone}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {selectedClient && (
                <ClientVisitModal
                    key={selectedClient.id} // Re-mount modal when client changes to ensure fresh state
                    client={selectedClient}
                    isOpen={!!selectedClient}
                    onClose={() => setSelectedClient(null)}
                    addVisitRecord={addVisitRecord}
                    showNotification={showNotification}
                    allStockProducts={stockProducts}
                    updateClientStock={updateClientStock}
                />
            )}
        </div>
    );
};

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

interface ClientVisitModalProps {
    client: Client;
    isOpen: boolean;
    onClose: () => void;
    addVisitRecord: AppContextType['addVisitRecord'];
    showNotification: AppContextType['showNotification'];
    allStockProducts: AppContextType['stockProducts'];
    updateClientStock: AppContextType['updateClientStock'];
}

const ClientVisitModal: React.FC<ClientVisitModalProps> = ({ client, isOpen, onClose, addVisitRecord, showNotification, allStockProducts, updateClientStock }) => {
    const [isAddingVisit, setIsAddingVisit] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingStock, setIsSavingStock] = useState(false);
    
    // Form state initialized directly from props. This is safe because the component re-mounts on client change.
    const [ph, setPh] = useState(client.poolStatus.ph.toString());
    const [cloro, setCloro] = useState(client.poolStatus.cloro.toString());
    const [alcalinidade, setAlcalinidade] = useState(client.poolStatus.alcalinidade.toString());
    const [uso, setUso] = useState<PoolUsageStatus>(client.poolStatus.uso);
    const [notes, setNotes] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [stockData, setStockData] = useState<ClientProduct[]>(client.stock || []);
    const [fileInputKey, setFileInputKey] = useState(Date.now());
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            // Ensure state is cleared if user cancels file selection
            setPhotoFile(null);
            setPhotoPreview(null);
        }
    };

    const resetForm = () => {
        setIsAddingVisit(false);
        // Reset to client's current status
        setPh(client.poolStatus.ph.toString());
        setCloro(client.poolStatus.cloro.toString());
        setAlcalinidade(client.poolStatus.alcalinidade.toString());
        setUso(client.poolStatus.uso);
        setNotes('');
        setPhotoFile(null);
        setPhotoPreview(null);
        setFileInputKey(Date.now()); // Force file input to reset
    };

    const handleSubmitVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        if (photoFile) {
            setUploadProgress(0);
        }
        try {
            const visitData: Omit<Visit, 'id' | 'photoUrl' | 'timestamp' | 'technicianId' | 'technicianName'> = {
                ph: parseFloat(ph) || 0,
                cloro: parseFloat(cloro) || 0,
                alcalinidade: parseInt(alcalinidade) || 0,
                uso,
                notes,
            };
            await addVisitRecord(client.id, visitData, photoFile || undefined, (progress) => {
                setUploadProgress(progress);
            });
            showNotification('Visita registrada com sucesso!', 'success');
            onClose(); // Close modal on success
        } catch (error: any) {
            showNotification(error.message || 'Erro ao registrar visita.', 'error');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(null);
        }
    };

    const handleSaveStock = async () => {
        setIsSavingStock(true);
        try {
            await updateClientStock(client.id, stockData);
            showNotification('Estoque do cliente atualizado com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Falha ao atualizar o estoque.', 'error');
        } finally {
            setIsSavingStock(false);
        }
    };
    
    const sortedVisits = useMemo(() => {
        if (!client.visitHistory) return [];
        return [...client.visitHistory].sort((a, b) => {
            const dateA = toDate(a.timestamp);
            const dateB = toDate(b.timestamp);
            if (!dateA || !dateB) return 0;
            return dateB.getTime() - dateA.getTime();
        });
    }, [client.visitHistory]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Cliente: ${client.name}`} size="xl">
            <div className="space-y-4">
                <p><strong>Endereço:</strong> {formatAddress(client.address)}</p>

                {isAddingVisit ? (
                    <form onSubmit={handleSubmitVisit}>
                        <h3 className="text-lg font-semibold mb-2">Registrar Nova Visita</h3>
                        <fieldset className="border p-4 rounded-md dark:border-gray-600 space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Input label="pH" value={ph} onChange={e => setPh(e.target.value)} type="number" step="0.1" required />
                                <Input label="Cloro" value={cloro} onChange={e => setCloro(e.target.value)} type="number" step="0.1" required />
                                <Input label="Alcalinidade" value={alcalinidade} onChange={e => setAlcalinidade(e.target.value)} type="number" required />
                                <Select label="Uso" value={uso} onChange={e => setUso(e.target.value as PoolUsageStatus)} options={[{ value: 'Livre para uso', label: 'Livre' }, { value: 'Em tratamento', label: 'Tratamento' }]} containerClassName="mb-0"/>
                            </div>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." rows={3} className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                            <Input key={fileInputKey} label="Foto da Piscina (Opcional)" type="file" accept="image/*" onChange={handlePhotoChange} />
                            {photoPreview && (
                                <div className="relative w-32 h-32">
                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover rounded-md" />
                                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); setFileInputKey(Date.now()); }} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </fieldset>
                         {uploadProgress !== null && (
                            <div className="my-2">
                                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                    <div 
                                        className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" 
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    Enviando foto... {Math.round(uploadProgress)}%
                                </p>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="secondary" onClick={resetForm} disabled={isSubmitting}>Cancelar</Button>
                            <Button type="submit" isLoading={isSubmitting && !photoFile} disabled={isSubmitting}>Salvar Visita</Button>
                        </div>
                    </form>
                ) : (
                    <>
                        <Button onClick={() => setIsAddingVisit(true)} className="w-full">
                            <PlusIcon className="w-5 h-5 mr-2" /> Registrar Nova Visita
                        </Button>

                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-semibold">Estoque do Cliente</h3>
                                <Button onClick={handleSaveStock} isLoading={isSavingStock} size="sm">
                                    Salvar Estoque
                                </Button>
                            </div>
                            <ClientStockManager
                                stock={stockData}
                                allStockProducts={allStockProducts}
                                onStockChange={setStockData}
                            />
                        </div>

                        <div className="mt-4">
                            <h3 className="text-lg font-semibold mb-2">Histórico de Visitas</h3>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                {sortedVisits.length > 0 ? sortedVisits.map(visit => (
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
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default TechnicianDashboardView;