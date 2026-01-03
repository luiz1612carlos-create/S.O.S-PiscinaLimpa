
import { useState, useEffect, useCallback } from 'react';
import { db, firebase, auth, storage } from '../firebase';
import {
    Client, BudgetQuote, Routes, Product, Order, Settings, ClientProduct, UserData,
    OrderStatus, AppData, ReplenishmentQuote, ReplenishmentQuoteStatus, Bank, Transaction,
    AdvancePaymentRequest, AdvancePaymentRequestStatus, RouteDay, FidelityPlan, Visit, StockProduct,
    PendingPriceChange, PricingSettings, AffectedClientPreview, PoolEvent, RecessPeriod, PlanChangeRequest, PlanType
} from '../types';
import { compressImage } from '../utils/calculations';

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
    companyName: "S.O.S Piscina Limpa",
    mainTitle: "S.O.S Piscina Limpa",
    mainSubtitle: "Compromisso e Qualidade",
    logoUrl: "",
    logoObjectFit: 'contain',
    logoTransforms: {
        scale: 1,
        rotate: 0,
        brightness: 1,
        contrast: 1,
        grayscale: 0,
    },
    baseAddress: {
        street: "Rua Principal",
        number: "123",
        neighborhood: "Centro",
        city: "Sua Cidade",
        state: "SP",
        zip: "12345-000",
    },
    pixKey: "seu-pix@email.com",
    pixKeyRecipient: "S.O.S Piscina Limpa",
    whatsappMessageTemplate: "Olá {CLIENTE}, tudo bem? Passando para lembrar sobre o vencimento da sua mensalidade no valor de R$ {VALOR} no dia {VENCIMENTO}. \n\nChave PIX: {PIX} \nDestinatário: {DESTINATARIO}\n\nAgradecemos a parceria!",
    announcementMessageTemplate: "Atenção! ⚠️\n\nInformamos que nessas datas nossos serviços não estarão disponíveis.\n(Envie a imagem do calendário/aviso após abrir o WhatsApp)\n\nAcesse sua conta do cliente pelo site: https://s-o-s-piscina-limpa.vercel.app/\n\nVá na opção 'Agendar Evento' e faça sua programação. Isso nos ajudará a nos organizar e entregar a qualidade necessária.\n\nAcesse sua conta cliente:\nLogin: {LOGIN}\nSenha: (sua senha de acesso)",
    pricing: {
        perKm: 1.5,
        wellWaterFee: 50,
        productsFee: 75,
        partyPoolFee: 100,
        volumeTiers: [
            { min: 0, max: 20000, price: 150 },
            { min: 20001, max: 50000, price: 250 },
            { min: 50001, max: 100000, price: 400 },
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
        planUpgradeEnabled: true,
        vipPlanDisabledMessage: "Em breve!",
        vipUpgradeTitle: "Descubra o Plano VIP",
        vipUpgradeDescription: "Tenha produtos inclusos, atendimento prioritário e descontos exclusivos.",
        storeEnabled: true,
        advancePaymentPlanEnabled: false,
        advancePaymentTitle: "Economize com Pagamento Adiantado!",
        advancePaymentSubtitleVIP: "Pague vários meses de uma vez e economize (cotas limitadas).",
        advancePaymentSubtitleSimple: "Pague vários meses de uma vez e se sinta um VIP com desconto especial.",
        maintenanceModeEnabled: false,
        maintenanceMessage: "O aplicativo está em manutenção temporária para melhorias. Voltaremos em breve!",
    },
    automation: {
        replenishmentStockThreshold: 2,
    },
    advancePaymentOptions: [
        { months: 3, discountPercent: 5 },
        { months: 6, discountPercent: 10 },
    ],
    recessPeriods: [],
};

const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return null;
};


