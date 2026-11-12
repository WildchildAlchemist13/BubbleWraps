// Web and fallback: no ads, no store. The native version lives in monetize.native.ts.
import type { Monetize } from './monetize.types';

export const monetize: Monetize = {
  adsAvailable: false,
  storeAvailable: false,
  init: async () => {},
  showInterstitial: async () => false,
  removeAds: {
    price: async () => null,
    buy: async () => 'unavailable',
    isOwned: async () => null,
    restore: async () => null,
  },
};
