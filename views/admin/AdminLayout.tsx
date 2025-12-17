
import React, { useState } from 'react';
import { AuthContextType, AppContextType, AdminView } from '../../types';
import { MenuIcon, SunIcon, MoonIcon, LogoutIcon, UsersIcon, RouteIcon, CheckBadgeIcon, StoreIcon, SettingsIcon, ChartBarIcon, DownloadIcon, CalendarDaysIcon, ArchiveBoxIcon, SparklesIcon } from '../../constants';
import { useTheme } from '../../hooks/useTheme';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import ClientsView from './ClientsView';
import RoutesView from './RoutesView';
import ApprovalsView from './ApprovalsView';
import StoreAdminView from './StoreAdminView';
import SettingsView from './SettingsView';
import ReportsView from './ReportsView';
import AdvancePaymentsView from './AdvancePaymentsView';
import StockProductsView from './StockProductsView';
import EventsView from './EventsView';

interface AdminLayoutProps {
    authContext: AuthContextType;
    appContext: AppContextType;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ authContext, appContext }) => {
    const { userData, logout } = authContext;
    const { theme, toggleTheme } = useTheme();
    const { canInstall, promptInstall } = usePWAInstall();
    const [currentView, setCurrentView] = useState<AdminView>('reports');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const pendingBudgetsCount = appContext.budgetQuotes.filter(b => b.status === 'pending').length;
    const pendingPlanRequestsCount = appContext.planChangeRequests.filter(r => r.status === 'pending').length;
    const totalApprovals = pendingBudgetsCount + pendingPlanRequestsCount;

    const menuItems = [
        { id: 'reports', label: 'Relatórios', icon: ChartBarIcon },
        { id: 'approvals', label: 'Aprovações', icon: CheckBadgeIcon, count: totalApprovals },
        { id: 'advances', label: 'Adiantamentos', icon: CalendarDaysIcon, count: appContext.advancePaymentRequests.filter(r => r.status === 'pending').length },
        { id: 'events', label: 'Eventos', icon: SparklesIcon, count: appContext.poolEvents.filter(e => e.status === 'notified').length },
        { id: 'clients', label: 'Clientes', icon: UsersIcon },
        { id: 'routes', label: 'Rotas', icon: RouteIcon },
        { id: 'store', label: 'Loja', icon: StoreIcon },
        { id: 'stock', label: 'Estoque Mestre', icon: ArchiveBoxIcon },
        { id: 'settings', label: 'Configurações', icon: SettingsIcon },
    ];
    
    const renderView = () => {
        switch (currentView) {
            case 'reports': return <ReportsView appContext={appContext} />;
            case 'clients': return <ClientsView appContext={appContext} />;
            case 'routes': return <RoutesView appContext={appContext} />;
            case 'approvals': return <ApprovalsView appContext={appContext} />;
            case 'store': return <StoreAdminView appContext={appContext} />;
            case 'stock': return <StockProductsView appContext={appContext} />;
            case 'settings': return <SettingsView appContext={appContext} authContext={authContext} />;
            case 'advances': return <AdvancePaymentsView appContext={appContext} />;
            case 'events': return <EventsView appContext={appContext} />;
            default: return <ReportsView appContext={appContext} />;
        }
    };

    const SidebarContent = () => {
        const logoTransforms = appContext.settings?.logoTransforms;
        const logoFilter = [
            `brightness(${logoTransforms?.brightness || 1})`,
            `contrast(${logoTransforms?.contrast || 1})`,
            `grayscale(${logoTransforms?.grayscale || 0})`,
        ].filter(Boolean).join(' ');

        return (
            <>
                <div className="p-4 border-b dark:border-gray-700 h-20 flex items-center">
                    {appContext.settings?.logoUrl ? (
                        <div className="h-16 w-full flex items-center justify-center overflow-hidden">
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
                        <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{appContext.settings?.companyName || 'Piscina Limpa'}</h1>
                    )}
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setCurrentView(item.id as AdminView);
                                setIsSidebarOpen(false); // Close sidebar on mobile after selection
                            }}
                            className={`w-full flex items-center p-2 rounded-md transition-colors ${currentView === item.id ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            <item.icon className="w-6 h-6 mr-3" />
                            <span>{item.label}</span>
                            {item.count !== undefined && item.count > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">{item.count}</span>
                            )}
                        </button>
                    ))}
                </nav>
            </>
        );
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-md flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between md:justify-end items-center space-x-4">
                    <button className="p-2 rounded-full text-gray-500 dark:text-gray-400 md:hidden" onClick={() => setIsSidebarOpen(true)}>
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Bem-vindo, {userData?.name || userData?.email}</span>
                        {canInstall && (
                             <button onClick={promptInstall} title="Baixar App" className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                                <DownloadIcon className="w-6 h-6" />
                            </button>
                        )}
                        <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                        </button>
                        <button onClick={logout} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            <LogoutIcon className="w-6 h-6" />
                        </button>
                    </div>
                </header>
                {/* Content Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;