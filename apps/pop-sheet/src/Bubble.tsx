import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export type BubbleState = 0 | 1 | 2; // 0 intact, 1 squished (stubborn, needs another press), 2 popped

type Props = {
  x: number;
  y: number;
  size: number;
  state: BubbleState;
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  reduce: boolean;
};

export const Bubble = memo(function Bubble({ x, y, size, state, tiltX, tiltY, reduce }: Props) {
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const popped = useSharedValue(0);
  const ring = useSharedValue(0);
  const prev = useRef<BubbleState>(state);

  useEffect(() => {
    if (state === prev.current) return;
    prev.current = state;
    if (state === 1) {
      // stubborn: squash 110% x 80%, wobble back, rest slightly flattened
      if (reduce) {
        sx.value = 1.04;
        sy.value = 0.9;
        return;
      }
      sx.value = withSequence(withTiming(1.1, { duration: 70 }), withSpring(1.04, { damping: 4, stiffness: 260 }));
      sy.value = withSequence(withTiming(0.8, { duration: 70 }), withSpring(0.9, { damping: 4, stiffness: 260 }));
    } else if (state === 2) {
      if (reduce) {
        popped.value = withTiming(1, { duration: 150 });
        sx.value = sy.value = 0.88;
        return;
      }
      // swell to 112% in 55ms, then spring down flat
      sx.value = withSequence(withTiming(1.12, { duration: 55 }), withSpring(0.86, { damping: 9, stiffness: 320 }));
      sy.value = withSequence(withTiming(1.12, { duration: 55 }), withSpring(0.86, { damping: 9, stiffness: 320 }));
      popped.value = withTiming(1, { duration: 110 });
      ring.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    }
  }, [state, reduce]);

  const k = size / 40; // design was drawn at 40 px
  const body = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }, { scaleY: sy.value }] }));
  const intact = useAnimatedStyle(() => ({ opacity: 1 - popped.value }));
  const flat = useAnimatedStyle(() => ({ opacity: popped.value }));
  const burst = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : interpolate(ring.value, [0, 1], [0.9, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.7, 1.8]) }],
  }));
  // the shine slides up to 6px toward the light as the phone tilts
  const shine = useAnimatedStyle(() => ({
    transform: [{ translateX: tiltX.value * 6 * k }, { translateY: tiltY.value * 5 * k }],
  }));

  // each popped bubble crinkles a little differently
  const crinkles = useMemo(() => {
    let seed = Math.floor(x * 7919 + y * 104729) % 2147483647;
    if (seed <= 0) seed += 2147483646;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    return Array.from({ length: 3 }, (_, i) => {
      const len = (8 + rnd() * 11) / 36;
      return { len, dx: (rnd() - 0.5) * 0.22, dy: (rnd() - 0.5) * 0.38, deg: rnd() * 180, o: 0.6 - i * 0.07 };
    });
  }, [x, y]);

  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View pointerEvents="none" style={[styles.cell, round, { left: x - size / 2, top: y - size / 2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, round, styles.ring, burst]} />
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        <Animated.View style={[StyleSheet.absoluteFill, round, styles.dome, intact]}>
          <View
            style={[
              styles.shade,
              {
                width: size * 0.8,
                height: size * 0.8,
                borderRadius: size * 0.4,
                right: size * 0.025,
                bottom: size * 0.025,
              },
            ]}
          />
          <Animated.View style={[StyleSheet.absoluteFill, shine]}>
            <View
              style={[
                styles.shine,
                {
                  width: size * 0.35,
                  height: size * 0.18,
                  borderRadius: size * 0.1,
                  left: size * 0.17,
                  top: size * 0.2,
                },
              ]}
            />
            <View
              style={[
                styles.shine,
                {
                  width: size * 0.1,
                  height: size * 0.1,
                  borderRadius: size,
                  left: size * 0.6,
                  top: size * 0.15,
                  opacity: 0.85,
                },
              ]}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.flat, { inset: 2 * k, borderRadius: size / 2 }, flat]}>
          {crinkles.map((c, i) => {
            const inner = size - 4 * k;
            return (
              <View
                key={i}
                style={[
                  styles.crinkle,
                  {
                    width: inner * c.len,
                    left: inner * (0.5 - c.len / 2 + c.dx),
                    top: inner * (0.5 + c.dy),
                    opacity: c.o,
                    transform: [{ rotate: `${c.deg}deg` }],
                  },
                ]}
              />
            );
          })}
        </Animated.View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: { position: 'absolute' },
  dome: {
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.92)',
    overflow: 'hidden',
  },
  shade: { position: 'absolute', backgroundColor: 'rgba(40,20,140,0.16)' },
  shine: { position: 'absolute', backgroundColor: '#FFFFFF', transform: [{ rotate: '-35deg' }] },
  flat: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  crinkle: { position: 'absolute', height: 1, backgroundColor: '#FFFFFF' },
  ring: { borderWidth: 2, borderColor: '#FFFFFF' },
});
