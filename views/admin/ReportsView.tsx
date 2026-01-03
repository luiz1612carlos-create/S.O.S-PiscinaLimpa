
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { AppContextType, Client, Transaction } from '../../types';
import { Card, CardContent, CardHeader } from '../../components/Card';
import { Spinner } from '../../components/Spinner';
import { UsersIcon, CurrencyDollarIcon, CheckBadgeIcon, StoreIcon, TrashIcon } from '../../constants';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { calculateClientMonthlyFee } from '../../utils/calculations';

// This is a workaround for the no-build-tool environment
declare const Chart: any;

interface ReportsViewProps {
    appContext: AppContextType;
}

// Helper function to safely convert Firestore timestamps or strings to Date objects
const toDate = (timestamp: any): Date | null => {
    // Se o timestamp for null, mas estivermos no contexto de uma transação recente,
    // retornamos a data atual para que o KPI atualize imediatamente na UI (otimista)
    if (!timestamp) return new Date();
    
    if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    if (typeof timestamp === 'string') {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }
    if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000);
    }
    // Fallback for pending server timestamps
    return new Date();
};


const ReportsView: React.FC<ReportsViewProps> = ({ appContext }) => {
    const { clients, orders, budgetQuotes, products, transactions, loading, resetReportsData, settings, banks } = appContext;
    
    const [isDuesModalOpen, setIsDuesModalOpen] = useState(false);
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [selectedClientForWhatsApp, setSelectedClientForWhatsApp] = useState<Client | null>(null);
    const [whatsAppMessage, setWhatsAppMessage] = useState('');

    const stats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
        
        const monthlyRevenue = transactions.filter(t => {
            const d = toDate(t.date);
            return d && d >= startOfMonth;
        }).reduce((sum, t) => sum + t.amount, 0);

        const newBudgetsThisMonth = budgetQuotes.filter(b => {
            const d = toDate(b.createdAt);
            return d && d >= startOfMonth;
        }).length;

        const ordersThisMonth = orders.filter(o => {
            const d = toDate(o.createdAt);
            return d && d >= startOfMonth;
        }).length;
        
        return {
            activeClients: activeClients.length,
            monthlyRevenue,
            newBudgetsThisMonth,
            ordersThisMonth
        };
    }, [clients, orders, budgetQuotes, transactions, settings]);
    
    const revenueByBank = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);

        return transactions
            .filter(t => {
                const d = toDate(t.date);
                return d && d >= startOfMonth;
            })
            .reduce((acc, t) => {
                acc[t.bankName] = (acc[t.bankName] || 0) + t.amount;
                return acc;
            }, {} as { [key: string]: number });

    }, [transactions]);


    const clientsWithPendingPayments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(today.getDate() + 7);

        return clients.filter(client => {
            if (!client.payment.dueDate) return false;
            const dueDate = new Date(client.payment.dueDate);
            return client.payment.status !== 'Pago' && dueDate <= sevenDaysFromNow;
        }).sort((a, b) => new Date(a.payment.dueDate).getTime() - new Date(b.payment.dueDate).getTime());
    }, [clients]);

    const handleOpenWhatsAppModal = (client: Client) => {
        if (!settings) return;
        
        let pixKey = client.pixKey;
        let pixRecipient = client.pixKeyRecipient;

        if (!pixKey && client.bankId) {
            const clientBank = banks.find(b => b.id === client.bankId);
            if (clientBank && clientBank.pixKey) {
                pixKey = clientBank.pixKey;
                if (clientBank.pixKeyRecipient) {
                    pixRecipient = clientBank.pixKeyRecipient;
                }
            }
        }
        if (!pixKey) {
            pixKey = settings.pixKey;
            if (!pixRecipient) {
                pixRecipient = settings.pixKeyRecipient;
            }
        }
        
        if (!pixRecipient) {
             pixRecipient = settings.pixKeyRecipient || settings.companyName;
        }

        const dueDate = new Date(client.payment.dueDate).toLocaleDateString('pt-BR');
        const fee = calculateClientMonthlyFee(client, settings).toFixed(2).replace('.', ',');
        
        let template = settings.whatsappMessageTemplate;
        
        if (!template) {
             template = "Olá {CLIENTE}, tudo bem? Passando para lembrar sobre o vencimento da sua mensalidade no valor de R$ {VALOR} no dia {VENCIMENTO}. \n\nChave PIX: {PIX} \nDestinatário: {DESTINATARIO}\n\nAgradecemos a parceria!";
        } else if (!template.includes('{DESTINATARIO}')) {
             if (template.includes('{PIX}')) {
                 template = template.replace('{PIX}', '{PIX} \nDestinatário: {DESTINATARIO}');
             } else {
                 template += '\nDestinatário: {DESTINATARIO}';
             }
        }
        
        const message = template
            .replace('{CLIENTE}', client.name)
            .replace('{VALOR}', fee)
            .replace('{VENCIMENTO}', dueDate)
            .replace('{PIX}', pixKey || "Consulte-nos")
            .replace('{DESTINATARIO}', pixRecipient || "Empresa");

        setWhatsAppMessage(message);
        setSelectedClientForWhatsApp(client);
        setIsWhatsAppModalOpen(true);
    };

    const handleSendWhatsApp = () => {
        if (!selectedClientForWhatsApp) return;
        const phone = selectedClientForWhatsApp.phone.replace(/\D/g, '');
        const encodedMessage = encodeURIComponent(whatsAppMessage);
        window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
        setIsWhatsAppModalOpen(false);
        setSelectedClientForWhatsApp(null);
    };
    
    const visitTimeAnalysis = useMemo(() => {
        const clientsWithVisits = clients.filter(c => c.lastVisitDuration && c.lastVisitDuration > 0);
        if (clientsWithVisits.length === 0) {
            return { average: 0, longest: [], shortest: [] };
        }

        const totalDuration = clientsWithVisits.reduce((sum, c) => sum + c.lastVisitDuration!, 0);
        const average = totalDuration / clientsWithVisits.length;

        const sortedByDuration = [...clientsWithVisits].sort((a, b) => b.lastVisitDuration! - a.lastVisitDuration!);
        
        const longest = sortedByDuration.slice(0, 5);
        const shortest = sortedByDuration.slice(-5).reverse();

        return { average, longest, shortest };
    }, [clients]);

    
    const pendingPayments = useMemo(() => {
        return clients.filter(c => c.payment.status === 'Pendente' || c.payment.status === 'Atrasado')
            .sort((a, b) => new Date(a.payment.dueDate).getTime() - new Date(b.payment.dueDate).getTime());
    }, [clients]);

    const isLoading = loading.clients || loading.orders || loading.budgetQuotes || loading.products || loading.settings || loading.transactions;
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner size="lg" /></div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Relatórios e Insights</h2>
                <Button variant="danger" size="sm" onClick={resetReportsData}>
                    <TrashIcon className="w-4 h-4 mr-2" />
                    Resetar Dados
                </Button>
            </div>
            
            {clientsWithPendingPayments.length > 0 && (
                <div 
                    className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md mb-6 cursor-pointer hover:bg-yellow-200"
                    role="alert"
                    onClick={() => setIsDuesModalOpen(true)}
                >
                    <p className="font-bold">Alerta de Vencimentos</p>
                    <p>Você tem {clientsWithPendingPayments.length} cliente(s) com mensalidades vencidas ou a vencer nos próximos 7 dias. Clique aqui para ver a lista.</p>
                </div>
            )}


            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KpiCard title="Clientes Ativos" value={stats.activeClients} icon={UsersIcon} />
                <KpiCard title="Faturamento Real (Mês)" value={`R$ ${stats.monthlyRevenue.toFixed(2)}`} icon={CurrencyDollarIcon} />
                <KpiCard title="Novos Orçamentos (Mês)" value={stats.newBudgetsThisMonth} icon={CheckBadgeIcon} />
                <KpiCard title="Pedidos na Loja (Mês)" value={stats.ordersThisMonth} icon={StoreIcon} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                <Card className="lg:col-span-2">
                    <CardHeader><h3 className="font-semibold">Distribuição de Planos</h3></CardHeader>
                    <CardContent>
                        <ClientPlanChart clients={clients} />
                    </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                    <CardHeader><h3 className="font-semibold">Performance Financeira (Últimos 6 Meses)</h3></CardHeader>
                    <CardContent>
                        <MonthlyGrowthChart clients={clients} transactions={transactions} settings={settings} />
                    </CardContent>
                </Card>
            </div>

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader><h3 className="font-semibold">Faturamento por Banco (Mês Atual)</h3></CardHeader>
                    <CardContent>
                        <DataTable 
                            headers={['Banco/Conta', 'Valor Recebido']} 
                            data={Object.entries(revenueByBank).map(([bankName, amount]) => [bankName, `R$ ${(amount as number).toFixed(2)}`])} 
                        />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><h3 className="font-semibold">Pagamentos Pendentes</h3></CardHeader>
                    <CardContent>
                       <DataTable 
                           headers={['Cliente', 'Vencimento', 'Valor']} 
                           data={pendingPayments.map(c => [
                               c.name, 
                               new Date(c.payment.dueDate).toLocaleDateString(), 
                               `R$ ${settings ? calculateClientMonthlyFee(c, settings).toFixed(2) : 'N/A'}`
                           ])} 
                       />
                    </CardContent>
                </Card>
            </div>

            {/* Visit Time Analysis */}
            <div className="mt-6">
                 <Card>
                    <CardHeader><h3 className="font-semibold">Análise de Tempo de Visita</h3></CardHeader>
                    <CardContent>
                        <p className="mb-4"><strong>Tempo Médio por Visita:</strong> {visitTimeAnalysis.average.toFixed(0)} minutos</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">Clientes com Visitas Mais Longas</h4>
                                <DataTable 
                                    headers={['Cliente', 'Duração (min)']} 
                                    data={visitTimeAnalysis.longest.map(c => [c.name, c.lastVisitDuration!])} 
                                />
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Clientes com Visitas Mais Rápidas</h4>
                                <DataTable 
                                    headers={['Cliente', 'Duração (min)']} 
                                    data={visitTimeAnalysis.shortest.map(c => [c.name, c.lastVisitDuration!])} 
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* Dues Modal */}
            <Modal isOpen={isDuesModalOpen} onClose={() => setIsDuesModalOpen(false)} title="Clientes com Pagamentos Pendentes">
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {clientsWithPendingPayments.map(client => (
                        <div key={client.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <div>
                                <p className="font-semibold">{client.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Vence em: {new Date(client.payment.dueDate).toLocaleDateString('pt-BR')}
                                </p>
                            </div>
                            <Button size="sm" onClick={() => handleOpenWhatsAppModal(client)}>
                                Enviar WhatsApp
                            </Button>
                        </div>
                    ))}
                </div>
            </Modal>
            
            {/* WhatsApp Message Modal */}
            <Modal 
                isOpen={isWhatsAppModalOpen} 
                onClose={() => setIsWhatsAppModalOpen(false)} 
                title={`Mensagem para ${selectedClientForWhatsApp?.name}`}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsWhatsAppModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSendWhatsApp}>Enviar via WhatsApp</Button>
                    </>
                }
            >
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Edite a mensagem abaixo antes de enviar:</p>
                <textarea
                    value={whatsAppMessage}
                    onChange={(e) => setWhatsAppMessage(e.target.value)}
                    rows={8}
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </Modal>
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.FC<any> }) => (
    <Card>
        <CardContent className="flex items-center">
            <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-full mr-4">
                <Icon className="w-6 h-6 text-primary-600 dark:text-primary-300" />
            </div>
            <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
            </div>
        </CardContent>
    </Card>
);

