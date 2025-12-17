
export interface UserData {
    uid: string;
    email: string;
    name: string;
    role: 'admin' | 'client' | 'technician';
}

export type PlanType = 'Simples' | 'VIP';
export type ClientStatus = 'Ativo' | 'Pendente';
export type PaymentStatus = 'Pago' | 'Pendente' | 'Atrasado';
export type PoolUsageStatus = 'Livre para uso' | 'Em tratamento';
export type BudgetQuoteStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus = 'Pendente' | 'Enviado' | 'Entregue';
export type ReplenishmentQuoteStatus = 'suggested' | 'sent' | 'approved' | 'rejected';
export type AdvancePaymentRequestStatus = 'pending' | 'approved' | 'rejected';
export type PoolEventStatus = 'notified' | 'acknowledged';
export type PlanChangeStatus = 'pending' | 'quoted' | 'accepted' | 'rejected';

// FIX: Add missing AdminView type used in AdminLayout.
export type AdminView = 'reports' | 'approvals' | 'advances' | 'events' | 'clients' | 'routes' | 'store' | 'stock' | 'settings';

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
    maxQuantity?: number; // Added for stock management
}

export interface Bank {
    id: string;
    name: string;
    pixKey?: string;
    pixKeyRecipient?: string;
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

export interface Visit {
    id: string;
    technicianId: string;
    technicianName: string;
    timestamp: any; // Firestore Timestamp
    ph: number;
    cloro: number;
    alcalinidade: number;
    uso: PoolUsageStatus;
    notes: string;
    photoUrl?: string;
}

export interface ScheduledPlanChange {
    newPlan: PlanType;
    newPrice: number;
    fidelityPlan?: FidelityPlan;
    effectiveDate?: any;
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
    isPartyPool: boolean;
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
    pixKeyRecipient?: string;
    bankId?: string;
    allowAccessInMaintenance?: boolean; // Permite acesso durante modo de manutenção
    createdAt: any; // Firestore Timestamp
    visitHistory?: Visit[];
    lastVisitDuration?: number; // in minutes
    advancePaymentUntil?: any; // Firestore Timestamp
    customPricing?: PricingSettings; // Allows locking pricing for specific clients (e.g. VIPs)
    distanceFromHq?: number; // Distance from headquarters in KM
    scheduledPlanChange?: ScheduledPlanChange; // New field for plan upgrades waiting for next cycle
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
    isPartyPool: boolean;
    plan: PlanType;
    fidelityPlan?: FidelityPlan;
    monthlyFee: number;
    status: BudgetQuoteStatus;
    createdAt: any; // Firestore Timestamp
    distanceFromHq?: number;
}

export interface PlanChangeRequest {
    id: string;
    clientId: string;
    clientName: string;
    currentPlan: PlanType;
    requestedPlan: PlanType;
    status: PlanChangeStatus;
    proposedPrice?: number;
    adminNotes?: string;
    createdAt: any;
    updatedAt: any;
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

export interface StockProduct {
    id: string;
    name: string;
    description: string;
    unit: 'kg' | 'L' | 'un' | 'm' | 'm²' | 'pastilha';
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
    createdAt: any; // Firestore Timestamp
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

export interface PoolEvent {
    id: string;
    clientId: string;
    clientName: string;
    eventDate: any; // Firestore Timestamp
    notes: string;
    status: PoolEventStatus;
    createdAt: any; // Firestore Timestamp
}

export interface RecessPeriod {
    id: string;
    name: string;
    startDate: any; // Firestore Timestamp
    endDate: any;   // Firestore Timestamp
}

export interface LogoTransforms {
    scale: number;
    rotate: number;
    brightness: number;
    contrast: number;
    grayscale: number;
}

export interface Settings {
    companyName: string;
    mainTitle: string;
    mainSubtitle: string;
    logoUrl?: string;
    logoObjectFit?: 'contain' | 'cover' | 'fill' | 'scale-down';
    logoTransforms?: LogoTransforms;
    baseAddress: Address;
    pixKey: string;
    pixKeyRecipient?: string;
    whatsappMessageTemplate?: string;
    announcementMessageTemplate?: string; // New field for the announcement
    pricing: {
        perKm: number;
        wellWaterFee: number;
        productsFee: number;
        partyPoolFee: number;
        volumeTiers: {
            min: number;
            max: number;
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
        // FIX: Added missing planUpgradeEnabled property to fix error in useAppData.ts
        planUpgradeEnabled: boolean; // New field to control upgrade visibility
        vipPlanDisabledMessage: string;
        vipUpgradeTitle?: string;
        vipUpgradeDescription?: string;
        storeEnabled: boolean;
        advancePaymentPlanEnabled: boolean;
        advancePaymentTitle: string;
        advancePaymentSubtitleVIP: string;
        advancePaymentSubtitleSimple: string;
        maintenanceModeEnabled: boolean;
        maintenanceMessage: string;
    };
    automation: {
        replenishmentStockThreshold: number;
    };
    advancePaymentOptions: AdvancePaymentOption[];
    recessPeriods?: RecessPeriod[];
}

export type PricingSettings = Settings['pricing'];

export interface AffectedClientPreview {
    id: string;
    name: string;
}

export interface PendingPriceChange {
    id: string;
    effectiveDate: any; // Firestore Timestamp
    newPricing: PricingSettings;
    affectedClients: AffectedClientPreview[];
    status: 'pending' | 'applied';
    createdAt: any; // Firestore Timestamp
}


export type NotificationType = 'success' | 'error' | 'info';

export interface AuthContextType {
    user: any | null; // Firebase User
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
    users: UserData[];
    budgetQuotes: BudgetQuote[];
    routes: Routes;
    products: Product[];
    stockProducts: StockProduct[];
    orders: Order[];
    banks: Bank[];
    transactions: Transaction[];
    replenishmentQuotes: ReplenishmentQuote[];
    advancePaymentRequests: AdvancePaymentRequest[];
    planChangeRequests: PlanChangeRequest[];
    poolEvents: PoolEvent[];
    settings: Settings | null;
    pendingPriceChanges: PendingPriceChange[];
    loading: {
        clients: boolean;
        users: boolean;
        budgetQuotes: boolean;
        routes: boolean;
        products: boolean;
        stockProducts: boolean;
        orders: boolean;
        settings: boolean;
        banks: boolean;
        transactions: boolean;
        replenishmentQuotes: boolean;
        advancePaymentRequests: boolean;
        pendingPriceChanges: boolean;
        poolEvents: boolean;
        planChangeRequests: boolean;
    };
    setupCheck: 'checking' | 'needed' | 'done';
    isAdvancePlanGloballyAvailable: boolean;
    advancePlanUsage: {
        count: number;
        percentage: number;
    };
    approveBudgetQuote: (budgetId: string, password: string, distanceFromHq?: number) => Promise<void>;
    rejectBudgetQuote: (budgetId: string) => Promise<void>;
    updateClient: (clientId: string, data: Partial<Client>) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    markAsPaid: (client: Client, months: number, totalAmount: number) => Promise<void>;
    updateClientStock: (clientId: string, stock: ClientProduct[]) => Promise<void>;
    scheduleClient: (clientId: string, day: string) => Promise<void>;
    unscheduleClient: (clientId: string, day: string) => Promise<void>;
    toggleRouteStatus: (day: string, status: boolean) => Promise<void>;
    saveProduct: (product: Omit<Product, 'id'> | Product, imageFile?: File) => Promise<void>;
    deleteProduct: (productId: string) => Promise<void>;
    saveStockProduct: (product: Omit<StockProduct, 'id'> | StockProduct) => Promise<void>;
    deleteStockProduct: (productId: string) => Promise<void>;
    saveBank: (bank: Omit<Bank, 'id'> | Bank) => Promise<void>;
    deleteBank: (bankId: string) => Promise<void>;
    updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
    updateSettings: (newSettings: Partial<Settings>, logoFile?: File, removeLogo?: boolean, onProgress?: (progress: number) => void) => Promise<void>;
    schedulePriceChange: (newPricing: PricingSettings, affectedClients: AffectedClientPreview[]) => Promise<void>;
    createBudgetQuote: (budget: Omit<BudgetQuote, 'id' | 'status' | 'createdAt'>) => Promise<void>;
    createOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<void>;
    getClientData: () => Promise<Client | null>;
    createInitialAdmin: (name: string, email: string, pass: string) => Promise<void>;
    createTechnician: (name: string, email: string, pass: string) => Promise<void>;
    updateReplenishmentQuoteStatus: (quoteId: string, status: ReplenishmentQuoteStatus) => Promise<void>;
    createAdvancePaymentRequest: (request: Omit<AdvancePaymentRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<void>;
    approveAdvancePaymentRequest: (requestId: string) => Promise<void>;
    rejectAdvancePaymentRequest: (requestId: string) => Promise<void>;
    addVisitRecord: (clientId: string, visitData: Omit<Visit, 'id' | 'photoUrl' | 'timestamp' | 'technicianId' | 'technicianName'>, photoFile?: File, onProgress?: (progress: number) => void) => Promise<void>;
    resetReportsData: () => Promise<void>;
    createPoolEvent: (event: Omit<PoolEvent, 'id' | 'status' | 'createdAt' | 'clientId' | 'clientName'> & { clientId: string, clientName: string }) => Promise<void>;
    acknowledgePoolEvent: (eventId: string) => Promise<void>;
    deletePoolEvent: (eventId: string) => Promise<void>;
    saveRecessPeriod: (recess: Omit<RecessPeriod, 'id'> | RecessPeriod) => Promise<void>;
    deleteRecessPeriod: (recessId: string) => Promise<void>;
    requestPlanChange: (clientId: string, clientName: string, currentPlan: PlanType, requestedPlan: PlanType) => Promise<void>;
    respondToPlanChangeRequest: (requestId: string, proposedPrice: number, notes: string) => Promise<void>;
    acceptPlanChange: (requestId: string, price: number, fidelityPlan?: FidelityPlan) => Promise<void>;
    cancelPlanChangeRequest: (requestId: string) => Promise<void>;
}