export const useAppData = (user: any | null, userData: UserData | null): AppData => {
    const [clients, setClients] = useState<Client[]>([]);
    const [users, setUsers] = useState<UserData[]>([]);
    const [budgetQuotes, setBudgetQuotes] = useState<BudgetQuote[]>([]);
    const [routes, setRoutes] = useState<Routes>({});
    const [products, setProducts] = useState<Product[]>([]);
    const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [replenishmentQuotes, setReplenishmentQuotes] = useState<ReplenishmentQuote[]>([]);
    const [advancePaymentRequests, setAdvancePaymentRequests] = useState<AdvancePaymentRequest[]>([]);
    const [pendingPriceChanges, setPendingPriceChanges] = useState<PendingPriceChange[]>([]);
    const [poolEvents, setPoolEvents] = useState<PoolEvent[]>([]);
    const [planChangeRequests, setPlanChangeRequests] = useState<PlanChangeRequest[]>([]);
    const [setupCheck, setSetupCheck] = useState<'checking' | 'needed' | 'done'>('checking');
    
    const [advancePlanUsage, setAdvancePlanUsage] = useState({ count: 0, percentage: 0 });
    const [isAdvancePlanGloballyAvailable, setIsAdvancePlanGloballyAvailable] = useState(false);


    const [loading, setLoading] = useState({
        clients: true, users: true, budgetQuotes: true, routes: true, products: true, stockProducts: true, orders: true, settings: true, replenishmentQuotes: true, banks: true, transactions: true, advancePaymentRequests: true, pendingPriceChanges: true, poolEvents: true, planChangeRequests: true
    });

    const isUserAdmin = userData?.role === 'admin';
    const isUserTechnician = userData?.role === 'technician';

    const setLoadingState = <K extends keyof typeof loading>(key: K, value: boolean) => {
        setLoading(prev => ({ ...prev, [key]: value }));
    };
    
    useEffect(() => {
        const checkAdminExists = async () => {
            try {
                const adminQuery = await db.collection('users').where('role', '==', 'admin').limit(1).get();
                setSetupCheck(adminQuery.empty ? 'needed' : 'done');
            } catch (error: any) {
                if (error.code === 'permission-denied') {
                    setSetupCheck('done');
                } else {
                    setSetupCheck('needed'); 
                }
            }
        };
        checkAdminExists();
    }, []);

    useEffect(() => {
        const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
        if (activeClients.length === 0) {
            setAdvancePlanUsage({ count: 0, percentage: 0 });
            return;
        }
        const today = new Date();
        const advancePlanClientCount = activeClients.filter(c => {
            if (!c.advancePaymentUntil) return false;
            const advanceUntilDate = toDate(c.advancePaymentUntil);
            return advanceUntilDate && advanceUntilDate > today;
        }).length;

        const percentage = (advancePlanClientCount / activeClients.length) * 100;
        setAdvancePlanUsage({ count: advancePlanClientCount, percentage });
    }, [clients]);

    useEffect(() => {
        if (!settings) return;
        const isEnabledByAdmin = settings.features.advancePaymentPlanEnabled;
        const isBelowThreshold = advancePlanUsage.percentage < 10;
        setIsAdvancePlanGloballyAvailable(isEnabledByAdmin && isBelowThreshold);
    }, [settings, advancePlanUsage]);

    const triggerReplenishmentAnalysis = async (): Promise<number> => {
        if (!isUserAdmin || !settings || clients.length === 0 || products.length === 0) {
            return 0;
        }

        const threshold = settings.automation.replenishmentStockThreshold;
        const activeClients = clients.filter(c => c.clientStatus === 'Ativo');
        const pendingQuotesClientIds = new Set(replenishmentQuotes.filter(q => q.status === 'suggested' || q.status === 'sent').map(q => q.clientId));
        
        let generatedCount = 0;

        for (const client of activeClients) {
            if (pendingQuotesClientIds.has(client.uid || client.id)) continue;

            const lowStockItems = client.stock.filter(item => {
                const limit = item.maxQuantity ? Math.max(threshold, item.maxQuantity * 0.3) : threshold;
                return item.quantity <= limit;
            });

            if (lowStockItems.length === 0) continue;
            
            const itemsToReplenish: any[] = [];
            let total = 0;

            for (const lowItem of lowStockItems) {
                const productInfo = products.find(p => p.id === lowItem.productId);
                if (productInfo) {
                    let quantityToSuggest = lowItem.maxQuantity ? (lowItem.maxQuantity - lowItem.quantity) : 5;
                    if (quantityToSuggest > 0) {
                        itemsToReplenish.push({ ...productInfo, quantity: quantityToSuggest });
                        total += productInfo.price * quantityToSuggest;
                    }
                }
            }

            if (itemsToReplenish.length > 0) {
                const newQuote: Omit<ReplenishmentQuote, 'id'> = {
                    clientId: client.uid || client.id,
                    clientName: client.name,
                    items: itemsToReplenish,
                    total,
                    status: 'suggested',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                };
                await db.collection('replenishmentQuotes').add(newQuote);
                generatedCount++;
            }
        }
        return generatedCount;
    };
    
    useEffect(() => {
        if (!isUserAdmin || pendingPriceChanges.length === 0 || !settings) return;

        const applyOverduePriceChanges = async () => {
            const now = firebase.firestore.Timestamp.now();
            const overdueChanges = pendingPriceChanges.filter(c => 
                c.status === 'pending' && c.effectiveDate && c.effectiveDate <= now
            );

            if (overdueChanges.length === 0) return;
            
            for (const change of overdueChanges) {
                try {
                    const batch = db.batch();
                    const settingsRef = db.collection('settings').doc('main');
                    const activeVips = clients.filter(c => c.clientStatus === 'Ativo' && c.plan === 'VIP');
                    
                    activeVips.forEach(vip => {
                        if (!vip.customPricing) {
                            const vipRef = db.collection('clients').doc(vip.id);
                            batch.update(vipRef, { customPricing: settings.pricing });
                        }
                    });

                    batch.set(settingsRef, { pricing: change.newPricing }, { merge: true });
                    batch.update(db.collection('pendingPriceChanges').doc(change.id), { status: 'applied' });
                    await batch.commit();
                } catch (error) {
                    console.error(`Failed to apply price change ${change.id}:`, error);
                }
            }
        };

        const timer = setTimeout(applyOverduePriceChanges, 3000);
        return () => clearTimeout(timer);

    }, [isUserAdmin, pendingPriceChanges, settings, clients]);

    useEffect(() => {
        if (!isUserAdmin && !isUserTechnician) return;

        const unsubUsers = db.collection('users').where('role', 'in', ['admin', 'technician']).onSnapshot(snapshot => {
            setUsers(snapshot.docs.map(doc => doc.data() as UserData));
            setLoadingState('users', false);
        });
        
        const unsubClients = db.collection('clients').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
            setLoadingState('clients', false);
        });

        const unsubBudgets = db.collection('quotes').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setBudgetQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetQuote)));
            setLoadingState('budgetQuotes', false);
        });

        const unsubRoutes = db.collection('routes').doc('main').onSnapshot(doc => {
            if (doc.exists) setRoutes(doc.data() as Routes);
            setLoadingState('routes', false);
        });

        const unsubOrders = db.collection('orders').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
            setLoadingState('orders', false);
        });

        const unsubQuotes = db.collection('replenishmentQuotes').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setReplenishmentQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplenishmentQuote)));
            setLoadingState('replenishmentQuotes', false);
        });

        const unsubBanks = db.collection('banks').onSnapshot(snapshot => {
            setBanks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank)));
            setLoadingState('banks', false);
        });

        const unsubTransactions = db.collection('transactions').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            data.sort((a, b) => {
                const dateA = a.date?.seconds || (Date.now() / 1000);
                const dateB = b.date?.seconds || (Date.now() / 1000);
                return dateB - dateA;
            });
            setTransactions(data);
            setLoadingState('transactions', false);
        });

        const unsubAdvanceRequests = db.collection('advancePaymentRequests').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setAdvancePaymentRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdvancePaymentRequest)));
            setLoadingState('advancePaymentRequests', false);
        });

        const unsubStockProducts = db.collection('stockProducts').onSnapshot(snapshot => {
            setStockProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockProduct)));
            setLoadingState('stockProducts', false);
        });

        const unsubPendingChanges = db.collection('pendingPriceChanges').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setPendingPriceChanges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingPriceChange)));
            setLoadingState('pendingPriceChanges', false);
        });

        const unsubEvents = db.collection('poolEvents').orderBy('eventDate', 'asc').onSnapshot(snapshot => {
            setPoolEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PoolEvent)));
            setLoadingState('poolEvents', false);
        });

        const unsubPlanChanges = db.collection('planChangeRequests').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            setPlanChangeRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanChangeRequest)));
            setLoadingState('planChangeRequests', false);
        });

        return () => { unsubUsers(); unsubClients(); unsubBudgets(); unsubRoutes(); unsubOrders(); unsubQuotes(); unsubBanks(); unsubTransactions(); unsubAdvanceRequests(); unsubStockProducts(); unsubPendingChanges(); unsubEvents(); unsubPlanChanges(); };
    }, [isUserAdmin, isUserTechnician]);
    
    useEffect(() => {
        const unsubProducts = db.collection('products').onSnapshot(snapshot => {
            setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
            setLoadingState('products', false);
        });

        const unsubSettings = db.collection('settings').doc('main').onSnapshot(doc => {
            if (doc.exists) {
                setSettings(deepMerge(JSON.parse(JSON.stringify(defaultSettings)), doc.data()));
            } else {
                setSettings(defaultSettings);
            }
            setLoadingState('settings', false);
        });
        
        const unsubBanks = db.collection('banks').onSnapshot(snapshot => {
            setBanks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank)));
            setLoadingState('banks', false);
        });

        return () => { unsubProducts(); unsubSettings(); unsubBanks(); };
    }, []);

    useEffect(() => {
        if (userData?.role !== 'client' || !user) return;
        
        const unsubClient = db.collection('clients').where('uid', '==', user.uid).limit(1).onSnapshot(snapshot => {
            if (!snapshot.empty) setClients([{ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Client]);
            setLoadingState('clients', false);
        });

        const unsubOrders = db.collection('orders').where('clientId', 'in', [user.uid, user.id || '']).onSnapshot(snapshot => {
            setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
            setLoadingState('orders', false);
        });

        const unsubQuotes = db.collection('replenishmentQuotes').where('clientId', 'in', [user.uid, user.id || '']).onSnapshot(snapshot => {
            setReplenishmentQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplenishmentQuote)));
            setLoadingState('replenishmentQuotes', false);
        });
        
        const unsubAdvanceRequests = db.collection('advancePaymentRequests').where('clientId', 'in', [user.uid, user.id || '']).onSnapshot(snapshot => {
            setAdvancePaymentRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdvancePaymentRequest)));
            setLoadingState('advancePaymentRequests', false);
        });

        const unsubEvents = db.collection('poolEvents').where('clientId', 'in', [user.uid, user.id || '']).onSnapshot(snapshot => {
            setPoolEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PoolEvent)));
            setLoadingState('poolEvents', false);
        });
        
        const unsubPendingChanges = db.collection('pendingPriceChanges').where('status', '==', 'pending').onSnapshot(snapshot => {
            setPendingPriceChanges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingPriceChange)));
            setLoadingState('pendingPriceChanges', false);
        });
            
        const unsubPlanChanges = db.collection('planChangeRequests').where('clientId', 'in', [user.uid, user.id || '']).onSnapshot(snapshot => {
            setPlanChangeRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanChangeRequest)));
            setLoadingState('planChangeRequests', false);
        });

        return () => { unsubClient(); unsubOrders(); unsubQuotes(); unsubAdvanceRequests(); unsubEvents(); unsubPendingChanges(); unsubPlanChanges(); };
    }, [user, userData]);

    const createInitialAdmin = async (name: string, email: string, pass: string) => {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const newUid = userCredential.user.uid;
        await db.collection('users').doc(newUid).set({ name, email, role: 'admin', uid: newUid });
        setSetupCheck('done');
    };

    const createTechnician = async (name: string, email: string, pass: string) => {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const newUid = userCredential.user.uid;
        await db.collection('users').doc(newUid).set({ name, email, role: 'technician', uid: newUid });
        await auth.signOut();
    };


    const approveBudgetQuote = async (budgetId: string, password: string, distanceFromHq?: number) => {
        const budgetDoc = await db.collection('quotes').doc(budgetId).get();
        if (!budgetDoc.exists) throw new Error("Orçamento não encontrado.");
        const budget = budgetDoc.data() as BudgetQuote;

        const userCredential = await auth.createUserWithEmailAndPassword(budget.email, password);
        const newUid = userCredential.user.uid;
        const batch = db.batch();
        batch.set(db.collection('users').doc(newUid), { name: budget.name, email: budget.email, role: 'client', uid: newUid });
        batch.set(db.collection('clients').doc(), {
            uid: newUid, name: budget.name, email: budget.email, phone: budget.phone, address: budget.address,
            poolDimensions: budget.poolDimensions, poolVolume: budget.poolVolume, hasWellWater: budget.hasWellWater,
            includeProducts: false, isPartyPool: budget.isPartyPool, plan: budget.plan, clientStatus: 'Ativo',
            poolStatus: { ph: 7.2, cloro: 1.5, alcalinidade: 100, uso: 'Livre para uso' },
            payment: { status: 'Pendente', dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() },
            stock: [], pixKey: '', createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastVisitDuration: 0,
            distanceFromHq: distanceFromHq || budget.distanceFromHq || 0,
            fidelityPlan: budget.fidelityPlan || null
        });
        batch.update(db.collection('quotes').doc(budgetId), { status: 'approved' });
        await batch.commit();
    };
    
    const rejectBudgetQuote = (budgetId: string) => db.collection('quotes').doc(budgetId).delete();
    const updateClient = (clientId: string, data: Partial<Client>) => db.collection('clients').doc(clientId).update(data);
    const deleteClient = (clientId: string) => db.collection('clients').doc(clientId).delete();

    const markAsPaid = async (client: Client, months: number, totalAmount: number) => {
        if (!client.bankId) throw new Error("Associe um banco a este cliente antes.");
        const bank = banks.find(b => b.id === client.bankId);
        if (!bank) throw new Error("Banco não encontrado.");
        
        const batch = db.batch();
        batch.set(db.collection('transactions').doc(), {
            clientId: client.id, clientName: client.name, bankId: client.bankId, bankName: bank.name,
            amount: totalAmount, date: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const currentDueDate = new Date(client.payment.dueDate);
        const today = new Date();
        today.setHours(12, 0, 0, 0); // Hora neutra para cálculos de data

        const targetDay = currentDueDate.getDate();

        // Calculamos a base: o maior entre Hoje ou a data do Vencimento Atual.
        // Isso garante que se o cliente estiver muito atrasado, o sistema pule para o próximo ciclo futuro 
        // mantendo o dia fixo do mês.
        let nextDate = new Date(Math.max(today.getTime(), currentDueDate.getTime()));
        
        // Avançamos o(s) mês(es) solicitado(s)
        nextDate.setMonth(nextDate.getMonth() + months);
        
        // Tentamos restaurar o dia fixo
        nextDate.setDate(targetDay);
        
        // Correção para meses curtos (ex: 31 Jan -> 28 Fev)
        if (nextDate.getDate() !== targetDay) {
            nextDate.setDate(0); 
        }

        const nextDueDateISO = nextDate.toISOString();

        const update: any = { 'payment.dueDate': nextDueDateISO, 'payment.status': 'Pago' };
        if (client.advancePaymentUntil) update.advancePaymentUntil = firebase.firestore.FieldValue.delete();
        if (client.scheduledPlanChange) {
            update.plan = client.scheduledPlanChange.newPlan;
            update.fidelityPlan = client.scheduledPlanChange.fidelityPlan || firebase.firestore.FieldValue.delete();
            update.scheduledPlanChange = firebase.firestore.FieldValue.delete();
        }

        batch.update(db.collection('clients').doc(client.id), update);
        await batch.commit();
    };
    
    const updateClientStock = (clientId: string, stock: ClientProduct[]) => updateClient(clientId, { stock });

    const scheduleClient = async (clientId: string, dayKey: string) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        await db.collection('routes').doc('main').set({
            [dayKey]: { day: dayKey, isRouteActive: false, clients: firebase.firestore.FieldValue.arrayUnion(client) }
        }, { merge: true });
    };

    const unscheduleClient = async (clientId: string, dayKey: string) => {
        const routeDay = routes[dayKey];
        if(!routeDay) return;
        const client = routeDay.clients.find(c => c.id === clientId);
        if (!client) return;
        await db.collection('routes').doc('main').update({ [`${dayKey}.clients`]: firebase.firestore.FieldValue.arrayRemove(client) });
    };

    const toggleRouteStatus = (dayKey: string, status: boolean) => db.collection('routes').doc('main').update({ [`${dayKey}.isRouteActive`]: status });

    const saveProduct = async (product: Omit<Product, 'id'> | Product, imageFile?: File) => {
        let productData = { ...product };
        let docRef = ('id' in product) ? db.collection('products').doc(product.id) : db.collection('products').doc();
        if (imageFile) {
            const compressed = await compressImage(imageFile, { maxWidth: 1024, quality: 0.8 });
            const snapshot = await storage.ref(`products/${docRef.id}/${compressed.name}`).put(compressed);
            productData.imageUrl = await snapshot.ref.getDownloadURL();
        }
        return ('id' in product) ? docRef.update(productData) : docRef.set(productData);
    };

    const deleteProduct = (productId: string) => db.collection('products').doc(productId).delete();
    const saveStockProduct = (product: Omit<StockProduct, 'id'> | StockProduct) => ('id' in product) ? db.collection('stockProducts').doc(product.id).update(product) : db.collection('stockProducts').add(product);
    
    const deleteStockProduct = async (productId: string, cleanupClients?: boolean) => {
        if (cleanupClients) {
            await removeStockProductFromAllClients(productId);
        }
        return db.collection('stockProducts').doc(productId).delete();
    };

    const removeStockProductFromAllClients = async (productId: string): Promise<number> => {
        const clientsSnap = await db.collection('clients').get();
        let count = 0;
        const batch = db.batch();
        
        clientsSnap.docs.forEach(doc => {
            const client = doc.data() as Client;
            if (client.stock && client.stock.some(s => s.productId === productId)) {
                const newStock = client.stock.filter(s => s.productId !== productId);
                batch.update(doc.ref, { stock: newStock });
                count++;
            }
        });
        
        if (count > 0) await batch.commit();
        return count;
    };

    const saveBank = (bank: Omit<Bank, 'id'> | Bank) => ('id' in bank) ? db.collection('banks').doc(bank.id).update(bank) : db.collection('banks').add(bank);
    const deleteBank = (bankId: string) => db.collection('banks').doc(bankId).delete();
    const updateOrderStatus = (orderId: string, status: OrderStatus) => db.collection('orders').doc(orderId).update({ status });
    
    const updateSettings = async (newSettings: Partial<Settings>, logoFile?: File, removeLogo?: boolean, onProgress?: (progress: number) => void) => {
        const update: any = { ...newSettings };
        if (removeLogo) {
            update.logoUrl = firebase.firestore.FieldValue.delete();
            try { await storage.ref('settings/logo').delete(); } catch(e) {}
        } else if (logoFile) {
            const compressed = await compressImage(logoFile, { maxWidth: 512, quality: 0.9 });
            const uploadTask = storage.ref('settings/logo').put(compressed);
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', (s: any) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100), reject, async () => {
                    update.logoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve();
                });
            });
        }
        return db.collection('settings').doc('main').set(update, { merge: true });
    };
    
    const schedulePriceChange = async (newPricing: PricingSettings, affectedClients: AffectedClientPreview[]) => {
        const effectiveDate = new Date();
        effectiveDate.setDate(effectiveDate.getDate() + 30);
        await db.collection('pendingPriceChanges').add({
            effectiveDate: firebase.firestore.Timestamp.fromDate(effectiveDate),
            newPricing, affectedClients, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    const createBudgetQuote = (budgetData: Omit<BudgetQuote, 'id' | 'status' | 'createdAt'>) => db.collection('quotes').add({ ...budgetData, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    const createOrder = (orderData: Omit<Order, 'id' | 'createdAt'>) => db.collection('orders').add({ ...orderData, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    
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

    const updateReplenishmentQuoteStatus = (quoteId: string, status: ReplenishmentQuoteStatus) => db.collection('replenishmentQuotes').doc(quoteId).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    const createAdvancePaymentRequest = (requestData: Omit<AdvancePaymentRequest, 'id'|'status'|'createdAt'|'updatedAt'>) => db.collection('advancePaymentRequests').add({ ...requestData, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

    const approveAdvancePaymentRequest = async (requestId: string) => {
        const doc = await db.collection('advancePaymentRequests').doc(requestId).get();
        if (!doc.exists) throw new Error("Solicitação não encontrada.");
        const req = doc.data() as AdvancePaymentRequest;
        const client = clients.find(c => c.uid === req.clientId);
        if (!client || !client.bankId) throw new Error("Cliente ou banco não encontrado.");
        const bank = banks.find(b => b.id === client.bankId);
        if (!bank) throw new Error("Banco não configurado.");

        const batch = db.batch();
        batch.set(db.collection('transactions').doc(), { clientId: client.id, clientName: client.name, bankId: client.bankId, bankName: bank.name, amount: req.finalAmount, date: firebase.firestore.FieldValue.serverTimestamp() });
        const nextDueDate = new Date(client.payment.dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + req.months);
        batch.update(db.collection('clients').doc(client.id), { 'payment.dueDate': nextDueDate.toISOString(), 'payment.status': 'Pago', 'advancePaymentUntil': firebase.firestore.Timestamp.fromDate(nextDueDate) });
        batch.update(db.collection('advancePaymentRequests').doc(requestId), { status: 'approved', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await batch.commit();
    };
    
    const rejectAdvancePaymentRequest = (requestId: string) => db.collection('advancePaymentRequests').doc(requestId).update({ status: 'rejected', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

    const addVisitRecord = async (clientId: string, visitData: Omit<Visit, 'id' | 'photoUrl' | 'timestamp' | 'technicianId' | 'technicianName'>, photoFile?: File, onProgress?: (progress: number) => void) => {
        if (!userData || (userData.role !== 'admin' && userData.role !== 'technician')) throw new Error("Acesso negado.");
        const visitId = db.collection('clients').doc().id;
        let photoUrl = '';
        if (photoFile) {
            const compressed = await compressImage(photoFile, { maxWidth: 1920, quality: 0.75 });
            const uploadTask = storage.ref(`visits/${clientId}/${visitId}_${compressed.name}`).put(compressed);
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', (s: any) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100), reject, async () => {
                    photoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                    resolve();
                });
            });
        }
        const newVisit: any = { id: visitId, technicianId: userData.uid, technicianName: userData.name, timestamp: firebase.firestore.Timestamp.now(), ...visitData };
        if (photoUrl) newVisit.photoUrl = photoUrl;
        await db.collection('clients').doc(clientId).update({
            visitHistory: firebase.firestore.FieldValue.arrayUnion(newVisit),
            'poolStatus.ph': visitData.ph, 'poolStatus.cloro': visitData.cloro, 'poolStatus.alcalinidade': visitData.alcalinidade, 'poolStatus.uso': visitData.uso
        });
    };

    const resetReportsData = async () => {
        if (!window.confirm("Confirma o reset? Isso apagará orçamentos, pedidos e transações.")) return;
        const cols = ['quotes', 'orders', 'replenishmentQuotes', 'transactions', 'advancePaymentRequests', 'planChangeRequests'];
        for (const c of cols) {
            const snap = await db.collection(c).get();
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        await db.collection('routes').doc('main').set({});
    };

    const createPoolEvent = (eventData: Omit<PoolEvent, 'id' | 'status' | 'createdAt'>) => db.collection('poolEvents').add({ ...eventData, status: 'notified', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    const acknowledgePoolEvent = (eventId: string) => db.collection('poolEvents').doc(eventId).update({ status: 'acknowledged' });
    const deletePoolEvent = (eventId: string) => db.collection('poolEvents').doc(eventId).delete();

    const saveRecessPeriod = async (recess: Omit<RecessPeriod, 'id'> | RecessPeriod) => {
        const snap = await db.collection('settings').doc('main').get();
        const recesses = (snap.data() as Settings).recessPeriods || [];
        if ('id' in recess) {
            const idx = recesses.findIndex(r => r.id === recess.id);
            if (idx > -1) recesses[idx] = recess;
        } else {
            recesses.push({ ...recess, id: db.collection('settings').doc().id });
        }
        return db.collection('settings').doc('main').update({ recessPeriods: recesses });
    };

    const deleteRecessPeriod = async (recessId: string) => {
        const snap = await db.collection('settings').doc('main').get();
        const recesses = ((snap.data() as Settings).recessPeriods || []).filter(r => r.id !== recessId);
        return db.collection('settings').doc('main').update({ recessesPeriods: recesses });
    };

    const requestPlanChange = (clientId: string, clientName: string, currentPlan: PlanType, requestedPlan: PlanType) => db.collection('planChangeRequests').add({ clientId, clientName, currentPlan, requestedPlan, status: 'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    const respondToPlanChangeRequest = (requestId: string, proposedPrice: number, notes: string) => db.collection('planChangeRequests').doc(requestId).update({ status: 'quoted', proposedPrice, adminNotes: notes, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

    const acceptPlanChange = async (requestId: string, price: number, fidelityPlan?: FidelityPlan) => {
        const snap = await db.collection('planChangeRequests').doc(requestId).get();
        if (!snap.exists) return;
        const req = snap.data() as PlanChangeRequest;
        const clientSnap = await db.collection('clients').where('uid', '==', req.clientId).limit(1).get();
        if (!clientSnap.empty) {
            const update: any = { scheduledPlanChange: { newPlan: req.requestedPlan, newPrice: price, effectiveDate: firebase.firestore.Timestamp.fromDate(new Date()) } };
            if (fidelityPlan) update.scheduledPlanChange.fidelityPlan = fidelityPlan;
            await clientSnap.docs[0].ref.update(update);
        }
        await db.collection('planChangeRequests').doc(requestId).update({ status: 'accepted', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    };

    const cancelPlanChangeRequest = (requestId: string) => db.collection('planChangeRequests').doc(requestId).update({ status: 'rejected', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });

    const cancelScheduledPlanChange = (clientId: string) => db.collection('clients').doc(clientId).update({ scheduledPlanChange: firebase.firestore.FieldValue.delete() });

    const acknowledgeTerms = (clientId: string) => db.collection('clients').doc(clientId).update({ lastAcceptedTermsAt: firebase.firestore.FieldValue.serverTimestamp() });

    return {
        clients, users, budgetQuotes, routes, products, stockProducts, orders, banks, transactions, settings, replenishmentQuotes, advancePaymentRequests, pendingPriceChanges, poolEvents, planChangeRequests, loading,
        setupCheck, createInitialAdmin, createTechnician,
        isAdvancePlanGloballyAvailable, advancePlanUsage,
        approveBudgetQuote, rejectBudgetQuote, updateClient, deleteClient, markAsPaid, updateClientStock,
        scheduleClient, unscheduleClient, toggleRouteStatus, saveProduct, deleteProduct, saveStockProduct, deleteStockProduct, removeStockProductFromAllClients, saveBank, deleteBank,
        updateOrderStatus, updateSettings, schedulePriceChange, createBudgetQuote, createOrder, getClientData,
        updateReplenishmentQuoteStatus, triggerReplenishmentAnalysis, createAdvancePaymentRequest, approveAdvancePaymentRequest, rejectAdvancePaymentRequest,
        addVisitRecord, resetReportsData, createPoolEvent, acknowledgePoolEvent, deletePoolEvent, saveRecessPeriod, deleteRecessPeriod,
        requestPlanChange, respondToPlanChangeRequest, acceptPlanChange, cancelPlanChangeRequest, cancelScheduledPlanChange, acknowledgeTerms
    };
};
