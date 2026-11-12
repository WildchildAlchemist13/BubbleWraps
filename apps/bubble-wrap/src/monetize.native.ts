// iOS and Android: AdMob interstitials + a RevenueCat "Remove ads" purchase.
// In Expo Go neither native module exists, so everything quietly turns off there.
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as GMA from 'react-native-google-mobile-ads';
import type PurchasesType from 'react-native-purchases';
import { REMOVE_ADS_ENTITLEMENT, REMOVE_ADS_PRODUCT, type Monetize } from './monetize.types';

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let ads: typeof GMA | null = null;
let Purchases: typeof PurchasesType | null = null;
if (!inExpoGo) {
  try {
    ads = require('react-native-google-mobile-ads');
  } catch {
    ads = null;
  }
  try {
    Purchases = require('react-native-purchases').default;
  } catch {
    Purchases = null;
  }
}

// Real ad unit IDs come from env vars; development builds always use Google's test ads.
const realUnit = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
});
const rcKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let interstitial: GMA.InterstitialAd | null = null;
let loaded = false;
let canRequestAds = false;
let started = false;
let storeReady = false;

function loadNext() {
  if (!ads || !canRequestAds) return;
  const unit = __DEV__ || !realUnit ? ads.TestIds.INTERSTITIAL : realUnit;
  interstitial = ads.InterstitialAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: true });
  loaded = false;
  interstitial.addAdEventListener(ads.AdEventType.LOADED, () => (loaded = true));
  interstitial.addAdEventListener(ads.AdEventType.ERROR, () => (loaded = false));
  interstitial.load();
}

export const monetize: Monetize = {
  adsAvailable: !!ads,
  storeAvailable: !!Purchases && !!rcKey,

  async init() {
    if (started) return;
    started = true;
    if (ads) {
      try {
        // GDPR / privacy consent where the law requires it (Google's own form)
        const consent = await ads.AdsConsent.gatherConsent();
        canRequestAds = consent.canRequestAds;
      } catch {
        canRequestAds = true; // consent service unreachable: non-personalized ads only, as always
      }
      try {
        await ads.default().setRequestConfiguration({ maxAdContentRating: ads.MaxAdContentRating.G });
        await ads.default().initialize();
        loadNext();
      } catch {
        canRequestAds = false;
      }
    }
    if (Purchases && rcKey) {
      try {
        Purchases.configure({ apiKey: rcKey });
        storeReady = true;
      } catch {
        storeReady = false;
      }
    }
  },

  showInterstitial() {
    return new Promise<boolean>((resolve) => {
      if (!ads || !interstitial || !loaded) {
        if (!loaded) loadNext();
        resolve(false);
        return;
      }
      const ad = interstitial;
      let done = false;
      const finish = (shown: boolean) => {
        if (done) return;
        done = true;
        offClose();
        offError();
        loadNext(); // get the next one ready
        resolve(shown);
      };
      const offClose = ad.addAdEventListener(ads.AdEventType.CLOSED, () => finish(true));
      const offError = ad.addAdEventListener(ads.AdEventType.ERROR, () => finish(false));
      ad.show().catch(() => finish(false));
    });
  },

  removeAds: {
    async price() {
      if (!Purchases || !storeReady) return null;
      try {
        const [p] = await Purchases.getProducts([REMOVE_ADS_PRODUCT], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
        return p?.priceString ?? null;
      } catch {
        return null;
      }
    },
    async buy() {
      if (!Purchases || !storeReady) return 'unavailable';
      try {
        const [p] = await Purchases.getProducts([REMOVE_ADS_PRODUCT], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
        if (!p) return 'unavailable';
        const { customerInfo } = await Purchases.purchaseStoreProduct(p);
        return customerInfo.entitlements.active[REMOVE_ADS_ENTITLEMENT] ? 'bought' : 'unavailable';
      } catch (e) {
        return (e as { userCancelled?: boolean })?.userCancelled ? 'cancelled' : 'unavailable';
      }
    },
    async isOwned() {
      if (!Purchases || !storeReady) return null;
      try {
        const info = await Purchases.getCustomerInfo();
        return !!info.entitlements.active[REMOVE_ADS_ENTITLEMENT];
      } catch {
        return null;
      }
    },
    async restore() {
      if (!Purchases || !storeReady) return null;
      try {
        const info = await Purchases.restorePurchases();
        return !!info.entitlements.active[REMOVE_ADS_ENTITLEMENT];
      } catch {
        return null;
      }
    },
  },
};
