import { useState, useEffect, useCallback } from 'react';
import { db, firebase, auth } from '../firebase';
// FIX: Add missing 'RouteDay' to imports.
import {
    Client, BudgetQuote, Routes, Product, Order, Settings, ClientProduct, UserData,
    OrderStatus, AppData, ReplenishmentQuote, ReplenishmentQuoteStatus, Bank, Transaction,
    AdvancePaymentRequest, AdvancePaymentRequestStatus, RouteDay, FidelityPlan
} from '../types';
import { calculateClientMonthlyFee } from '../utils/calculations';

// Helper for deep merging settings to avoid errors on updates
const isObject = (item: any) => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};

const deepMerge = (target: any, ...sources: any[]): any => {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }
    return deepMerge(target, ...sources);
};


const defaultSettings: Settings = {
    companyName: "Piscina Limpa",
    mainTitle: "Piscina Limpa",
    mainSubtitle: "Compromisso e Qualidade",
    baseAddress: {
        street: "Rua Principal",
        number: "123",
        neighborhood: "Centro",
        city: "Sua Cidade",
        state: "SP",
        zip: "12345-000",
    },
    pixKey: "seu-pix@email.com",
    pricing: {
        perKm: 1.5,
        wellWaterFee: 50,
        productsFee: 75,
        volumeTiers: [
            { upTo: 20000, price: 150 },
            { upTo: 50000, price: 250 },
            { upTo: 100000, price: 400 },
        ],
    },
    plans: {
        simple: { title: "Plano Simples", benefits: ["Limpeza semanal", "Ajuste de pH e Cloro"], terms: "Estes são os termos padrão para o Plano Simples. Edite este texto nas configurações." },
        vip: { title: "Plano VIP", benefits: ["Tudo do Simples", "Produtos inclusos", "Atendimento prioritário"], terms: "Estes são os termos padrão para o Plano VIP. Edite este texto nas configurações." },
    },
    fidelityPlans: [
        { id: '4_months', months: 4, discountPercent: 5 },
        { id: '6_months', months: 6, discountPercent: 10 },
        { id: '12_months', months: 12, discountPercent: 15 },
    ],
    features: {
        vipPlanEnabled: true,
        vipPlanDisabledMessage: "Em breve!",
        storeEnabled: true,
        advancePaymentPlanEnabled: false,
        advancePaymentTitle: "Economize com Pagamento Adiantado!",
        advancePaymentSubtitleVIP: "Pague vários meses de uma vez e economize (cotas limitadas).",
        advancePaymentSubtitleSimple: "Pague vários meses de uma vez e se sinta um VIP com desconto especial.",
    },
    automation: {
        replenishmentStockThreshold: 2,
    },
    advancePaymentOptions: [
        { months: 3, discountPercent: 5 },
        { months: 6, discountPercent: 10 },
    ]
};


