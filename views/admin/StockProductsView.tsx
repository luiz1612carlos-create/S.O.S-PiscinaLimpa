
import React, { useState, useMemo } from 'react';
import { AppContextType, StockProduct } from '../../types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { EditIcon, TrashIcon, PlusIcon, XMarkIcon } from '../../constants';
import { Select } from '../../components/Select';

interface StockProductsViewProps {
    appContext: AppContextType;
}

const StockProductsView: React.FC<StockProductsViewProps> = ({ appContext }) => {
    const { stockProducts, clients, loading, saveStockProduct, deleteStockProduct, removeStockProductFromAllClients, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<StockProduct | Omit<StockProduct, 'id'> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isCleaning, setIsCleaning] = useState<string | null>(null);

    const usageMap = useMemo(() => {
        const map: { [key: string]: number } = {};
        clients.forEach(client => {
            client.stock.forEach(item => {
                map[item.productId] = (map[item.productId] || 0) + 1;
            });
        });
        return map;
    }, [clients]);

    const handleOpenModal = (product: StockProduct | null = null) => {
        if (product) {
            setSelectedProduct(product);
        } else {
            setSelectedProduct({ name: '', description: '', unit: 'un' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
    };

    const handleSave = async () => {
        if (!selectedProduct) return;
        setIsSaving(true);
        try {
            await saveStockProduct(selectedProduct);
            showNotification('Item de estoque salvo com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar item.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGlobalWipe = async (productId: string, productName: string) => {
        const count = usageMap[productId] || 0;
        if (count === 0) {
            showNotification('Este produto não está registrado em nenhum cliente.', 'info');
            return;
        }

        if (window.confirm(`Você tem certeza que deseja REMOVER o item "${productName}" do estoque de TODOS os ${count} clientes que o possuem?\n\nEsta ação é irreversível e afetará o controle de reposição desses clientes.`)) {
            setIsCleaning(productId);
            try {
                const removedCount = await removeStockProductFromAllClients(productId);
                showNotification(`Sucesso! O item foi removido do estoque de ${removedCount} clientes.`, 'success');
            } catch (error: any) {
                showNotification(error.message || 'Erro ao realizar limpeza global.', 'error');
            } finally {
                setIsCleaning(null);
            }
        }
    };

    const handleDelete = async (productId: string, productName: string) => {
        const count = usageMap[productId] || 0;
        let cleanup = false;

        if (count > 0) {
            const choice = window.confirm(`O item "${productName}" está sendo usado por ${count} clientes.\n\nDeseja também REMOVER este item do estoque desses clientes ao excluí-lo do Estoque Mestre?\n\n[OK] Sim, limpar tudo\n[Cancelar] Não, apenas excluir do mestre (os clientes manterão o registro órfão)`);
            cleanup = choice;
        } else {
            if (!window.confirm(`Tem certeza que deseja excluir o item "${productName}" do Estoque Mestre?`)) return;
        }

        try {
            await deleteStockProduct(productId, cleanup);
            showNotification('Item excluído com sucesso!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao excluir item.', 'error');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Estoque Mestre</h2>
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Adicionar Item
                </Button>
            </div>
            <p className="mb-6 text-gray-600 dark:text-gray-400">
                Gerencie a lista de produtos que podem ser adicionados ao estoque de cada cliente. Você pode monitorar em quantos clientes cada item está presente e realizar limpezas em lote.
            </p>
            {loading.stockProducts ? <div className="flex justify-center"><Spinner /></div> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                         <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Uso (Clientes)</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {stockProducts.map(product => (
                                <tr key={product.id}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                                        {product.name}
                                        <p className="text-xs text-gray-400 font-normal">{product.description}</p>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">{product.unit}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center font-bold">
                                        <span className={`px-2 py-1 rounded-full text-xs ${usageMap[product.id] ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-400'}`}>
                                            {usageMap[product.id] || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Button 
                                                size="sm" 
                                                variant="secondary" 
                                                onClick={() => handleGlobalWipe(product.id, product.name)}
                                                isLoading={isCleaning === product.id}
                                                disabled={!usageMap[product.id]}
                                                title="Remover este item do estoque de todos os clientes"
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleOpenModal(product)}><EditIcon className="w-4 h-4" /></Button>
                                            <Button size="sm" variant="danger" onClick={() => handleDelete(product.id, product.name)}><TrashIcon className="w-4 h-4" /></Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {isModalOpen && selectedProduct && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in selectedProduct ? 'Editar Item' : 'Adicionar Item'}>
                    <StockProductForm product={selectedProduct} setProduct={setSelectedProduct} />
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSave} isLoading={isSaving}>Salvar</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const StockProductForm = ({ product, setProduct }: { product: any, setProduct: any }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const unitOptions = [
        { value: 'un', label: 'Unidade (un)' },
        { value: 'L', label: 'Litro (L)' },
        { value: 'kg', label: 'Quilograma (kg)' },
        { value: 'm', label: 'Metro (m)' },
        { value: 'm²', label: 'Metro Quadrado (m²)' },
        { value: 'pastilha', label: 'Pastilha' },
    ];

    return (
        <div className="space-y-4">
            <Input label="Nome do Item" name="name" value={product.name} onChange={handleChange} required />
            <Input label="Descrição" name="description" value={product.description} onChange={handleChange} />
            <Select label="Unidade de Medida" name="unit" value={product.unit} onChange={handleChange} options={unitOptions} />
        </div>
    );
}

export default StockProductsView;
