import React, { useState } from 'react';
import { ClientProduct, StockProduct } from '../types';
import { Select } from './Select';
import { Input } from './Input';
import { Button } from './Button';
import { TrashIcon } from '../constants';

interface ClientStockManagerProps {
    stock: ClientProduct[];
    allStockProducts: StockProduct[];
    onStockChange: (stock: ClientProduct[]) => void;
}

export const ClientStockManager: React.FC<ClientStockManagerProps> = ({ stock, allStockProducts, onStockChange }) => {
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);

    const addProductToStock = () => {
        const productToAdd = allStockProducts.find(p => p.id === selectedProduct);
        if (productToAdd && !stock.some(p => p.productId === selectedProduct)) {
            onStockChange([...stock, { productId: productToAdd.id, name: productToAdd.name, quantity }]);
        }
    };

    const removeProductFromStock = (productId: string) => {
        onStockChange(stock.filter(p => p.productId !== productId));
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        onStockChange(stock.map(p => p.productId === productId ? { ...p, quantity: newQuantity } : p));
    };

    return (
        <fieldset className="border p-4 rounded-md dark:border-gray-600">
            <legend className="px-2 font-semibold">Estoque de Produtos do Cliente</legend>
            <div className="flex gap-2 my-2">
                <Select
                    label=""
                    value={selectedProduct}
                    onChange={e => setSelectedProduct(e.target.value)}
                    options={[{ value: '', label: 'Selecione um produto...' }, ...allStockProducts.map(p => ({ value: p.id, label: `${p.name} (${p.unit})` }))]}
                    containerClassName="flex-1 mb-0"
                />
                <Input
                    label=""
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value))}
                    min="1"
                    containerClassName="w-24 mb-0"
                />
                <Button onClick={addProductToStock} size="md" className="self-end">+</Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
                {stock.length > 0 ? stock.map(item => (
                    <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded">
                        <span>{item.name}</span>
                        <div className="flex items-center gap-2">
                            <Input
                                label=""
                                type="number"
                                value={item.quantity}
                                onChange={e => updateQuantity(item.productId, parseInt(e.target.value))}
                                min="0"
                                containerClassName="w-20 mb-0"
                                className="p-1 text-center"
                            />
                            <Button variant="danger" size="sm" onClick={() => removeProductFromStock(item.productId)}>
                                <TrashIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )) : <p className="text-gray-500 text-sm text-center">Nenhum produto no estoque deste cliente.</p>}
            </div>
        </fieldset>
    );
};
