import { Client, Settings, FidelityPlan } from './types';

export const normalizeDimension = (value: string | number): number => {
    if (value === null || value === undefined) return 0;
    const stringValue = String(value).trim();
    if (stringValue === '') return 0;
    
    const normalized = stringValue.replace(',', '.');
    const number = parseFloat(normalized);
    
    return isNaN(number) ? 0 : number;
};

export const calculateVolume = (width: string | number, length: string | number, depth: string | number) => {
    const w = normalizeDimension(width);
    const l = normalizeDimension(length);
    const d = normalizeDimension(depth);
    if (w > 0 && l > 0 && d > 0) {
        return w * l * d * 1000;
    }
    return 0;
};

export const calculateClientMonthlyFee = (client: Partial<Client>, settings: Settings): number => {
    if (!client.poolVolume || client.poolVolume <= 0) return 0;

    const { pricing } = settings;
    let basePrice = pricing.volumeTiers.find(tier => client.poolVolume! <= tier.upTo)?.price || pricing.volumeTiers[pricing.volumeTiers.length - 1].price;

    if (client.hasWellWater) basePrice += pricing.wellWaterFee;
    if (client.includeProducts) basePrice += pricing.productsFee;

    if (client.plan === 'VIP' && client.fidelityPlan && settings.features.vipPlanEnabled) {
        basePrice = basePrice * (1 - client.fidelityPlan.discountPercent / 100);
    }

    return basePrice;
};