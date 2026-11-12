import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeOutUp,
  ZoomIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFonts,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { haptic, todayKey, useSoundPool, useStoredState } from '@wildchild/kit';
import { Bubble, type BubbleState } from './src/Bubble';
import { StatsSheet } from './src/StatsSheet';
import { useTilt } from './src/useTilt';
import { C, F } from './src/theme';
import { INITIAL, migrate, milestoneAfterPop, popsToday, recordPop, type Stats } from './src/stats';
import { monetize } from './src/monetize';
import { shouldShowAd } from './src/adRules';

/** Two-button question that also works on web. Resolves true for the OK button. */
function ask(title: string, body: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, onPress: () => resolve(true) },
    ]),
  );
}

function tell(title: string, body: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${body}`);
    return;
  }
  Alert.alert(title, body);
}

const STUBBORN_CHANCE = 0.06; // some bubbles need two presses, like the real thing

type Cell = { x: number; y: number };
type Grid = { cells: Cell[]; D: number; size: number; rowH: number; cols: number; rows: number; offY: number };

/** Hex-packed grid that fills the sheet exactly, edge to edge. */
function buildGrid(w: number, h: number): Grid {
  const cols = Math.max(5, Math.floor(w / 46));
  const D = w / (cols + 0.5);
  const size = D * 0.9;
  const rowH = D * 0.87;
  const rows = Math.max(1, Math.floor((h - D) / rowH) + 1);
  const offY = (h - ((rows - 1) * rowH + D)) / 2;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    const shift = r % 2 ? D / 2 : 0;
    for (let c = 0; c < cols; c++) cells.push({ x: D / 2 + c * D + shift, y: offY + D / 2 + r * rowH });
  }
  return { cells, D, size, rowH, cols, rows, offY };
}

function hitTest(g: Grid, x: number, y: number): number {
  const r0 = Math.round((y - g.offY - g.D / 2) / g.rowH);
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    if (r < 0 || r >= g.rows) continue;
    const shift = r % 2 ? g.D / 2 : 0;
    const c = Math.round((x - g.D / 2 - shift) / g.D);
    if (c < 0 || c >= g.cols) continue;
    const i = r * g.cols + c;
    const cell = g.cells[i];
    if (Math.hypot(cell.x - x, cell.y - y) <= g.size / 2) return i;
  }
  return -1;
}

function Counter({ value, reduce }: { value: number; reduce: boolean }) {
  const bump = useSharedValue(1);
  useEffect(() => {
    if (reduce || value === 0) return;
    bump.value = withSequence(withTiming(1.12, { duration: 70 }), withTiming(1, { duration: 150 }));
  }, [value]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  return (
    <Animated.Text style={[styles.count, s]} accessibilityLabel={`Popped today, ${value}`}>
      {value.toLocaleString()}
    </Animated.Text>
  );
}

/** "Tap to pop" hint: bobs gently until the first pop. */
function Hint({ reduce }: { reduce: boolean }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!reduce) bob.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * bob.value }] }));
  return (
    <Animated.View pointerEvents="none" exiting={FadeOut.duration(200)} style={styles.centerWrap}>
      <Animated.View style={[styles.pill, styles.hintPill, s]}>
        <Text style={styles.hintText}>Tap to pop. Or drag across a row.</Text>
      </Animated.View>
    </Animated.View>
  );
}

function BubbleWrap() {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [stats, setStatsRaw, ready] = useStoredState<Stats>('bubble:stats', INITIAL);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const setStats = useCallback(
    (next: Stats) => {
      statsRef.current = next;
      setStatsRaw(next);
    },
    [setStatsRaw],
  );
  const patch = (p: Partial<Stats>) => setStats({ ...statsRef.current, ...p });

  const pops = useSoundPool([
    require('./assets/sounds/pop1.wav'),
    require('./assets/sounds/pop2.wav'),
    require('./assets/sounds/pop3.wav'),
    require('./assets/sounds/pop4.wav'),
  ]);
  const squish = useSoundPool([require('./assets/sounds/squish.wav')], 3);

  useEffect(() => {
    pops.setMuted(stats.muted);
    squish.setMuted(stats.muted);
  }, [stats.muted]);
  useEffect(() => haptic.setEnabled(stats.haptics), [stats.haptics]);

  const tilt = useTilt(stats.tilt && !reduce);

  // toasts: at most one per session
  const [toast, setToast] = useState<string | null>(null);
  const toastShown = useRef(false);
  const showToast = (key: string, text: string) => {
    if (toastShown.current) return;
    toastShown.current = true;
    setToast(text);
    setStats({ ...statsRef.current, seen: { ...statsRef.current.seen, [key]: true } });
    setTimeout(() => setToast(null), 2600);
  };

  // on open: migrate old data, greet a returning popper
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    const s = migrate(statsRef.current);
    const d = todayKey();
    const returning = s.lastOpen !== '' && s.lastOpen !== d && !s.seen[`back:${d}`];
    setStats({ ...s, lastOpen: d, firstOpen: s.firstOpen || d });
    if (returning) setTimeout(() => showToast(`back:${d}`, 'Back for more. Same.'), 600);
    // ads + store: consent, preload an ad, check whether "Remove ads" is owned
    monetize
      .init()
      .then(async () => {
        const owned = await monetize.removeAds.isOwned();
        if (owned !== null && owned !== statsRef.current.adFree) patch({ adFree: owned });
        setRemoveAdsPrice(await monetize.removeAds.price());
      })
      .catch(() => {});
  }, [ready]);

  const [removeAdsPrice, setRemoveAdsPrice] = useState<string | null>(null);
  const buyRemoveAds = async () => {
    haptic.tap();
    const result = await monetize.removeAds.buy();
    if (result === 'bought') {
      patch({ adFree: true });
      haptic.success();
      tell('Ads removed', 'Thanks for supporting Bubble Wrap. Pop in peace.');
    } else if (result === 'unavailable') {
      if (__DEV__) {
        // purchases aren't set up yet: let the developer feel the ad-free version
        const pretend = await ask(
          'Store not set up yet',
          'Purchases need a RevenueCat key and a store build. Test mode: pretend the purchase went through?',
          'Pretend I bought it',
          'Cancel',
        );
        if (pretend) patch({ adFree: true });
      } else {
        tell("Couldn't reach the store", 'Check your connection and try again in a moment.');
      }
    }
  };
  const restoreRemoveAds = async () => {
    haptic.tap();
    const owned = await monetize.removeAds.restore();
    if (owned) {
      patch({ adFree: true });
      tell('Purchase restored', 'Ads are off again. Welcome back.');
    } else if (owned === false) {
      tell('Nothing to restore', "We couldn't find a Remove ads purchase on this account.");
    } else {
      tell("Couldn't reach the store", 'Check your connection and try again in a moment.');
    }
  };

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const grid = useMemo(() => (size ? buildGrid(size.w, size.h) : null), [size]);

  const [sheetId, setSheetId] = useState(0);
  const states = useRef<BubbleState[]>([]);
  const stubborn = useRef<Set<number>>(new Set());
  const remaining = useRef(0);
  const [, setTick] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [tough, setTough] = useState<Cell | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const busy = useRef(false);
  const tapCount = useRef(0);

  useEffect(() => {
    if (!grid) return;
    states.current = grid.cells.map(() => 0);
    stubborn.current = new Set(grid.cells.flatMap((_, i) => (Math.random() < STUBBORN_CHANCE ? [i] : [])));
    remaining.current = grid.cells.length;
    setCleared(false);
    setTick((t) => t + 1);
  }, [grid, sheetId]);

  const origin = useRef({ x: 0, y: 0 });
  const sheetRef = useRef<ComponentRef<typeof View>>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    requestAnimationFrame(() => sheetRef.current?.measureInWindow((x, y) => (origin.current = { x, y })));
  };

  const press = (i: number, dragging: boolean) => {
    const s = states.current[i];
    if (s === 2) return;
    if (s === 0 && stubborn.current.has(i)) {
      states.current[i] = 1;
      squish.play();
      haptic.light();
      setTick((t) => t + 1);
      if (!statsRef.current.seen.tough && grid) {
        setTough(grid.cells[i]);
        setStats({ ...statsRef.current, seen: { ...statsRef.current.seen, tough: true } });
        setTimeout(() => setTough(null), 1400);
      }
      return;
    }
    states.current[i] = 2;
    remaining.current -= 1;
    pops.play();
    if (dragging) haptic.light();
    else (tapCount.current++ % 2 ? haptic.rigid : haptic.medium)();
    setTick((t) => t + 1);

    const done = remaining.current === 0;
    let next = recordPop(statsRef.current, done);
    if (done) next = { ...next, sheetsSinceAd: next.sheetsSinceAd + 1 };
    if (!next.seen.hint) next = { ...next, seen: { ...next.seen, hint: true } };
    setStats(next);
    const m = milestoneAfterPop(next);
    if (m) showToast(m.key, m.text);
    if (done) {
      setTimeout(() => {
        haptic.success();
        setCleared(true);
      }, 250);
    }
  };

  // which bubble each finger is on, so holding still doesn't re-trigger
  const fingerOn = useRef<Record<string, number>>({});
  const handleTouches = (e: GestureResponderEvent, dragging: boolean) => {
    if (!grid || busy.current) return;
    const ne = e.nativeEvent;
    const touches = ne.touches && ne.touches.length ? ne.touches : [ne];
    for (const t of touches) {
      const id = String(t.identifier ?? 'mouse');
      const i = hitTest(grid, t.pageX - origin.current.x, t.pageY - origin.current.y);
      if (fingerOn.current[id] === i) continue;
      fingerOn.current[id] = i;
      if (i >= 0) press(i, dragging);
    }
  };

  // new sheet: the old one drops away, the new one falls in and lands with a little squash
  const slide = useSharedValue(0);
  const fade = useSharedValue(1);
  const land = useSharedValue(1);
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: slide.value }, { scaleX: 2 - land.value }, { scaleY: land.value }],
  }));
  const swapSheet = () => setSheetId((n) => n + 1);
  const unlock = () => (busy.current = false);
  const newSheet = async () => {
    if (busy.current || !size) return;
    busy.current = true;
    haptic.medium();
    // the ad break: only after a cleared sheet, and only when the rules allow it
    const st = statsRef.current;
    if (
      cleared &&
      monetize.adsAvailable &&
      shouldShowAd({
        adFree: st.adFree,
        firstOpen: st.firstOpen,
        today: todayKey(),
        sheetsSinceAd: st.sheetsSinceAd,
        lastAdAt: st.lastAdAt,
        now: Date.now(),
      })
    ) {
      const shown = await monetize.showInterstitial();
      if (shown) {
        const now = statsRef.current;
        setStats({ ...now, sheetsSinceAd: 0, lastAdAt: Date.now(), adsSeen: now.adsSeen + 1 });
      }
    }
    playNewSheet();
  };
  const playNewSheet = () => {
    if (!size) return;
    if (reduce) {
      fade.value = withSequence(
        withTiming(0, { duration: 150 }, (ok) => {
          if (ok) runOnJS(swapSheet)();
        }),
        withTiming(1, { duration: 150 }, (ok) => {
          if (ok) runOnJS(unlock)();
        }),
      );
      return;
    }
    const H = size.h + 200;
    slide.value = withSequence(
      withTiming(H, { duration: 260, easing: Easing.in(Easing.cubic) }, (ok) => {
        if (ok) runOnJS(swapSheet)();
      }),
      withTiming(-H, { duration: 0 }),
      withSpring(0, { damping: 16, stiffness: 140 }, (ok) => {
        if (ok) runOnJS(unlock)();
      }),
    );
    land.value = withDelay(
      560,
      withSequence(withTiming(0.97, { duration: 70 }), withSpring(1, { damping: 8, stiffness: 300 })),
    );
  };

  // the button pulses once the sheet is done
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value =
      cleared && !reduce
        ? withRepeat(withTiming(1, { duration: 550, easing: Easing.inOut(Easing.sin) }), -1, true)
        : withTiming(0);
  }, [cleared, reduce]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.04 }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
    transform: [{ scaleX: 1 + pulse.value * 0.05 }, { scaleY: 1 + pulse.value * 0.25 }],
  }));

  const today = popsToday(stats);
  const left = grid ? remaining.current : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />
      {toast && (
        <Animated.View
          entering={reduce ? FadeIn : FadeInUp.springify().damping(14)}
          exiting={reduce ? FadeOut : FadeOutUp}
          style={[styles.toast, { top: insets.top + 4 }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.toastStar}>★</Text>
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>POPPED TODAY</Text>
          <Counter value={today} reduce={reduce} />
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => {
            haptic.tap();
            patch({ muted: !stats.muted });
          }}
          style={styles.chip}
          accessibilityRole="switch"
          accessibilityState={{ checked: !stats.muted }}
          accessibilityLabel="Sound"
        >
          <Text style={styles.chipText}>{stats.muted ? 'Sound off' : 'Sound on'}</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => {
          haptic.tap();
          setStatsOpen(true);
        }}
        style={styles.statsLine}
        accessibilityRole="button"
        accessibilityHint="Opens your stats"
        hitSlop={6}
      >
        <Text style={styles.sub}>
          {stats.total.toLocaleString()} all time · {stats.sheets} {stats.sheets === 1 ? 'sheet' : 'sheets'} cleared ›
        </Text>
      </Pressable>

      {/* the whole middle of the screen, edge to edge, listens for fingers,
          so a swipe that starts in the margin still pops bubbles */}
      <View
        style={styles.touchZone}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => handleTouches(e, false)}
        onResponderMove={(e) => handleTouches(e, true)}
        onResponderRelease={() => (fingerOn.current = {})}
        onResponderTerminate={() => (fingerOn.current = {})}
      >
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View
              ref={sheetRef}
              style={styles.bubbleArea}
              onLayout={onLayout}
              accessible
              accessibilityLabel={`Bubble wrap sheet, ${left} bubbles left. Tap or drag to pop.`}
            >
              {grid &&
                states.current.length === grid.cells.length &&
                grid.cells.map((c, i) => (
                  <Bubble
                    key={`${sheetId}-${i}`}
                    x={c.x}
                    y={c.y}
                    size={grid.size}
                    state={states.current[i]}
                    tiltX={tilt.x}
                    tiltY={tilt.y}
                    reduce={reduce}
                  />
                ))}
              {tough && (
                <Animated.View
                  pointerEvents="none"
                  entering={reduce ? FadeIn : ZoomIn.springify().damping(10)}
                  exiting={FadeOut.duration(250)}
                  style={[styles.tough, { left: tough.x - 44, top: tough.y - 52 }]}
                >
                  <Text style={styles.toughText}>Tough one.</Text>
                </Animated.View>
              )}
            </View>
            {ready && !stats.seen.hint && today === 0 && !cleared && <Hint reduce={reduce} />}
            {cleared && (
              <View pointerEvents="box-none" style={styles.centerWrap}>
                <Animated.View
                  pointerEvents="none"
                  entering={reduce ? FadeIn : ZoomIn.springify().damping(10)}
                  style={[styles.pill, styles.badge]}
                >
                  <Text style={styles.badgeText}>Every last one.</Text>
                </Animated.View>
                {stats.adsSeen > 0 && !stats.adFree && (monetize.storeAvailable || __DEV__) && (
                  <Animated.View entering={FadeIn.delay(400)}>
                    <Pressable onPress={buyRemoveAds} style={styles.removeAds} accessibilityRole="button" hitSlop={8}>
                      <Text style={styles.removeAdsText}>Remove ads{removeAdsPrice ? ` · ${removeAdsPrice}` : ''}</Text>
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            )}
          </Animated.View>
        </View>
      </View>

      <View>
        <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
        <Animated.View style={pulseStyle}>
          <Pressable
            onPress={newSheet}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <Text style={styles.buttonText}>{cleared ? 'Another sheet' : 'New sheet'}</Text>
          </Pressable>
        </Animated.View>
      </View>

      <StatsSheet
        visible={statsOpen}
        stats={stats}
        reduce={reduce}
        onClose={() => setStatsOpen(false)}
        onChange={(p) => patch(p)}
        removeAds={{
          show: monetize.storeAvailable || __DEV__,
          owned: stats.adFree,
          price: removeAdsPrice,
          buy: buyRemoveAds,
          restore: restoreRemoveAds,
        }}
        onReset={() => {
          haptic.medium();
          setStats({ ...statsRef.current, days: {}, total: 0, sheets: 0 });
        }}
      />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  return (
    <SafeAreaProvider>
      {fontsLoaded ? <BubbleWrap /> : <View style={{ flex: 1, backgroundColor: C.ground }} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.ground, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kicker: { fontFamily: F.xbold, color: '#FFFFFF', fontSize: 12, letterSpacing: 1.6 },
  count: {
    fontFamily: F.black,
    color: '#FFFFFF',
    fontSize: 56,
    letterSpacing: -1.5,
    lineHeight: 64,
    alignSelf: 'flex-start',
  },
  chip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 10,
  },
  chipText: { fontFamily: F.xbold, color: '#FFFFFF', fontSize: 14 },
  statsLine: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginBottom: 12 },
  sub: { fontFamily: F.bold, color: '#FFFFFF', fontSize: 15 },
  touchZone: { flex: 1, marginHorizontal: -16, paddingHorizontal: 16, paddingBottom: 16 },
  sheetWrap: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  sheet: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
    transformOrigin: 'center bottom',
  },
  bubbleArea: { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12 },
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    shadowColor: '#140A50',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  hintPill: { paddingHorizontal: 20, paddingVertical: 14 },
  hintText: { fontFamily: F.xbold, color: C.ground, fontSize: 16 },
  badge: { paddingHorizontal: 24, paddingVertical: 14 },
  badgeText: { fontFamily: F.black, color: C.ground, fontSize: 22 },
  tough: {
    position: 'absolute',
    width: 88,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-6deg' }],
  },
  toughText: { fontFamily: F.black, color: C.ground, fontSize: 14 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: C.ink,
    shadowColor: '#0A0528',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastStar: { color: C.star, fontSize: 14 },
  toastText: { fontFamily: F.xbold, color: '#FFFFFF', fontSize: 14 },
  halo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  button: {
    height: 56,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#140A50',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonText: { fontFamily: F.black, color: C.ground, fontSize: 18 },
  removeAds: {
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: 'rgba(27,19,64,0.55)',
  },
  removeAdsText: { fontFamily: F.xbold, color: '#FFFFFF', fontSize: 15 },
});
