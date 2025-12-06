import React, { useState } from 'react';
import { AppContextType, StockProduct } from '../../types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { EditIcon, TrashIcon, PlusIcon } from '../../constants';
import { Select } from '../../components/Select';

interface StockProductsViewProps {
    appContext: AppContextType;
}

const StockProductsView: React.FC<StockProductsViewProps> = ({ appContext }) => {
    const { stockProducts, loading, saveStockProduct, deleteStockProduct, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<StockProduct | Omit<StockProduct, 'id'> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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

    const handleDelete = async (productId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este item de estoque? Isso não afetará o estoque já registrado nos clientes.')) {
            try {
                await deleteStockProduct(productId);
                showNotification('Item excluído com sucesso!', 'success');
            } catch (error: any) {
                showNotification(error.message || 'Erro ao excluir item.', 'error');
            }
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
                Gerencie a lista de produtos que podem ser adicionados ao estoque de cada cliente. Estes itens são usados para acompanhamento e reposição.
            </p>
            {loading.stockProducts ? <div className="flex justify-center"><Spinner /></div> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                         <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unidade</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {stockProducts.map(product => (
                                <tr key={product.id}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">{product.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{product.unit}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => handleOpenModal(product)}><EditIcon className="w-4 h-4" /></Button>
                                            <Button size="sm" variant="danger" onClick={() => handleDelete(product.id)}><TrashIcon className="w-4 h-4" /></Button>
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
