

import React, { useState } from 'react';
import { AuthContextType, AppContextType } from '../../types';
import { MoonIcon, SunIcon, LogoutIcon, DashboardIcon, StoreIcon, DownloadIcon, XMarkIcon } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import ClientDashboardView from './ClientDashboardView';
import ShopView from './ShopView';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../../components/Button';

interface ClientLayoutProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

type ClientView = 'dashboard' | 'shop';

const ClientLayout: React.FC<ClientLayoutProps> = ({ authContext, appContext }) => {
    const { userData, logout } = authContext;
    const { theme, toggleTheme } = useTheme();
    const [currentView, setCurrentView] = useState<ClientView>('dashboard');
    const { canInstall, promptInstall } = usePWAInstall();
    const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(true);

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return <ClientDashboardView authContext={authContext} appContext={appContext} />;
            case 'shop':
                return <ShopView appContext={appContext} />;
            default:
                return <ClientDashboardView authContext={authContext} appContext={appContext} />;
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { id: 'shop', label: 'Loja', icon: StoreIcon, disabled: !appContext.settings?.features.storeEnabled },
    ];

    const logoTransforms = appContext.settings?.logoTransforms;
    const logoFilter = [
        `brightness(${logoTransforms?.brightness || 1})`,
        `contrast(${logoTransforms?.contrast || 1})`,
        `grayscale(${logoTransforms?.grayscale || 0})`,
    ].filter(Boolean).join(' ');

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Install Banner */}
            {canInstall && isInstallBannerVisible && (
                 <div className="bg-primary-600 text-white p-3 flex items-center justify-center text-center text-sm gap-4">
                    <DownloadIcon className="w-6 h-6 flex-shrink-0" />
                    <span className="font-semibold flex-grow">Tenha o app na sua tela inicial para acesso rápido!</span>
                    <div className="flex-shrink-0 flex gap-2">
                        <Button size="sm" onClick={promptInstall} className="bg-white text-primary-600 hover:bg-gray-200">Instalar</Button>
                        <button onClick={() => setIsInstallBannerVisible(false)} className="p-1 rounded-full hover:bg-white/20">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {appContext.settings?.logoUrl ? (
                            <div className="h-14 w-32 flex items-center justify-center overflow-hidden">
                                <img 
                                    src={appContext.settings.logoUrl} 
                                    alt={appContext.settings.companyName} 
                                    className="max-w-full max-h-full"
                                    style={{ 
                                        objectFit: appContext.settings?.logoObjectFit || 'contain',
                                        transform: `scale(${logoTransforms?.scale || 1}) rotate(${logoTransforms?.rotate || 0}deg)`,
                                        filter: logoFilter
                                    }} 
                                />
                            </div>
                        ) : (
                            <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">{appContext.settings?.companyName || 'Piscina Limpa'}</h1>
                        )}
                        <nav className="hidden md:flex items-center gap-2">
                            {navItems.map(item => !item.disabled && (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentView(item.id as ClientView)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${currentView === item.id ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className="text-sm hidden sm:inline">Olá, {userData?.name || userData?.email}</span>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={logout} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            <LogoutIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                {/* Mobile Nav */}
                 <nav className="md:hidden flex items-center justify-around p-2 border-t dark:border-gray-700">
                    {navItems.map(item => !item.disabled && (
                        <button
                            key={item.id}
                            onClick={() => setCurrentView(item.id as ClientView)}
                            className={`flex flex-col items-center gap-1 p-2 rounded-md text-xs font-medium w-full ${currentView === item.id ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                            <item.icon className="w-6 h-6" />
                            {item.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 md:p-6">
                {renderView()}
            </main>
        </div>
    );
};

export default ClientLayout;
