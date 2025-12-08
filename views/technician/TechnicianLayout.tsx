

import React from 'react';
import { AuthContextType, AppContextType } from '../../types';
import { MoonIcon, SunIcon, LogoutIcon } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import TechnicianDashboardView from './TechnicianDashboardView';

interface TechnicianLayoutProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

const TechnicianLayout: React.FC<TechnicianLayoutProps> = ({ authContext, appContext }) => {
    const { userData, logout } = authContext;
    const { theme, toggleTheme } = useTheme();

    const logoTransforms = appContext.settings?.logoTransforms;
    const logoFilter = [
        `brightness(${logoTransforms?.brightness || 1})`,
        `contrast(${logoTransforms?.contrast || 1})`,
        `grayscale(${logoTransforms?.grayscale || 0})`,
    ].filter(Boolean).join(' ');

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
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
                        <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">{appContext.settings?.companyName || 'Painel do Técnico'}</h1>
                    )}
                    <div className="flex items-center space-x-3">
                        <span className="text-sm hidden sm:inline">Bem-vindo, {userData?.name || userData?.email}</span>
                        <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                        </button>
                        <button onClick={logout} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            <LogoutIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-6">
                <TechnicianDashboardView appContext={appContext} />
            </main>
        </div>
    );
};

export default TechnicianLayout;
