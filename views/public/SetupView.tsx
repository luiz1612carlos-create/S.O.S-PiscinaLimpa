import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AppContextType } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';

interface SetupViewProps {
    appContext: AppContextType;
}

const SetupView: React.FC<SetupViewProps> = ({ appContext }) => {
    const { createInitialAdmin, showNotification, settings } = appContext;
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) {
            showNotification('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            await createInitialAdmin(name, email, password);
            // On success, the app state will change and this component will unmount.
        } catch (error: any) {
            console.error(error);
            showNotification(error.message || 'Falha ao criar conta de administrador.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                 <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400">{settings?.companyName || 'Piscina Limpa'}</h1>
                </header>
                <Card>
                    <CardHeader>
                        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200">Configuração Inicial</h2>
                        <p className="text-center text-gray-500 dark:text-gray-400 mt-2">Crie a primeira conta de administrador para começar a usar o sistema.</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateAdmin} className="space-y-6">
                             <Input
                                label="Nome Completo do Administrador"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="João Silva"
                            />
                            <Input
                                label="Email do Administrador"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="admin@email.com"
                            />
                            <Input
                                label="Senha"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                            <Button type="submit" isLoading={isLoading} className="w-full" size="lg">
                                Criar Administrador e Iniciar
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default SetupView;