const DataTable = ({ headers, data }: { headers: string[], data: (string | number)[][] }) => (
    <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="border-b dark:border-gray-700">
                <tr>
                    {headers.map(h => <th key={h} className="text-left p-2 font-semibold">{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {data.length > 0 ? data.map((row, i) => (
                    <tr key={i} className="border-b dark:border-gray-700">
                        {row.map((cell, j) => <td key={j} className="p-2">{cell}</td>)}
                    </tr>
                )) : <tr><td colSpan={headers.length} className="text-center p-4 text-gray-500">Nenhum dado disponível.</td></tr>}
            </tbody>
        </table>
    </div>
);


const ClientPlanChart = ({ clients }: { clients: Client[] }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    const data = useMemo(() => {
        const counts = clients.reduce((acc, client) => {
            if (client.clientStatus === 'Ativo') {
                acc[client.plan] = (acc[client.plan] || 0) + 1;
            }
            return acc;
        }, {} as { [key: string]: number });
        return {
            labels: Object.keys(counts),
            values: Object.values(counts)
        };
    }, [clients]);

    useEffect(() => {
        if (!chartRef.current) return;
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }
        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    backgroundColor: ['#3b82f6', '#f59e0b'],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data]);

    return <canvas ref={chartRef}></canvas>;
};

const MonthlyGrowthChart = ({ clients, transactions, settings }: { clients: Client[], transactions: Transaction[], settings: any }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    const data = useMemo(() => {
        if (!settings) return { labels: [], realRevenue: [], potentialRevenue: [], clientCount: [] };

        const labels: string[] = [];
        const realRevenue: number[] = [];
        const potentialRevenue: number[] = [];
        const clientCount: number[] = [];
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            labels.push(d.toLocaleString('pt-BR', { month: 'short' }));
            
            const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

            // Real Revenue: Sum of transactions in that month
            const realSum = transactions
                .filter(t => {
                    const tDate = toDate(t.date);
                    return tDate && tDate >= startOfMonth && tDate <= endOfMonth;
                })
                .reduce((sum, t) => sum + t.amount, 0);
            realRevenue.push(realSum);

            // Potential Revenue & Client Count at that point in time
            const clientsAtThatTime = clients.filter(c => {
                const createdAtDate = toDate(c.createdAt);
                return createdAtDate && createdAtDate <= endOfMonth && c.clientStatus === 'Ativo';
            });
            clientCount.push(clientsAtThatTime.length);

            const potentialSum = clientsAtThatTime.reduce((sum, c) => sum + calculateClientMonthlyFee(c, settings), 0);
            potentialRevenue.push(potentialSum);
        }
        
        return { labels, realRevenue, potentialRevenue, clientCount };
    }, [clients, transactions, settings]);

    useEffect(() => {
        if (!chartRef.current) return;
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }
        const ctx = chartRef.current.getContext('2d');
        chartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Faturamento Real (Pagos)',
                        data: data.realRevenue,
                        backgroundColor: '#10b981', // green-500
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: 'Faturamento Potencial (Contratos)',
                        data: data.potentialRevenue,
                        backgroundColor: '#3b82f6', // blue-500
                        yAxisID: 'y',
                        order: 3,
                        alpha: 0.5
                    },
                    {
                        label: 'Total de Clientes',
                        data: data.clientCount,
                        borderColor: '#f59e0b', // amber-500
                        backgroundColor: '#f59e0b',
                        type: 'line',
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                         title: { display: true, text: 'Faturamento (R$)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Clientes' },
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                },
            }
        });
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data]);

    return <canvas ref={chartRef} height="120"></canvas>;
};


export default ReportsView;
