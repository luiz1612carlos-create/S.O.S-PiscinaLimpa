

import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AuthContextType } from '../../types';

interface LoginViewProps {
    authContext: AuthContextType;
}

const LoginView: React.FC<LoginViewProps> = ({ authContext }) => {
    const { login, showNotification } = authContext;
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(email, password);
            // No success notification needed here, as the app will redirect automatically
        } catch (error: any) {
            console.error("Login Error:", error);
            let errorMessage = 'Falha ao fazer login. Verifique suas credenciais e tente novamente.';
            
            // Firebase JS SDK v8 uses error.code
            if (error.code) {
                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'Nenhum usuário encontrado com este e-mail.';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Senha incorreta. Por favor, tente novamente.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'O formato do e-mail é inválido.';
                        break;
                }
            } else if (error.message && error.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                // Fallback for generic credential errors which can happen depending on environment
                errorMessage = 'E-mail ou senha incorretos.';
            }
            
            showNotification(errorMessage, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-gray-200">Acesso ao Painel</h2>
            <form onSubmit={handleLogin}>
                <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                />
                <Input
                    label="Senha"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                />
                <Button type="submit" isLoading={isLoading} className="w-full">
                    Entrar
                </Button>
            </form>
        </div>
    );
};

export default LoginView;