import React, { useState } from 'react';
import { AppContextType, Product, Order, OrderStatus, ReplenishmentQuote } from '../../types';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Spinner } from '../../components/Spinner';
import { EditIcon, TrashIcon, PlusIcon, CheckIcon, XMarkIcon } from '../../constants';
import { Select } from '../../components/Select';
import { Card, CardContent, CardHeader } from '../../components/Card';

interface StoreAdminViewProps {
    appContext: AppContextType;
}

// Helper function to safely convert Firestore timestamps or strings to Date objects
const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) return d;
    }
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};

const StoreAdminView: React.FC<StoreAdminViewProps> = ({ appContext }) => {
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'replenishment'>('products');

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Gerenciamento da Loja</h2>
            <div className="flex border-b dark:border-gray-700 mb-6">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`py-2 px-4 text-lg font-semibold ${activeTab === 'products' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Produtos
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`py-2 px-4 text-lg font-semibold ${activeTab === 'orders' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Pedidos
                </button>
                 <button
                    onClick={() => setActiveTab('replenishment')}
                    className={`py-2 px-4 text-lg font-semibold relative ${activeTab === 'replenishment' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
                >
                    Sugestões de Reposição
                    {appContext.replenishmentQuotes.filter(q => q.status === 'suggested').length > 0 && (
                        <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{appContext.replenishmentQuotes.filter(q => q.status === 'suggested').length}</span>
                    )}
                </button>
            </div>
            {activeTab === 'products' && <ProductsManagement appContext={appContext} />}
            {activeTab === 'orders' && <OrdersManagement appContext={appContext} />}
            {activeTab === 'replenishment' && <ReplenishmentManagement appContext={appContext} />}
        </div>
    );
};

const ReplenishmentManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { replenishmentQuotes, loading, updateReplenishmentQuoteStatus, showNotification } = appContext;
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    const handleSend = async (quoteId: string) => {
        setProcessingId(quoteId);
        try {
            await updateReplenishmentQuoteStatus(quoteId, 'sent');
            showNotification('Sugestão enviada ao cliente!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao enviar sugestão.', 'error');
        } finally {
            setProcessingId(null);
        }
    };
    
    const handleDiscard = async (quoteId: string) => {
        setProcessingId(quoteId);
        try {
            await updateReplenishmentQuoteStatus(quoteId, 'rejected');
            showNotification('Sugestão descartada.', 'info');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao descartar sugestão.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const suggestedQuotes = replenishmentQuotes.filter(q => q.status === 'suggested');

    return (
        <div>
             {loading.replenishmentQuotes ? (
                <div className="flex justify-center mt-8"><Spinner size="lg" /></div>
            ) : suggestedQuotes.length === 0 ? (
                <p>Nenhuma sugestão de reposição gerada no momento.</p>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {suggestedQuotes.map(quote => (
                        <Card key={quote.id}>
                            <CardHeader>
                                <h3 className="text-xl font-semibold">{quote.clientName}</h3>
                                <p className="text-sm text-gray-500">Sugestão de Reposição</p>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {quote.items.map(item => (
                                        <li key={item.id} className="flex justify-between">
                                            <span>{item.name} x {item.quantity}</span>
                                            <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-4 pt-2 border-t dark:border-gray-700 text-right">
                                    <p className="font-bold text-lg">Total: R$ {quote.total.toFixed(2)}</p>
                                </div>
                            </CardContent>
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
                                <Button size="sm" variant="danger" onClick={() => handleDiscard(quote.id)} isLoading={processingId === quote.id} disabled={!!processingId}>
                                    <XMarkIcon className="w-4 h-4 mr-1"/> Descartar
                                </Button>
                                <Button size="sm" onClick={() => handleSend(quote.id)} isLoading={processingId === quote.id} disabled={!!processingId}>
                                    <CheckIcon className="w-4 h-4 mr-1"/> Enviar ao Cliente
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};


const ProductsManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { products, loading, saveProduct, deleteProduct, showNotification } = appContext;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | Omit<Product, 'id'> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleOpenModal = (product: Product | null = null) => {
        if (product) {
            setSelectedProduct(product);
        } else {
            setSelectedProduct({ name: '', description: '', price: 0, stock: 0, imageUrl: `https://picsum.photos/400/300?random=${Date.now()}` });
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
            await saveProduct(selectedProduct);
            showNotification('Produto salvo com sucesso!', 'success');
            handleCloseModal();
        } catch (error: any) {
            showNotification(error.message || 'Erro ao salvar produto.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (productId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este produto?')) {
            try {
                await deleteProduct(productId);
                showNotification('Produto excluído com sucesso!', 'success');
            } catch (error: any) {
                showNotification(error.message || 'Erro ao excluir produto.', 'error');
            }
        }
    };

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Adicionar Produto
                </Button>
            </div>
            {loading.products ? <Spinner /> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {products.map(product => (
                        <div key={product.id} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                            <img src={product.imageUrl} alt={product.name} className="h-48 w-full object-cover" />
                            <div className="p-4">
                                <h3 className="font-bold text-lg">{product.name}</h3>
                                <p className="text-gray-600 dark:text-gray-400 text-sm">{product.description}</p>
                                <p className="text-primary-500 font-bold mt-2">R$ {product.price.toFixed(2)}</p>
                                <p className="text-sm">Estoque: {product.stock}</p>
                            </div>
                            <div className="p-2 bg-gray-50 dark:bg-gray-700 flex justify-end gap-2">
                                <Button size="sm" variant="secondary" onClick={() => handleOpenModal(product)}><EditIcon className="w-4 h-4" /></Button>
                                <Button size="sm" variant="danger" onClick={() => handleDelete(product.id)}><TrashIcon className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
             {isModalOpen && selectedProduct && (
                <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={'id' in selectedProduct ? 'Editar Produto' : 'Adicionar Produto'}>
                    <ProductForm product={selectedProduct} setProduct={setSelectedProduct} />
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
                        <Button onClick={handleSave} isLoading={isSaving}>Salvar</Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const ProductForm = ({ product, setProduct }: { product: any, setProduct: any }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setProduct({ ...product, [name]: type === 'number' ? parseFloat(value) : value });
    };

    return (
        <div className="space-y-4">
            <Input label="Nome do Produto" name="name" value={product.name} onChange={handleChange} />
            <Input label="Descrição" name="description" value={product.description} onChange={handleChange} />
            <Input label="Preço" name="price" type="number" step="0.01" value={product.price} onChange={handleChange} />
            <Input label="Estoque" name="stock" type="number" value={product.stock} onChange={handleChange} />
            <Input label="URL da Imagem" name="imageUrl" value={product.imageUrl} onChange={handleChange} />
        </div>
    );
}


const OrdersManagement = ({ appContext }: { appContext: AppContextType }) => {
    const { orders, loading, updateOrderStatus, showNotification } = appContext;
    
    const handleStatusChange = async (orderId: string, status: OrderStatus) => {
        try {
            await updateOrderStatus(orderId, status);
            showNotification('Status do pedido atualizado!', 'success');
        } catch (error: any) {
            showNotification(error.message || 'Erro ao atualizar status.', 'error');
        }
    };
    
    return (
        <div>
            {loading.orders ? <Spinner /> : (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {orders.map(order => (
                                <tr key={order.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{order.clientName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">R$ {order.total.toFixed(2)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{toDate(order.createdAt)?.toLocaleDateString() || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Select 
                                            label=""
                                            value={order.status} 
                                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                                            options={[{value: 'Pendente', label: 'Pendente'}, {value: 'Enviado', label: 'Enviado'}, {value: 'Entregue', label: 'Entregue'}]}
                                            containerClassName="mb-0"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};


export default StoreAdminView;