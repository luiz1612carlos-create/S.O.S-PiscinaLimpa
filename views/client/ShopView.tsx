
import React, { useState, useMemo } from 'react';
import { AppContextType, Product, CartItem, Order } from '../../types';
import { Spinner } from '../../components/Spinner';
import { Button } from '../../components/Button';
import { ShoppingCartIcon, PlusIcon, TrashIcon } from '../../constants';
import { Modal } from '../../components/Modal';
// FIX: Import the Input component.
import { Input } from '../../components/Input';

interface ShopViewProps {
    appContext: AppContextType;
}

const ShopView: React.FC<ShopViewProps> = ({ appContext }) => {
    const { products, loading, createOrder, showNotification, clients } = appContext;
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState(false);

    const cartTotal = useMemo(() => cart.reduce((total, item) => total + item.price * item.quantity, 0), [cart]);

    const addToCart = (product: Product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
        showNotification(`${product.name} adicionado ao carrinho!`, 'info');
    };

    const removeFromCart = (productId: string) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) {
            removeFromCart(productId);
            return;
        }
        setCart(prevCart => prevCart.map(item => item.id === productId ? { ...item, quantity } : item));
    };
    
    const handleCheckout = async () => {
        const client = clients[0]; // Assuming client dashboard context, there's only one client
        if (!client) {
            showNotification('Não foi possível identificar o cliente.', 'error');
            return;
        }

        setIsCheckingOut(true);
        try {
            const newOrder: Omit<Order, 'id' | 'createdAt'> = {
                clientId: client.uid || client.id, // Prefer UID if available
                clientName: client.name,
                items: cart,
                total: cartTotal,
                status: 'Pendente',
            };
            await createOrder(newOrder);
            showNotification('Pedido realizado com sucesso!', 'success');
            setCart([]);
            setIsCartOpen(false);
        } catch (error: any) {
            showNotification(error.message || 'Erro ao finalizar pedido.', 'error');
        } finally {
            setIsCheckingOut(false);
        }
    }


    if (loading.products) {
        return <div className="flex justify-center"><Spinner size="lg" /></div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Loja de Produtos</h2>
                <Button onClick={() => setIsCartOpen(true)}>
                    <ShoppingCartIcon className="w-5 h-5 mr-2" />
                    Carrinho ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map(product => (
                    <div key={product.id} className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden flex flex-col">
                        <img src={product.imageUrl} alt={product.name} className="h-48 w-full object-cover" />
                        <div className="p-4 flex-grow">
                            <h3 className="font-bold text-lg">{product.name}</h3>
                            <p className="text-primary-500 font-bold mt-2">R$ {product.price.toFixed(2)}</p>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-700">
                            <Button className="w-full" onClick={() => addToCart(product)}>
                                <PlusIcon className="w-5 h-5 mr-1" /> Adicionar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            
            <Modal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} title="Meu Carrinho">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {cart.length === 0 ? <p>Seu carrinho está vazio.</p> : cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-gray-500">R$ {item.price.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input label="" type="number" value={item.quantity} onChange={e => updateQuantity(item.id, +e.target.value)} min="1" containerClassName="w-20 mb-0" className="p-1 text-center" />
                                <Button size="sm" variant="danger" onClick={() => removeFromCart(item.id)}><TrashIcon className="w-4 h-4" /></Button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="mt-6 pt-4 border-t dark:border-gray-700">
                    <div className="flex justify-between text-xl font-bold">
                        <span>Total:</span>
                        <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                    <Button className="w-full mt-4" size="lg" onClick={handleCheckout} isLoading={isCheckingOut} disabled={cart.length === 0}>
                        Finalizar Pedido
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default ShopView;
