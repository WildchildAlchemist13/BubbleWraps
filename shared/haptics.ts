import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS !== 'web';
let enabled = true;
const safe = (fn: () => Promise<unknown>) => {
  if (!supported || !enabled) return;
  fn().catch(() => {});
};

/** Tiny wrapper so every app uses the same feel. All calls are fire-and-forget. */
export const haptic = {
  tap: () => safe(() => Haptics.selectionAsync()),
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  rigid: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Respect an in-app "Vibration" setting. */
  setEnabled: (on: boolean) => {
    enabled = on;
  },
};
