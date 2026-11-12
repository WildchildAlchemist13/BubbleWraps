import { StatusBar } from 'expo-status-bar';
import { memo, type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton, haptic, todayKey, useSoundPool, useStoredState } from '@pocket/kit';

const BG = '#7B6CF6';
const STUBBORN_CHANCE = 0.06; // some bubbles need two presses, like the real thing

type Cell = { x: number; y: number };
type BubbleState = 0 | 1 | 2; // 0 intact, 1 squished (stubborn, needs another press), 2 popped

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

const Bubble = memo(function Bubble({ x, y, size, state }: Cell & { size: number; state: BubbleState }) {
  const scale = useSharedValue(1);
  const popped = useSharedValue(0);
  const ring = useSharedValue(0);
  const prev = useRef<BubbleState>(state);

  useEffect(() => {
    if (state === prev.current) return;
    prev.current = state;
    if (state === 1) {
      scale.value = withSequence(withTiming(0.84, { duration: 70 }), withSpring(1, { damping: 4, stiffness: 260 }));
    } else if (state === 2) {
      scale.value = withSequence(withTiming(1.12, { duration: 55 }), withSpring(0.86, { damping: 9, stiffness: 320 }));
      popped.value = withTiming(1, { duration: 110 });
      ring.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    }
  }, [state]);

  const body = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const intact = useAnimatedStyle(() => ({ opacity: 1 - popped.value }));
  const flat = useAnimatedStyle(() => ({ opacity: popped.value }));
  const burst = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : interpolate(ring.value, [0, 1], [0.9, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.7, 1.7]) }],
  }));

  // each popped bubble crinkles a little differently
  const crinkles = useMemo(() => {
    let seed = Math.floor(x * 7919 + y * 104729) % 2147483647;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 4 }, () => ({
      len: 0.18 + rnd() * 0.26,
      deg: rnd() * 180,
      dx: (rnd() - 0.5) * 0.3,
      dy: (rnd() - 0.5) * 0.36,
      o: 0.35 + rnd() * 0.35,
    }));
  }, [x, y]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View pointerEvents="none" style={[styles.cell, round, { left: x - size / 2, top: y - size / 2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, round, styles.ring, burst]} />
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        {/* intact bubble: clear plastic dome with a shine */}
        <Animated.View style={[StyleSheet.absoluteFill, round, styles.dome, intact]}>
          <View
            style={[
              styles.shade,
              {
                width: size * 0.8,
                height: size * 0.8,
                borderRadius: size * 0.4,
                right: size * 0.03,
                bottom: size * 0.03,
              },
            ]}
          />
          <View
            style={[
              styles.shine,
              {
                width: size * 0.36,
                height: size * 0.18,
                borderRadius: size * 0.1,
                left: size * 0.17,
                top: size * 0.17,
              },
            ]}
          />
          <View
            style={[
              styles.shine,
              {
                width: size * 0.09,
                height: size * 0.09,
                borderRadius: size,
                left: size * 0.58,
                top: size * 0.14,
                opacity: 0.8,
              },
            ]}
          />
        </Animated.View>
        {/* popped bubble: flat, crinkled plastic */}
        <Animated.View style={[StyleSheet.absoluteFill, round, styles.flat, flat]}>
          {crinkles.map((c, k) => (
            <View
              key={k}
              style={[
                styles.crinkle,
                {
                  width: size * c.len,
                  left: size * (0.5 - c.len / 2 + c.dx),
                  top: size * (0.5 + c.dy),
                  opacity: c.o,
                  transform: [{ rotate: `${c.deg}deg` }],
                },
              ]}
            />
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
});

type Stats = { day: string; today: number; total: number; sheets: number; muted: boolean };
const INITIAL: Stats = { day: '', today: 0, total: 0, sheets: 0, muted: false };

function Counter({ value }: { value: number }) {
  const bump = useSharedValue(1);
  useEffect(() => {
    bump.value = withSequence(withTiming(1.12, { duration: 60 }), withSpring(1, { damping: 8, stiffness: 300 }));
  }, [value]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  return <Animated.Text style={[styles.count, s]}>{value.toLocaleString()}</Animated.Text>;
}

function BubbleWrap() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useStoredState<Stats>('bubble:stats', INITIAL);
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

  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const grid = useMemo(() => (size ? buildGrid(size.w, size.h) : null), [size]);

  const [sheetId, setSheetId] = useState(0);
  const states = useRef<BubbleState[]>([]);
  const stubborn = useRef<Set<number>>(new Set());
  const remaining = useRef(0);
  const [, setTick] = useState(0);
  const [cleared, setCleared] = useState(false);
  const busy = useRef(false);

  // new sheet whenever the grid or sheet changes
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

  const press = useCallback(
    (i: number, dragging: boolean) => {
      const s = states.current[i];
      if (s === 2) return;
      if (s === 0 && stubborn.current.has(i)) {
        states.current[i] = 1;
        squish.play();
        haptic.light();
        setTick((t) => t + 1);
        return;
      }
      states.current[i] = 2;
      remaining.current -= 1;
      pops.play();
      if (dragging) haptic.light();
      else (Math.random() < 0.5 ? haptic.medium : haptic.rigid)();
      setTick((t) => t + 1);
      setStats((p) => {
        const d = todayKey();
        const done = remaining.current === 0;
        return {
          ...p,
          day: d,
          today: (p.day === d ? p.today : 0) + 1,
          total: p.total + 1,
          sheets: p.sheets + (done ? 1 : 0),
        };
      });
      if (remaining.current === 0) {
        setTimeout(() => {
          haptic.success();
          setCleared(true);
        }, 250);
      }
    },
    [pops, squish, setStats],
  );

  // which bubble each finger is currently on, so holding still doesn't re-trigger
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

  // slide the old sheet away and a fresh one in
  const slide = useSharedValue(0);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slide.value }],
    opacity: interpolate(Math.abs(slide.value), [0, 400], [1, 0.4]),
  }));
  const swapSheet = () => setSheetId((n) => n + 1);
  const freshSheet = () => {
    if (busy.current || !size) return;
    busy.current = true;
    haptic.medium();
    slide.value = withSequence(
      withTiming(size.h + 200, { duration: 260, easing: Easing.in(Easing.cubic) }, (ok) => {
        if (ok) runOnJS(swapSheet)();
      }),
      withTiming(-(size.h + 200), { duration: 0 }),
      withDelay(
        40,
        withSpring(0, { damping: 16, stiffness: 140 }, (ok) => {
          if (ok) runOnJS(unlock)();
        }),
      ),
    );
  };
  const unlock = () => (busy.current = false);

  // nudge the button when the sheet is done
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = cleared
      ? withRepeat(withSequence(withTiming(1.06, { duration: 420 }), withTiming(1, { duration: 420 })), -1)
      : withTiming(1);
  }, [cleared]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const today = stats.day === todayKey() ? stats.today : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>POPPED TODAY</Text>
          <Counter value={today} />
        </View>
        <Pressable
          hitSlop={12}
          onPress={() => {
            haptic.tap();
            setStats((p) => ({ ...p, muted: !p.muted }));
          }}
          style={styles.mute}
          accessibilityRole="button"
          accessibilityLabel={stats.muted ? 'Turn sound on' : 'Turn sound off'}
        >
          <Text style={styles.muteText}>{stats.muted ? 'Sound off' : 'Sound on'}</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        {stats.total.toLocaleString()} all time · {stats.sheets} {stats.sheets === 1 ? 'sheet' : 'sheets'} cleared
      </Text>

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
            <View ref={sheetRef} style={styles.bubbleArea} onLayout={onLayout}>
              {grid &&
                states.current.length === grid.cells.length &&
                grid.cells.map((c, i) => (
                  <Bubble key={`${sheetId}-${i}`} x={c.x} y={c.y} size={grid.size} state={states.current[i]} />
                ))}
            </View>
            {cleared && (
              <View pointerEvents="none" style={styles.clearedBadge}>
                <Text style={styles.clearedText}>Sheet cleared!</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>

      <Animated.View style={pulseStyle}>
        <PillButton label={cleared ? 'Grab a fresh sheet' : 'Fresh sheet'} onPress={freshSheet} textColor={BG} />
      </Animated.View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <BubbleWrap />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  kicker: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  count: { color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: -1.5, marginTop: -2 },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600', marginBottom: 14 },
  mute: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  muteText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  touchZone: { flex: 1, marginHorizontal: -16, paddingHorizontal: 16, paddingBottom: 16 },
  sheetWrap: { flex: 1, overflow: 'hidden', borderRadius: 28 },
  sheet: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  bubbleArea: { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12 },
  cell: { position: 'absolute' },
  dome: {
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  shade: { position: 'absolute', backgroundColor: 'rgba(60,30,150,0.14)' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.95)', transform: [{ rotate: '-35deg' }] },
  flat: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  crinkle: { position: 'absolute', height: 1, borderRadius: 1, backgroundColor: '#fff' },
  ring: { borderWidth: 2, borderColor: '#fff' },
  clearedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  clearedText: { color: BG, fontWeight: '900', fontSize: 20 },
});
