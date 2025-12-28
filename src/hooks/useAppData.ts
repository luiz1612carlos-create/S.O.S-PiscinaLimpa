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
        planUpgradeEnabled: true, // Default to true
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
    
    // New state for advance plan logic
    const [advancePlanUsage, setAdvancePlanUsage] = useState({ count: 0, percentage: 0 });
    const [isAdvancePlanGloballyAvailable, setIsAdvancePlanGloballyAvailable] = useState(false);


    const [loading, setLoading] = useState({
        clients: true, users: true, budgetQuotes: true, routes: true, products: true, stockProducts: true, orders: true, settings: true, replenishmentQuotes: true, banks: true, transactions: true, advancePaymentRequests: true, pendingPriceChanges: true, poolEvents: true, planChangeRequests: true
    });

    const isUserAdmin = userData?.role === 'admin';
    const isUserTechnician = userData?.role === 'technician';

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
                setSetupCheck('needed'); 
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
            if (!c.advancePaymentUntil) return false;
            const advanceUntilDate = toDate(c.advancePaymentUntil);
            return advanceUntilDate && advanceUntilDate > today;
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

                // Determine low stock items based on Global Threshold OR specific Max Quantity logic
                const lowStockItems = client.stock.filter(item => {
                    if (item.maxQuantity) {
                         // If maxQuantity is defined, we consider it low if it's below 30% OR below the global threshold
                         return item.quantity <= Math.max(threshold, item.maxQuantity * 0.3);
                    }
                    return item.quantity <= threshold;
                });

                if (lowStockItems.length === 0) continue;
                
                const itemsToReplenish: any[] = [];
                let total = 0;

                for (const lowItem of lowStockItems) {
                    const productInfo = products.find(p => p.id === lowItem.productId);
                    if (productInfo && productInfo.stock > 0) {
                        // Calculate suggested quantity
                        let quantityToSuggest = 0;
                        
                        if (lowItem.maxQuantity && lowItem.maxQuantity > lowItem.quantity) {
                            // If max quantity is set, fill up to max
                            quantityToSuggest = lowItem.maxQuantity - lowItem.quantity;
                        } else {
                            // Fallback logic: suggest 5 units or enough to pass threshold
                            quantityToSuggest = 5;
                        }

                        if (quantityToSuggest > 0) {
                            itemsToReplenish.push({ ...productInfo, quantity: quantityToSuggest });
                            total += productInfo.price * quantityToSuggest;
                        }
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
    
    // Price Change Automation
    useEffect(() => {
        // Ensure settings are loaded before applying changes to prevent overwriting with null/stale data
        if (!isUserAdmin || pendingPriceChanges.length === 0 || !settings) return;

        const applyOverduePriceChanges = async () => {
            const now = firebase.firestore.Timestamp.now();
            const overdueChanges = pendingPriceChanges.filter(c => 
                c.status === 'pending' && c.effectiveDate && c.effectiveDate <= now
            );

            if (overdueChanges.length === 0) return;
            
            console.log(`Applying ${overdueChanges.length} overdue price change(s)...`);

            for (const change of overdueChanges) {
                try {
                    const batch = db.batch();
                    const settingsRef = db.collection('settings').doc('main');
                    
                    // CRITICAL: Snapshot pricing for VIP clients so they don't suffer the price increase.
                    // VIP clients who are active and don't already have a custom pricing set should be locked to the current (old) settings.
                    const activeVips = clients.filter(c => c.clientStatus === 'Ativo' && c.plan === 'VIP');
                    
                    activeVips.forEach(vip => {
                        // If client doesn't have customPricing, lock them to the current pricing before it updates.
                        // If they already have customPricing, they are already protected/customized.
                        if (!vip.customPricing) {
                            const vipRef = db.collection('clients').doc(vip.id);
                            batch.update(vipRef, { customPricing: settings.pricing });
                        }
                    });

                    // Update global pricing for Simples clients and new contracts
                    batch.set(settingsRef, { pricing: change.newPricing }, { merge: true });

                    const changeRef = db.collection('pendingPriceChanges').doc(change.id);
                    batch.update(changeRef, { status: 'applied' });
                    
                    await batch.commit();
                    console.log(`Price change ${change.id} applied successfully.`);
                } catch (error) {
                    console.error(`Failed to apply price change ${change.id}:`, error);
                }
            }
        };

        const timer = setTimeout(applyOverduePriceChanges, 3000); // Small delay to ensure all data is loaded
        return () => clearTimeout(timer);

    }, [isUserAdmin, pendingPriceChanges, settings, clients]);

    useEffect(() => {
        if (!isUserAdmin && !isUserTechnician) return;

        const unsubUsers = db.collection('users').where('role', 'in', ['admin', 'technician']).onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => doc.data() as UserData);
            setUsers(data);
            setLoadingState('users', false);
        });
        
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
        const unsubTransactions = db.collection('transactions').orderBy('date', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
            setTransactions(data);
            setLoadingState('transactions', false);
        });
        const unsubStockProducts = db.collection('stockProducts').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockProduct));
            setStockProducts(data);
            setLoadingState('stockProducts', false);
        });
        const unsubPlanChanges = db.collection('planChangeRequests').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanChangeRequest));
            setPlanChangeRequests(data);
            setLoadingState('planChangeRequests', false);
        });


        return () => { unsubUsers(); unsubClients(); unsubBudgets(); unsubOrders(); unsubQuotes(); unsubTransactions(); unsubStockProducts(); unsubPlanChanges(); };
    }, [isUserAdmin, isUserTechnician]);
    
    // Publicly available listeners (Settings, Products, Routes, Banks)
    // Moved unsubRoutes here so clients can also see updates to their visit days
    useEffect(() => {
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
        
        const unsubRoutes = db.collection('routes').doc('main').onSnapshot(doc => {
            if (doc.exists) {
                setRoutes(doc.data() as Routes);
            }
            setLoadingState('routes', false);
        });

        const unsubBanks = db.collection('banks').onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
            setBanks(data);
            setLoadingState('banks', false);
        });

        return () => { unsubProducts(); unsubSettings(); unsubRoutes(); unsubBanks(); };
    }, []);

     // Client-specific data fetching
    useEffect(() => {
        if (userData?.role !== 'client' || !user) return;
        
        const unsubClient = db.collection('clients').where('uid', '==', user.uid).limit(1).onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const clientData = { id: doc.id, ...doc.data() } as Client;
                setClients([clientData]);
            }
            setLoadingState('clients', false);
        }, (error: Error) => {
            console.error("Error fetching client doc:", error);
            setLoadingState('clients', false);
        });

        const unsubOrders = db.collection('orders').where('clientId', '==', user.uid).onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            data.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
            setOrders(data);
            setLoadingState('orders', false);
        }, (error: Error) => {
            console.error("Error fetching client orders:", error);
            setLoadingState('orders', false);
        });

        const unsubQuotes = db.collection('replenishmentQuotes').where('clientId', '==', user.uid).onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReplenishmentQuote));
            data.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
            setReplenishmentQuotes(data);
            setLoadingState('replenishmentQuotes', false);
        }, (error: Error) => {
            console.error("Error fetching client replenishment quotes:", error);
            setLoadingState('replenishmentQuotes', false);
        });
        
        const unsubAdvanceRequests = db.collection('advancePaymentRequests').where('clientId', '==', user.uid).onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdvancePaymentRequest));
            data.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
            setAdvancePaymentRequests(data);
            setLoadingState('advancePaymentRequests', false);
        }, (error: Error) => {
            console.error("Error fetching client advance payment requests:", error);
            setLoadingState('advancePaymentRequests', false);
        });

        const unsubEvents = db.collection('poolEvents').where('clientId', '==', user.uid).onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PoolEvent));
            data.sort((a, b) => (toDate(b.eventDate)?.getTime() || 0) - (toDate(a.eventDate)?.getTime() || 0));
            setPoolEvents(data);
            setLoadingState('poolEvents', false);
        }, (error: Error) => {
            console.error("Error fetching client pool events:", error);
            setLoadingState('poolEvents', false);
        });
        
        const unsubPendingChanges = db.collection('pendingPriceChanges')
            .where('status', '==', 'pending')
            .onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingPriceChange));
                setPendingPriceChanges(data);
                setLoadingState('pendingPriceChanges', false);
            }, (error: Error) => {
                 console.error("Error fetching pending price changes for client:", error);
                 setLoadingState('pendingPriceChanges', false);
            });
            
        const unsubPlanChanges = db.collection('planChangeRequests').where('clientId', '==', user.uid).onSnapshot(snapshot => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanChangeRequest));
            setPlanChangeRequests(data);
            setLoadingState('planChangeRequests', false);
        }, (error: Error) => {
            console.error("Error fetching client plan change requests:", error);
            setLoadingState('planChangeRequests', false);
        });

        return () => { unsubClient(); unsubOrders(); unsubQuotes(); unsubAdvanceRequests(); unsubEvents(); unsubPendingChanges(); unsubPlanChanges(); };
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
            throw new Error("Falha ao criar administrador: " + error.message);
        }
    };

    const createTechnician = async (name: string, email: string, pass: string) => {
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
            const newUid = userCredential.user.uid;
        
            await db.collection('users').doc(newUid).set({
                name,
                email,
                role: 'technician',
                uid: newUid,
            });

            await auth.signOut();
        } catch (error: any) {
            console.error("Error creating technician:", error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error("Este e-mail já está em uso por outra conta.");
            }
            throw new Error("Falha ao criar a conta do técnico.");
        }
    };


    const approveBudgetQuote = async (budgetId: string, password: string, distanceFromHq?: number) => {
        const budgetDoc = await db.collection('pre-budgets').doc(budgetId).get();
        if (!budgetDoc.exists) throw new Error("Orçamento não encontrado.");

        const budget = budgetDoc.data() as BudgetQuote;

        try {
            const signInMethods = await auth.fetchSignInMethodsForEmail(budget.email);
            if (signInMethods.length > 0) {
                throw new Error("Já existe uma conta com este e-mail. Verifique a lista de clientes existentes.");
            }
        } catch (error: any) {
            if (error.message.startsWith("Já existe uma conta")) {
                throw error;
            }
            console.error("Erro ao verificar e-mail do usuário:", error);
            throw new Error("Falha ao verificar o e-mail do usuário. Tente novamente.");
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(budget.email, password);
            const newUid = userCredential.user.uid;

            const batch = db.batch();

            const userDocRef = db.collection('users').doc(newUid);
            batch.set(userDocRef, {
                name: budget.name,
                email: budget.email,
                role: 'client',
                uid: newUid,
            });

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
                includeProducts: false,
                isPartyPool: budget.isPartyPool,
                plan: budget.plan,
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
                distanceFromHq: distanceFromHq || budget.distanceFromHq || 0,
            };
            
            if (budget.fidelityPlan) {
                newClient.fidelityPlan = budget.fidelityPlan;
            }

            batch.set(clientDocRef, newClient);

            const budgetRef = db.collection('pre-budgets').doc(budgetId);
            batch.update(budgetRef, { status: 'approved' });
            
            await batch.commit();

        } catch (error: any) {
            console.error("Erro ao aprovar orçamento de novo cliente:", error);
            if (error.code === 'auth/email-already-in-use') {
                throw new Error("Já existe uma conta com este e-mail. Verifique a lista de clientes existentes.");
            }
            throw error;
        }
    };
    
    const rejectBudgetQuote = (budgetId: string) => db.collection('pre-budgets').doc(budgetId).delete();
    const updateClient = (clientId: string, data: Partial<Client>) => db.collection('clients').doc(clientId).update(data);
    const deleteClient = (clientId: string) => db.collection('clients').doc(clientId).delete();

    const markAsPaid = async (client: Client, months: number, totalAmount: number) => {
        if (!client.bankId) {
            throw new Error("Por favor, associe um banco a este cliente antes de registrar um pagamento.");
        }
        
        const bank = banks.find(b => b.id === client.bankId);
        if (!bank) {
            throw new Error("Banco associado não encontrado. Verifique as configurações.");
        }
        
        const batch = db.batch();

        const transactionRef = db.collection('transactions').doc();
        const newTransaction: Omit<Transaction, 'id'> = {
            clientId: client.id,
            clientName: client.name,
            bankId: client.bankId,
            bankName: bank.name,
            amount: totalAmount,
            date: firebase.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(transactionRef, newTransaction);
        
        const nextDueDate = new Date(client.payment.dueDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + months);

        const clientRef = db.collection('clients').doc(client.id);
        const clientUpdate: { [key: string]: any } = {
            'payment.dueDate': nextDueDate.toISOString(),
            'payment.status': 'Pago'
        };

        if (client.advancePaymentUntil) {
            clientUpdate.advancePaymentUntil = firebase.firestore.FieldValue.delete();
        }

        if (client.scheduledPlanChange) {
            clientUpdate.plan = client.scheduledPlanChange.newPlan;
            
            if (client.scheduledPlanChange.fidelityPlan) {
                clientUpdate.fidelityPlan = client.scheduledPlanChange.fidelityPlan;
            } else {
                clientUpdate.fidelityPlan = firebase.firestore.FieldValue.delete();
            }
            
            clientUpdate.scheduledPlanChange = firebase.firestore.FieldValue.delete();
        }

        batch.update(clientRef, clientUpdate);

        await batch.commit();
    };
    
    const updateClientStock = (clientId: string, stock: ClientProduct[]) => updateClient(clientId, { stock });

    const scheduleClient = async (clientId: string, dayKey: string) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        
        // Use set with merge to ensure day and isRouteActive exist
        await db.collection('routes').doc('main').set({
            [dayKey]: {
                day: dayKey,
                isRouteActive: false,
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

    const saveProduct = async (product: Omit<Product, 'id'> | Product, imageFile?: File) => {
        let productData = { ...product };
        let docRef;
    
        if ('id' in product) {
            docRef = db.collection('products').doc(product.id);
        } else {
            docRef = db.collection('products').doc();
        }
    
        if (imageFile) {
            const compressedFile = await compressImage(imageFile, { maxWidth: 1024, quality: 0.8 });
            const storageRef = storage.ref(`products/${docRef.id}/${compressedFile.name}`);
            const snapshot = await storageRef.put(compressedFile);
            productData.imageUrl = await snapshot.ref.getDownloadURL();
        }
        
        if ('id' in product) {
            const { id, ...dataToUpdate } = productData as Product;
            return docRef.update(dataToUpdate);
        } else {
            return docRef.set(productData);
        }
    };

    const deleteProduct = (productId: string) => db.collection('products').doc(productId).delete();
    
    const saveStockProduct = (product: Omit<StockProduct, 'id'> | StockProduct) => {
        if ('id' in product) {
            return db.collection('stockProducts').doc(product.id).update(product);
        }
        return db.collection('stockProducts').add(product);
    };

    const deleteStockProduct = (productId: string) => db.collection('stockProducts').doc(productId).delete();

    const saveBank = (bank: Omit<Bank, 'id'> | Bank) => {
        if ('id' in bank) {
            return db.collection('banks').doc(bank.id).update(bank);
        }
        return db.collection('banks').add(bank);
    };

    const deleteBank = (bankId: string) => db.collection('banks').doc(bankId).delete();

    const updateOrderStatus = (orderId: string, status: OrderStatus) => db.collection('orders').doc(orderId).update({ status });
    
    const updateSettings = async (newSettings: Partial<Settings>, logoFile?: File, removeLogo?: boolean, onProgress?: (progress: number) => void) => {
        const settingsUpdate: { [key: string]: any } = { ...newSettings };
    
        if (removeLogo) {
            const storageRef = storage.ref('settings/logo');
            settingsUpdate.logoUrl = firebase.firestore.FieldValue.delete();
            try {
                await storageRef.delete();
            } catch (error: any) {
                if (error.code !== 'storage/object-not-found') {
                    console.error("Error deleting old logo:", error);
                }
            }
        } else if (logoFile) {
            const compressedFile = await compressImage(logoFile, { maxWidth: 512, quality: 0.9 });
            const storageRef = storage.ref('settings/logo');
            const uploadTask = storageRef.put(compressedFile);
    
            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot: any) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgress) onProgress(progress);
                    },
                    (error: any) => {
                        console.error("Upload failed:", error);
                        reject(error);
                    },
                    async () => {
                        settingsUpdate.logoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve();
                    }
                );
            });
        }
    
        return db.collection('settings').doc('main').set(settingsUpdate, { merge: true });
    };
    
    const schedulePriceChange = async (newPricing: PricingSettings, affectedClients: AffectedClientPreview[]) => {
        const effectiveDate = new Date();
        effectiveDate.setDate(effectiveDate.getDate() + 30);

        const newChange: Omit<PendingPriceChange, 'id'> = {
            effectiveDate: firebase.firestore.Timestamp.fromDate(effectiveDate),
            newPricing,
            affectedClients,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection('pendingPriceChanges').add(newChange);
    };

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
        batch.update(clientRef, {
            'payment.dueDate': nextDueDate.toISOString(),
            'payment.status': 'Pago',
            'advancePaymentUntil': firebase.firestore.Timestamp.fromDate(nextDueDate)
        });

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

    const addVisitRecord = async (clientId: string, visitData: Omit<Visit, 'id' | 'photoUrl' | 'timestamp' | 'technicianId' | 'technicianName'>, photoFile?: File, onProgress?: (progress: number) => void) => {
        if (!userData || (userData.role !== 'admin' && userData.role !== 'technician')) {
            throw new Error("Apenas administradores ou técnicos podem registrar visitas.");
        }
    
        const visitId = db.collection('clients').doc().id;
        let photoUrl = '';

        if (photoFile) {
            const compressedFile = await compressImage(photoFile, { maxWidth: 1920, quality: 0.75 });
            const storageRef = storage.ref(`visits/${clientId}/${visitId}_${compressedFile.name}`);
            const uploadTask = storageRef.put(compressedFile);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (snapshot: any) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgress) onProgress(progress);
                    }, 
                    (error: any) => reject(error), 
                    async () => {
                        photoUrl = await uploadTask.snapshot.ref.getDownloadURL();
                        resolve();
                    }
                );
            });
        }
        
        const newVisit: Omit<Visit, 'photoUrl'> & { photoUrl?: string } = {
            id: visitId,
            technicianId: userData.uid,
            technicianName: userData.name,
            timestamp: firebase.firestore.Timestamp.now(),
            ...visitData,
        };

        if (photoUrl) {
            newVisit.photoUrl = photoUrl;
        }

        const clientRef = db.collection('clients').doc(clientId);
        const batch = db.batch();
        
        batch.update(clientRef, {
            visitHistory: firebase.firestore.FieldValue.arrayUnion(newVisit),
            'poolStatus.ph': visitData.ph,
            'poolStatus.cloro': visitData.cloro,
            'poolStatus.alcalinidade': visitData.alcalinidade,
            'poolStatus.uso': visitData.uso,
        });

        await batch.commit();
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
        if (!window.confirm("Você tem certeza? Esta ação irá apagar todos os dados de relatórios (orçamentos, pedidos, sugestões de reposição e rotas), mas NÃO APAGARÁ seus clientes, produtos ou visitas. Esta ação é irreversível.")) {
            return;
        }

        try {
            const collectionsToDelete = ['pre-budgets', 'orders', 'replenishmentQuotes', 'transactions', 'advancePaymentRequests', 'planChangeRequests'];
            for (const collectionName of collectionsToDelete) {
                const snapshot = await db.collection(collectionName).get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }

            await db.collection('routes').doc('main').set({});
            
            return Promise.resolve();
        } catch (error) {
            console.error("Erro ao resetar os dados:", error);
            throw error;
        }
    };

    const createPoolEvent = (eventData: Omit<PoolEvent, 'id' | 'status' | 'createdAt'>) => {
        const event: Omit<PoolEvent, 'id'> = {
            ...eventData,
            status: 'notified',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        return db.collection('poolEvents').add(event);
    };

    const acknowledgePoolEvent = (eventId: string) => {
        return db.collection('poolEvents').doc(eventId).update({ status: 'acknowledged' });
    };

    const deletePoolEvent = (eventId: string) => {
        return db.collection('poolEvents').doc(eventId).delete();
    };

    const saveRecessPeriod = async (recess: Omit<RecessPeriod, 'id'> | RecessPeriod) => {
        const settingsDoc = await db.collection('settings').doc('main').get();
        const currentSettings = settingsDoc.data() as Settings;
        const currentRecesses = currentSettings.recessPeriods || [];

        if ('id' in recess) {
            const index = currentRecesses.findIndex(r => r.id === recess.id);
            if (index > -1) {
                currentRecesses[index] = recess;
            }
        } else {
            const newRecess = { ...recess, id: db.collection('settings').doc().id };
            currentRecesses.push(newRecess);
        }

        return db.collection('settings').doc('main').update({ recessPeriods: currentRecesses });
    };

    const deleteRecessPeriod = async (recessId: string) => {
        const settingsDoc = await db.collection('settings').doc('main').get();
        const currentSettings = settingsDoc.data() as Settings;
        const currentRecesses = currentSettings.recessPeriods || [];
        
        const updatedRecesses = currentRecesses.filter(r => r.id !== recessId);

        return db.collection('settings').doc('main').update({ recessPeriods: updatedRecesses });
    };

    const requestPlanChange = async (clientId: string, clientName: string, currentPlan: PlanType, requestedPlan: PlanType) => {
        const request: Omit<PlanChangeRequest, 'id'> = {
            clientId,
            clientName,
            currentPlan,
            requestedPlan,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('planChangeRequests').add(request);
    };

    const respondToPlanChangeRequest = async (requestId: string, proposedPrice: number, notes: string) => {
        await db.collection('planChangeRequests').doc(requestId).update({
            status: 'quoted',
            proposedPrice,
            adminNotes: notes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    const acceptPlanChange = async (requestId: string, price: number, fidelityPlan?: FidelityPlan) => {
        const requestDoc = await db.collection('planChangeRequests').doc(requestId).get();
        if (!requestDoc.exists) return;
        const request = requestDoc.data() as PlanChangeRequest;
        
        const clientQuery = await db.collection('clients').where('uid', '==', request.clientId).limit(1).get();
        if (!clientQuery.empty) {
            const clientDoc = clientQuery.docs[0];
            const updateData: any = {
                scheduledPlanChange: {
                    newPlan: request.requestedPlan,
                    newPrice: price,
                    effectiveDate: firebase.firestore.FieldValue.serverTimestamp()
                }
            };
            if (fidelityPlan) updateData.scheduledPlanChange.fidelityPlan = fidelityPlan;
            await clientDoc.ref.update(updateData);
        }
        await db.collection('planChangeRequests').doc(requestId).update({
            status: 'accepted',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    const cancelPlanChangeRequest = async (requestId: string) => {
        await db.collection('planChangeRequests').doc(requestId).update({
            status: 'rejected',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    };


    return {
        clients, users, budgetQuotes, routes, products, stockProducts, orders, banks, transactions, settings, replenishmentQuotes, advancePaymentRequests, pendingPriceChanges, poolEvents, planChangeRequests, loading,
        setupCheck, createInitialAdmin, createTechnician,
        isAdvancePlanGloballyAvailable, advancePlanUsage,
        approveBudgetQuote, rejectBudgetQuote, updateClient, deleteClient, markAsPaid, updateClientStock,
        scheduleClient, unscheduleClient, toggleRouteStatus, saveProduct, deleteProduct, saveStockProduct, deleteStockProduct, saveBank, deleteBank,
        updateOrderStatus, updateSettings, schedulePriceChange, createBudgetQuote, createOrder, getClientData,
        updateReplenishmentQuoteStatus, createAdvancePaymentRequest, approveAdvancePaymentRequest, rejectAdvancePaymentRequest,
        addVisitRecord,
        resetReportsData,
        createPoolEvent,
        acknowledgePoolEvent,
        deletePoolEvent,
        saveRecessPeriod,
        deleteRecessPeriod,
        requestPlanChange,
        respondToPlanChangeRequest,
        acceptPlanChange,
        cancelPlanChangeRequest
    };
};