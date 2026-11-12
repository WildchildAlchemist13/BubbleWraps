export type BuyResult = 'bought' | 'cancelled' | 'unavailable';

export type Monetize = {
  /** true when real ads can run (a development or store build, not Expo Go or web) */
  adsAvailable: boolean;
  /** true when the store is set up (RevenueCat key present, native build) */
  storeAvailable: boolean;
  /** Ask for consent where required, start the ad SDK, preload an ad, set up the store. Safe to call once. */
  init(): Promise<void>;
  /** true where privacy law requires a way to revisit ad consent (e.g. EEA/UK) */
  privacyOptionsRequired(): Promise<boolean>;
  /** Google's consent form, so the user can change their choice */
  showPrivacyOptions(): Promise<void>;
  /** Show the preloaded interstitial. Resolves when it closes: true if one was shown. */
  showInterstitial(): Promise<boolean>;
  removeAds: {
    /** localized price, e.g. "$2.99", or null if unknown */
    price(): Promise<string | null>;
    buy(): Promise<BuyResult>;
    /** true if the user owns "Remove ads"; null if the store can't be reached */
    isOwned(): Promise<boolean | null>;
    restore(): Promise<boolean | null>;
  };
};

/** RevenueCat names. Create these in the RevenueCat dashboard and both stores. */
export const REMOVE_ADS_ENTITLEMENT = 'remove_ads';
export const REMOVE_ADS_PRODUCT = 'bubblewrap_remove_ads';