export const useAppData = (user: any | null, userData: UserData | null): AppData => {
    const [clients, setClients] = useState<Client[]>([]);
    const [budgetQuotes, setBudgetQuotes] = useState<BudgetQuote[]>([]);
    const [routes, setRoutes] = useState<Routes>({});
    const [unscheduledClients, setUnscheduledClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [replenishmentQuotes, setReplenishmentQuotes] = useState<ReplenishmentQuote[]>([]);
    const [advancePaymentRequests, setAdvancePaymentRequests] = useState<AdvancePaymentRequest[]>([]);
    const [setupCheck, setSetupCheck] = useState<'checking' | 'needed' | 'done'>('checking');
    
    // New state for advance plan logic
    const [advancePlanUsage, setAdvancePlanUsage] = useState({ count: 0, percentage: 0 });
    const [isAdvancePlanGloballyAvailable, setIsAdvancePlanGloballyAvailable] = useState(false);


    const [loading, setLoading] = useState({
        clients: true, budgetQuotes: true, routes: true, products: true, orders: true, settings: true, replenishmentQuotes: true, banks: true, transactions: true, advancePaymentRequests: true
    });

    const isUserAdmin = userData?.role === 'admin';

    // Generic function to set loading state
    const setLoadingState = <K extends keyof typeof loading>(key: K, value: boolean) => {
        setLoading(prev => ({ ...prev, [key]: value }));
    };
    
    // Initial Setup Check (runs once for everyone)
    useEffect(() => {
        const checkAdminExists = async () => {
            try {
                const adminQuery = await db.collection('users').where('role', '==', 'admin').limit(1).get();
                setSetupCheck(adminQuery.empty ? 'needed' : 'done');
            } catch (error) {
                console.error("Error checking for admin user:", error);
                setSetupCheck('done'); // Fallback to avoid getting stuck in a setup loop on error
            }
        };
        checkAdminExists();
    }, []);

    // Logic to calculate advance plan usage percentage
    useEffect(() => {
        const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
        if (activeClients.length === 0) {
            setAdvancePlanUsage({ count: 0, percentage: 0 });
            return;
        }
        const today = new Date();
        const advancePlanClientCount = activeClients.filter(c => {
            if (!c.payment.dueDate) return false;
            const dueDate = new Date(c.payment.dueDate);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // A client is on an advance plan if their due date is more than 32 days away
            return diffDays > 32;
        }).length;

        const percentage = (advancePlanClientCount / activeClients.length) * 100;
        setAdvancePlanUsage({ count: advancePlanClientCount, percentage });
    }, [clients]);

    // Logic to determine if advance plan is available based on usage and settings
    useEffect(() => {
        if (!settings) return;
        const isEnabledByAdmin = settings.features.advancePaymentPlanEnabled;
        const isBelowThreshold = advancePlanUsage.percentage < 10;
        setIsAdvancePlanGloballyAvailable(isEnabledByAdmin && isBelowThreshold);
    }, [settings, advancePlanUsage]);

    // Replenishment Automation
    useEffect(() => {
        // Run only once per session for admin
        const hasRunKey = `replenishmentCheck_${new Date().toISOString().split('T')[0]}`;
        if (!isUserAdmin || sessionStorage.getItem(hasRunKey) || !settings || clients.length === 0 || products.length === 0) {
            return;
        }

        const runReplenishmentCheck = async () => {
            console.log("Running replenishment check...");
            const threshold = settings.automation.replenishmentStockThreshold;
            const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
            const pendingQuotesClientIds = new Set(replenishmentQuotes.filter(q => q.status === 'suggested' || q.status === 'sent').map(q => q.clientId));

            for (const client of activeClients) {
                if (pendingQuotesClientIds.has(client.id)) continue;

                const lowStockItems = client.stock.filter(item => item.quantity <= threshold);
                if (lowStockItems.length === 0) continue;
                
                const itemsToReplenish: any[] = [];
                let total = 0;

                for (const lowItem of lowStockItems) {
                    const productInfo = products.find(p => p.id === lowItem.productId);
                    if (productInfo && productInfo.stock > 0) {
                        const quantityToSuggest = 5;
                        itemsToReplenish.push({ ...productInfo, quantity: quantityToSuggest });
                        total += productInfo.price * quantityToSuggest;
                    }
                }

                if (itemsToReplenish.length > 0) {
                    const newQuote: Omit<ReplenishmentQuote, 'id'> = {
                        clientId: client.id,
                        clientName: client.name,
                        items: itemsToReplenish,
                        total,
                        status: 'suggested',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    };
                    await db.collection('replenishmentQuotes').add(newQuote);
                    console.log(`Generated replenishment quote for ${client.name}`);
                }
            }
            sessionStorage.setItem(hasRunKey, 'true');
        };

        const timer = setTimeout(runReplenishmentCheck, 5000);
        return () => clearTimeout(timer);

    }, [isUserAdmin, settings, clients, products, replenishmentQuotes]);

    useEffect(() => {
        if (!isUserAdmin) return;
        const unsubClients = db.collection('clients').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(data);
            setLoadingState('clients', false);
        });
        const unsubBudgets = db.collection('pre-budgets').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetQuote));
            setBudgetQuotes(data);
            setLoadingState('budgetQuotes', false);
        });
        const unsubRoutes = db.collection('routes').doc('main').onSnapshot(doc => {
            if (doc.exists) {
                setRoutes(doc.data() as Routes);
            }
            setLoadingState('routes', false);
        });
        const unsubOrders = db.collection('orders').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setOrders(data);
            setLoadingState('orders', false);
        });
        const unsubQuotes = db.collection('replenishmentQuotes').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplenishmentQuote));
            setReplenishmentQuotes(data);
            setLoadingState('replenishmentQuotes', false);
        });
        const unsubBanks = db.collection('banks').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
            setBanks(data);
            setLoadingState('banks', false);
        });
        const unsubTransactions = db.collection('transactions').orderBy('date', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setTransactions(data);
            setLoadingState('transactions', false);
        });
        const unsubAdvanceRequests = db.collection('advancePaymentRequests').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdvancePaymentRequest));
            setAdvancePaymentRequests(data);
            setLoadingState('advancePaymentRequests', false);
        });


        return () => { unsubClients(); unsubBudgets(); unsubRoutes(); unsubOrders(); unsubQuotes(); unsubBanks(); unsubTransactions(); unsubAdvanceRequests(); };
    }, [isUserAdmin]);
    
    // Unscheduled Clients Logic
    useEffect(() => {
        if (!isUserAdmin) return;
        
        const scheduledClientIds = new Set();
        Object.keys(routes).forEach(dayKey => {
            const routeDay = routes[dayKey] as RouteDay | undefined;
            routeDay?.clients.forEach(client => scheduledClientIds.add(client.id));
        });
        
        const unscheduled = clients.filter(client => !scheduledClientIds.has(client.id));
        setUnscheduledClients(unscheduled);

    }, [clients, routes, isUserAdmin]);

    // Products and Settings listeners (publicly available)
    useEffect(() => {
        if(setupCheck !== 'done') return;

        const unsubProducts = db.collection('products').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
            setProducts(data);
            setLoadingState('products', false);
        });
        const unsubSettings = db.collection('settings').doc('main').onSnapshot(doc => {
            if (doc.exists) {
                const settingsData = doc.data();
                const mergedSettings = deepMerge(JSON.parse(JSON.stringify(defaultSettings)), settingsData);
                setSettings(mergedSettings);
            } else {
                setSettings(defaultSettings);
            }
             setLoadingState('settings', false);
        });

        return () => { unsubProducts(); unsubSettings(); };
    }, [setupCheck]);

     // Client-specific data fetching
    useEffect(() => {
        if (userData?.role !== 'client' || !user) return;

        const unsubOrders = db.collection('orders').where('clientId', '==', user.uid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setOrders(data);
            setLoadingState('orders', false);
        });

        const unsubQuotes = db.collection('replenishmentQuotes').where('clientId', '==', user.uid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplenishmentQuote));
            setReplenishmentQuotes(data);
            setLoadingState('replenishmentQuotes', false);
        });
        
        const unsubAdvanceRequests = db.collection('advancePaymentRequests').where('clientId', '==', user.uid).orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdvancePaymentRequest));
            setAdvancePaymentRequests(data);
            setLoadingState('advancePaymentRequests', false);
        });

        return () => { unsubOrders(); unsubQuotes(); unsubAdvanceRequests(); };
    }, [user, userData]);

    const createInitialAdmin = async (name: string, email: string, pass: string) => {
        const adminQuery = await db.collection('users').where('role', '==', 'admin').limit(1).get();
        if (!adminQuery.empty) {
            throw new Error("Um administrador já existe. A criação foi cancelada.");
        }
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const newUid = userCredential.user.uid;
            await db.collection('users').doc(newUid).set({
                name,
                email,
                role: 'admin',
                uid: newUid,
            });
            setSetupCheck('done');
        } catch (error: any) {
            console.error("Error creating initial admin:", error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error("Este email já existe na autenticação, mas não como admin. Por favor, remova-o no painel do Firebase e tente novamente.");
            }
            throw new Error("Falha ao criar administrador: " + error.message);
        }
    };

    const approveBudgetQuote = async (budgetId: string) => {
        const budgetDoc = await db.collection('pre-budgets').doc(budgetId).get();
        if (!budgetDoc.exists) throw new Error("Orçamento não encontrado.");

        const budget = budgetDoc.data() as BudgetQuote;

        const defaultPassword = "password123";
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(budget.email, defaultPassword);
            const newUid = userCredential.user.uid;

            const batch = db.batch();

            const userDocRef = db.collection('users').doc(newUid);
            batch.set(userDocRef, { name: budget.name, email: budget.email, role: 'client', uid: newUid });

            const clientDocRef = db.collection('clients').doc();
            const newClient: Omit<Client, 'id'> = {
                uid: newUid,
                name: budget.name,
                email: budget.email,
                phone: budget.phone,
                address: budget.address,
                poolDimensions: budget.poolDimensions,
                poolVolume: budget.poolVolume,
                hasWellWater: budget.hasWellWater,
                includeProducts: budget.includeProducts,
                plan: budget.plan,
                fidelityPlan: budget.fidelityPlan,
                clientStatus: 'Ativo',
                poolStatus: { ph: 7.2, cloro: 1.5, alcalinidade: 100, uso: 'Livre para uso' },
                payment: {
                    status: 'Pendente',
                    dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
                },
                stock: [],
                pixKey: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastVisitDuration: 0,
            };
            batch.set(clientDocRef, newClient);

            const budgetRef = db.collection('pre-budgets').doc(budgetId);
            batch.update(budgetRef, { status: 'approved' });
            
            await batch.commit();

        } catch (error: any) {
            console.error("Erro ao aprovar orçamento de novo cliente:", error);
            if (error.code === 'auth/email-already-in-use') {
                 await db.collection('pre-budgets').doc(budgetId).update({ status: 'rejected' });
                 throw new Error("Este email já está em uso. Orçamento recusado.");
            }
            throw error;
        }
    };
    
    const rejectBudgetQuote = (budgetId: string) => db.collection('pre-budgets').doc(budgetId).update({ status: 'rejected' });
    const updateClient = (clientId: string, data: Partial<Client>) => db.collection('clients').doc(clientId).update(data);
    const deleteClient = (clientId: string) => db.collection('clients').doc(clientId).delete();

    const markAsPaid = async (client: Client) => {
        if (!client.bankId) {
            throw new Error("Por favor, associe um banco a este cliente antes de registrar um pagamento.");
        }
        if (!settings) {
            throw new Error("Configurações de precificação não carregadas.");
        }
        const bank = banks.find(b => b.id === client.bankId);
        if (!bank) {
            throw new Error("Banco associado não encontrado. Verifique as configurações.");
        }
        
        const batch = db.batch();
        const monthlyFee = calculateClientMonthlyFee(client, settings);

        const transactionRef = db.collection('transactions').doc();
        const newTransaction: Omit<Transaction, 'id'> = {
            clientId: client.id,
            clientName: client.name,
            bankId: client.bankId,
            bankName: bank.name,
            amount: monthlyFee,
            date: firebase.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(transactionRef, newTransaction);
        
        const nextDueDate = new Date(client.payment.dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);

        const clientRef = db.collection('clients').doc(client.id);
        const clientUpdate = {
            'payment.dueDate': nextDueDate.toISOString(),
            'payment.status': 'Pago'
        };
        batch.update(clientRef, clientUpdate);

        await batch.commit();
    };
    
    const updateClientStock = (clientId: string, stock: ClientProduct[]) => updateClient(clientId, { stock });

    const scheduleClient = async (clientId: string, dayKey: string) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        await db.collection('routes').doc('main').set({
            [dayKey]: {
                clients: firebase.firestore.FieldValue.arrayUnion(client)
            }
        }, { merge: true });
    };

    const unscheduleClient = async (clientId: string, dayKey: string) => {
        const routeDay = routes[dayKey] as RouteDay | undefined;
        if(!routeDay) return;
        const client = routeDay.clients.find(c => c.id === clientId);
        if (!client) return;
        await db.collection('routes').doc('main').update({
            [`${dayKey}.clients`]: firebase.firestore.FieldValue.arrayRemove(client)
        });
    };

    const toggleRouteStatus = (dayKey: string, status: boolean) => {
        return db.collection('routes').doc('main').update({
            [`${dayKey}.isRouteActive`]: status
        });
    };

    const saveProduct = (product: Omit<Product, 'id'> | Product) => {
        if ('id' in product) {
            return db.collection('products').doc(product.id).update(product);
        }
        return db.collection('products').add(product);
    };

    const deleteProduct = (productId: string) => db.collection('products').doc(productId).delete();
    
    const saveBank = (bank: Omit<Bank, 'id'> | Bank) => {
        if ('id' in bank) {
            return db.collection('banks').doc(bank.id).update(bank);
        }
        return db.collection('banks').add(bank);
    };

    const deleteBank = (bankId: string) => db.collection('banks').doc(bankId).delete();

    const updateOrderStatus = (orderId: string, status: OrderStatus) => db.collection('orders').doc(orderId).update({ status });
    const updateSettings = (newSettings: Partial<Settings>) => db.collection('settings').doc('main').set(newSettings, { merge: true });
    
    const createBudgetQuote = (budgetData: Omit<BudgetQuote, 'id' | 'status' | 'createdAt'>) => {
        const budget: Omit<BudgetQuote, 'id'> = {
            ...budgetData,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection('pre-budgets').add(budget);
    };

    const createOrder = (orderData: Omit<Order, 'id' | 'createdAt'>) => {
        const order: Omit<Order, 'id'> = {
            ...orderData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection('orders').add(order);
    };

    const updateReplenishmentQuoteStatus = async (quoteId: string, status: ReplenishmentQuoteStatus) => {
        await db.collection('replenishmentQuotes').doc(quoteId).update({
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    const createAdvancePaymentRequest = (requestData: Omit<AdvancePaymentRequest, 'id'|'status'|'createdAt'|'updatedAt'>) => {
        const request: Omit<AdvancePaymentRequest, 'id'> = {
            ...requestData,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        return db.collection('advancePaymentRequests').add(request);
    };

    const approveAdvancePaymentRequest = async (requestId: string) => {
        const requestDoc = await db.collection('advancePaymentRequests').doc(requestId).get();
        if (!requestDoc.exists) throw new Error("Solicitação não encontrada.");
        
        const request = requestDoc.data() as AdvancePaymentRequest;
        const client = clients.find(c => c.uid === request.clientId);

        if (!client || !client.bankId) {
            throw new Error("Cliente ou banco de recebimento do cliente não encontrado.");
        }
        const bank = banks.find(b => b.id === client.bankId);
        if (!bank) {
             throw new Error("Banco do cliente não configurado.");
        }

        const batch = db.batch();
        
        const transactionRef = db.collection('transactions').doc();
        const newTransaction: Omit<Transaction, 'id'> = {
            clientId: client.id,
            clientName: client.name,
            bankId: client.bankId,
            bankName: bank.name,
            amount: request.finalAmount,
            date: firebase.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(transactionRef, newTransaction);
        
        const nextDueDate = new Date(client.payment.dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + request.months);

        const clientRef = db.collection('clients').doc(client.id);
        batch.update(clientRef, { 'payment.dueDate': nextDueDate.toISOString(), 'payment.status': 'Pago' });

        const requestRef = db.collection('advancePaymentRequests').doc(requestId);
        batch.update(requestRef, { status: 'approved', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

        await batch.commit();
    };
    
    const rejectAdvancePaymentRequest = (requestId: string) => {
        return db.collection('advancePaymentRequests').doc(requestId).update({ 
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    const getClientData = useCallback(async (): Promise<Client | null> => {
        if (userData?.role !== 'client' || !user) return null;
        setLoadingState('clients', true);
        try {
            const querySnapshot = await db.collection('clients').where('uid', '==', user.uid).limit(1).get();
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const clientData = { id: doc.id, ...doc.data() } as Client;
                setClients([clientData]);
                return clientData;
            }
            return null;
        } catch (error) {
            console.error("Error fetching client data:", error);
            return null;
        } finally {
            setLoadingState('clients', false);
        }
    }, [user, userData]);

    const resetReportsData = async () => {
        if (!window.confirm("Você tem certeza? Esta ação irá apagar todos os dados de relatórios (orçamentos, pedidos, sugestões de reposição e rotas), mas irá PRESERVAR seus clientes e produtos. Esta ação é irreversível.")) {
            return;
        }

        try {
            const collectionsToDelete = ['pre-budgets', 'orders', 'replenishmentQuotes', 'transactions', 'advancePaymentRequests'];
            for (const collectionName of collectionsToDelete) {
                const snapshot = await db.collection(collectionName).get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            await db.collection('routes').doc('main').set({});
            
            alert('Dados de relatórios foram resetados com sucesso.');
        } catch (error) {
            console.error("Erro ao resetar os dados:", error);
            alert('Ocorreu um erro ao resetar os dados.');
        }
    };


    return {
        clients, budgetQuotes, routes, unscheduledClients, products, orders, banks, transactions, settings, replenishmentQuotes, advancePaymentRequests, loading,
        setupCheck, createInitialAdmin,
        isAdvancePlanGloballyAvailable, advancePlanUsage,
        approveBudgetQuote, rejectBudgetQuote, updateClient, deleteClient, markAsPaid, updateClientStock,
        scheduleClient, unscheduleClient, toggleRouteStatus, saveProduct, deleteProduct, saveBank, deleteBank,
        updateOrderStatus, updateSettings, createBudgetQuote, createOrder, getClientData,
        updateReplenishmentQuoteStatus, createAdvancePaymentRequest, approveAdvancePaymentRequest, rejectAdvancePaymentRequest,
        resetReportsData,
    };
};