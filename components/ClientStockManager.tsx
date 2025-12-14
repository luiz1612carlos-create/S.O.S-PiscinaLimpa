
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
    const [maxQuantity, setMaxQuantity] = useState(5);

    const addProductToStock = () => {
        const productToAdd = allStockProducts.find(p => p.id === selectedProduct);
        if (productToAdd && !stock.some(p => p.productId === selectedProduct)) {
            onStockChange([...stock, { 
                productId: productToAdd.id, 
                name: productToAdd.name, 
                quantity: quantity,
                maxQuantity: maxQuantity
            }]);
            setSelectedProduct('');
            setQuantity(1);
            setMaxQuantity(5);
        }
    };

    const removeProductFromStock = (productId: string) => {
        onStockChange(stock.filter(p => p.productId !== productId));
    };

    const updateStockItem = (productId: string, field: 'quantity' | 'maxQuantity', value: number) => {
        onStockChange(stock.map(p => p.productId === productId ? { ...p, [field]: value } : p));
    };

    return (
        <fieldset className="border p-4 rounded-md dark:border-gray-600">
            <legend className="px-2 font-semibold">Estoque de Produtos do Cliente</legend>
            
            {/* Header row for larger screens */}
            <div className="hidden md:flex gap-2 mb-1 px-2 text-xs text-gray-500 font-semibold">
                <div className="flex-1">Produto</div>
                <div className="w-24 text-center">Qtd. Atual</div>
                <div className="w-24 text-center">Estoque Máx.</div>
                <div className="w-10"></div>
            </div>

            {/* Input Row */}
            <div className="flex flex-col md:flex-row gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                <Select
                    label="Selecionar Produto"
                    value={selectedProduct}
                    onChange={e => setSelectedProduct(e.target.value)}
                    options={[{ value: '', label: 'Adicionar produto...' }, ...allStockProducts.filter(ap => !stock.some(s => s.productId === ap.id)).map(p => ({ value: p.id, label: `${p.name} (${p.unit})` }))]}
                    containerClassName="flex-1 mb-0"
                />
                <div className="flex gap-2">
                    <Input
                        label="Atual"
                        type="number"
                        value={quantity}
                        onChange={e => setQuantity(Math.max(0, parseInt(e.target.value)))}
                        min="0"
                        containerClassName="w-1/2 md:w-24 mb-0"
                    />
                    <Input
                        label="Máx"
                        type="number"
                        value={maxQuantity}
                        onChange={e => setMaxQuantity(Math.max(1, parseInt(e.target.value)))}
                        min="1"
                        containerClassName="w-1/2 md:w-24 mb-0"
                    />
                    <Button onClick={addProductToStock} size="md" className="self-end" disabled={!selectedProduct}>+</Button>
                </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {stock.length > 0 ? stock.map(item => {
                    const stockItem = allStockProducts.find(sp => sp.id === item.productId);
                    const unit = stockItem?.unit || 'un';
                    const percentage = item.maxQuantity ? Math.min(100, (item.quantity / item.maxQuantity) * 100) : 100;
                    
                    return (
                        <div key={item.productId} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded gap-2">
                            <div className="flex-1">
                                <span className="font-semibold block">{item.name}</span>
                                <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-1.5 mt-1 md:hidden">
                                    <div className={`h-1.5 rounded-full ${percentage < 30 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 justify-between md:justify-end">
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 text-center md:hidden">Atual</span>
                                        <div className="relative">
                                            <Input
                                                label=""
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => updateStockItem(item.productId, 'quantity', parseInt(e.target.value))}
                                                min="0"
                                                containerClassName="w-20 mb-0"
                                                className="p-1 text-center pr-6"
                                            />
                                            <span className="absolute right-2 top-1.5 text-xs text-gray-400 pointer-events-none">{unit}</span>
                                        </div>
                                    </div>
                                    
                                    <span className="text-gray-400">/</span>

                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-500 text-center md:hidden">Máx</span>
                                        <div className="relative">
                                            <Input
                                                label=""
                                                type="number"
                                                value={item.maxQuantity || 5} // Fallback visual
                                                onChange={e => updateStockItem(item.productId, 'maxQuantity', parseInt(e.target.value))}
                                                min="1"
                                                containerClassName="w-20 mb-0"
                                                className="p-1 text-center pr-6"
                                            />
                                            <span className="absolute right-2 top-1.5 text-xs text-gray-400 pointer-events-none">{unit}</span>
                                        </div>
                                    </div>
                                </div>

                                <Button variant="danger" size="sm" onClick={() => removeProductFromStock(item.productId)} className="ml-2">
                                    <TrashIcon className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                }) : <p className="text-gray-500 text-sm text-center py-4">Nenhum produto no estoque deste cliente.</p>}
            </div>
        </fieldset>
    );
};
