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
    if (client.isPartyPool) basePrice += pricing.partyPoolFee;

    if (client.plan === 'VIP' && client.fidelityPlan && settings.features.vipPlanEnabled) {
        basePrice = basePrice * (1 - client.fidelityPlan.discountPercent / 100);
    }

    return basePrice;
};

/**
 * Compresses an image file before upload.
 * @param file The image file to compress.
 * @param options Configuration for max width and quality.
 * @returns A promise that resolves with the compressed file.
 */
export const compressImage = (file: File, options: { maxWidth: number; quality: number }): Promise<File> => {
  return new Promise((resolve, reject) => {
    // If not an image, return the original file
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const { width, height } = img;
        let newWidth = width;
        let newHeight = height;

        if (width > options.maxWidth) {
          newWidth = options.maxWidth;
          newHeight = (height * options.maxWidth) / width;
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Convert to JPEG for optimal compression.
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas to Blob conversion failed'));
            }
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpeg";
            const newFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          'image/jpeg',
          options.quality
        );
      };
    };
  });
};
