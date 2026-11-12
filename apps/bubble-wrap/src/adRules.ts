/**
 * When an ad may show. Ads only ever appear at the break after a CLEARED sheet,
 * when the user taps "Another sheet" — never mid-popping, never on launch.
 */
export const AD_RULES = {
  sheetsBetweenAds: 3, // at most one ad every 3 cleared sheets
  minMinutesBetweenAds: 4.5, // and never more often than this
  graceDays: 1, // nothing on the day the app was first opened
};

type AdState = {
  adFree: boolean;
  firstOpen: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
  sheetsSinceAd: number;
  lastAdAt: number; // ms epoch, 0 = never
  now: number; // ms epoch
};

export function shouldShowAd(s: AdState): boolean {
  if (s.adFree) return false;
  if (!s.firstOpen || s.today <= s.firstOpen) return false; // day one is ad-free
  if (s.sheetsSinceAd < AD_RULES.sheetsBetweenAds) return false;
  if (s.lastAdAt && s.now - s.lastAdAt < AD_RULES.minMinutesBetweenAds * 60_000) return false;
  return true;
}
