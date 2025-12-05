

export interface UserData {
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'client';
}

export type PlanType = 'Simples' | 'VIP';
export type ClientStatus = 'Ativo' | 'Pendente';
export type PaymentStatus = 'Pago' | 'Pendente' | 'Atrasado';
export type PoolUsageStatus = 'Livre para uso' | 'Em tratamento';
export type BudgetQuoteStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'Pendente' | 'Enviado' | 'Entregue';
export type ReplenishmentQuoteStatus = 'suggested' | 'sent' | 'approved' | 'rejected';
export type AdvancePaymentRequestStatus = 'pending' | 'approved' | 'rejected';

export interface Address {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
}

export interface PoolStatus {
    ph: number;
    cloro: number;
    alcalinidade: number;
    uso: PoolUsageStatus;
}

export interface ClientProduct {
    productId: string;
    name: string;
    quantity: number;
}

export interface Bank {
    id: string;
    name: string;
    pixKey?: string;
}

export interface Transaction {
    id: string;
    clientId: string;
    clientName: string;
    bankId: string;
    bankName: string;
    amount: number;
    date: any; // Firestore Timestamp
}

export interface FidelityPlan {
    id: string;
    months: number;
    discountPercent: number;
}

export interface Client {
    id: string;
    uid?: string;
    name: string;
    email: string;
    phone: string;
    address: Address;
    poolDimensions: {
        width: number;
        length: number;
        depth: number;
    };
    poolVolume: number;
    hasWellWater: boolean;
    includeProducts: boolean;
    plan: PlanType;
    fidelityPlan?: FidelityPlan;
    clientStatus: ClientStatus;
    poolStatus: PoolStatus;
    payment: {
        status: PaymentStatus;
        dueDate: string; // ISO string
    };
    stock: ClientProduct[];
    pixKey?: string;
    bankId?: string;
    createdAt: any; // Firestore Timestamp
    lastVisitDuration?: number; // in minutes
}

export interface BudgetQuote {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: Address;
    poolDimensions: {
        width: number;
        length: number;
        depth: number;
    };
    poolVolume: number;
    hasWellWater: boolean;
    includeProducts: boolean;
    plan: PlanType;
    fidelityPlan?: FidelityPlan;
    monthlyFee: number;
    status: BudgetQuoteStatus;
    createdAt: any; // Firestore Timestamp
}

export interface RouteDay {
    day: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';
    clients: Client[];
    isRouteActive: boolean;
}

export interface Routes {
    [key: string]: RouteDay;
}

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    imageUrl: string;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface Order {
    id: string;
    clientId: string;
    clientName: string;
    items: CartItem[];
    total: number;
    status: OrderStatus;
    createdAt: any; // Firestore Timestamp
}

export interface ReplenishmentQuote {
    id: string;
    clientId: string;
    clientName: string;
    items: CartItem[];
    total: number;
    status: ReplenishmentQuoteStatus;
    createdAt: any;
    updatedAt: any;
}

export interface AdvancePaymentOption {
    months: number;
    discountPercent: number;
}

export interface AdvancePaymentRequest {
    id: string;
    clientId: string;
    clientName: string;
    months: number;
    discountPercent: number;
    originalAmount: number;
    finalAmount: number;
    status: AdvancePaymentRequestStatus;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
}

export interface Settings {
    companyName: string;
    mainTitle: string;
    mainSubtitle: string;
    baseAddress: Address;
    pixKey: string;
    pricing: {
        perKm: number;
        wellWaterFee: number;
        productsFee: number;
        volumeTiers: {
            upTo: number;
            price: number;
        }[];
    };
    plans: {
        simple: {
            title: string;
            benefits: string[];
            terms: string;
        };
        vip: {
            title: string;
            benefits: string[];
            terms: string;
        };
    };
    fidelityPlans: FidelityPlan[];
    features: {
        vipPlanEnabled: boolean;
        vipPlanDisabledMessage: string;
        storeEnabled: boolean;
        advancePaymentPlanEnabled: boolean;
        advancePaymentTitle: string;
        advancePaymentSubtitleVIP: string;
        advancePaymentSubtitleSimple: string;
    };
    automation: {
        replenishmentStockThreshold: number;
    };
    advancePaymentOptions: AdvancePaymentOption[];
}

export type NotificationType = 'success' | 'error' | 'info';

export interface AuthContextType {
    user: any | null;
    userData: UserData | null;
    login: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
    changePassword: (newPass: string) => Promise<void>;
    showNotification: (message: string, type: NotificationType) => void;
}

export interface AppContextType extends AppData {
    showNotification: (message: string, type: NotificationType) => void;
}

export interface AppData {
    clients: Client[];
    budgetQuotes: BudgetQuote[];
    routes: Routes;
    unscheduledClients: Client[];
    products: Product[];
    orders: Order[];
    banks: Bank[];
    transactions: Transaction[];
    replenishmentQuotes: ReplenishmentQuote[];
    advancePaymentRequests: AdvancePaymentRequest[];
    settings: Settings | null;
    loading: {
        clients: boolean;
        budgetQuotes: boolean;
        routes: boolean;
        products: boolean;
        orders: boolean;
        settings: boolean;
        banks: boolean;
        transactions: boolean;
        replenishmentQuotes: boolean;
        advancePaymentRequests: boolean;
    };
    setupCheck: 'checking' | 'needed' | 'done';
    isAdvancePlanGloballyAvailable: boolean;
    advancePlanUsage: {
        count: number;
        percentage: number;
    };
    approveBudgetQuote: (budgetId: string) => Promise<void>;
    rejectBudgetQuote: (budgetId: string) => Promise<void>;
    updateClient: (clientId: string, data: Partial<Client>) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    markAsPaid: (client: Client) => Promise<void>;
    updateClientStock: (clientId: string, stock: ClientProduct[]) => Promise<void>;
    scheduleClient: (clientId: string, day: string) => Promise<void>;
    unscheduleClient: (clientId: string, day: string) => Promise<void>;
    toggleRouteStatus: (day: string, status: boolean) => Promise<void>;
    saveProduct: (product: Omit<Product, 'id'> | Product) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;
    saveBank: (bank: Omit<Bank, 'id'> | Bank) => Promise<void>;
    deleteBank: (bankId: string) => Promise<void>;
    updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
    updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
    createBudgetQuote: (budget: Omit<BudgetQuote, 'id' | 'status' | 'createdAt'>) => Promise<void>;
    createOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<void>;
    getClientData: () => Promise<Client | null>;
    createInitialAdmin: (name: string, email: string, pass: string) => Promise<void>;
    updateReplenishmentQuoteStatus: (quoteId: string, status: ReplenishmentQuoteStatus) => Promise<void>;
    createAdvancePaymentRequest: (request: Omit<AdvancePaymentRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    approveAdvancePaymentRequest: (requestId: string) => Promise<void>;
    rejectAdvancePaymentRequest: (requestId: string) => Promise<void>;
    resetReportsData: () => Promise<void>;
}

export type AdminView = 'reports' | 'clients' | 'routes' | 'approvals' | 'store' | 'settings' | 'advances';