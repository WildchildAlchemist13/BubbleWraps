import { useEffect } from 'react';
import { SensorType, useAnimatedSensor, useFrameCallback, useSharedValue } from 'react-native-reanimated';

const DEAD_ZONE = 3; // degrees of hand wobble to ignore
const FULL_TILT = 20; // degrees past the dead zone for full effect
const RELEVEL_SECONDS = 10; // "level" slowly follows your hand

/**
 * Phone tilt as two values from -1 to 1, for the bubble shine.
 * Works from pitch and roll, not raw sensor numbers. "Level" is however the phone
 * is held when the app opens, then it drifts to follow the hand over ~10 s.
 * Runs every frame on the UI thread. Reads 0 when off or when there's no sensor (web).
 */
export function useTilt(enabled: boolean) {
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const on = useSharedValue(enabled ? 1 : 0);
  const hasBase = useSharedValue(0);
  const baseRoll = useSharedValue(0);
  const basePitch = useSharedValue(0);

  useEffect(() => {
    on.value = enabled ? 1 : 0;
    if (enabled) hasBase.value = 0; // re-level from however it's held now
  }, [enabled]);

  useFrameCallback((frame) => {
    'worklet';
    const dt = Math.min(0.1, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const g = gravity.sensor.value;
    const mag = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    const ease = Math.min(1, dt * 8);
    if (on.value === 0 || mag < 1) {
      x.value += (0 - x.value) * ease;
      y.value += (0 - y.value) * ease;
      return;
    }
    const roll = (Math.asin(Math.max(-1, Math.min(1, g.x / mag))) * 180) / Math.PI;
    const pitch = (Math.atan2(g.y, g.z) * 180) / Math.PI;
    if (hasBase.value === 0) {
      baseRoll.value = roll;
      basePitch.value = pitch;
      hasBase.value = 1;
    }
    let dPitch = pitch - basePitch.value;
    if (dPitch > 180) dPitch -= 360;
    if (dPitch < -180) dPitch += 360;
    const dRoll = roll - baseRoll.value;

    const follow = Math.min(1, dt / RELEVEL_SECONDS);
    baseRoll.value += dRoll * follow;
    basePitch.value += dPitch * follow;

    const shape = (v: number) => {
      const past = Math.max(0, Math.abs(v) - DEAD_ZONE);
      return Math.max(-1, Math.min(1, (Math.sign(v) * past) / FULL_TILT));
    };
    x.value += (shape(dRoll) - x.value) * ease;
    y.value += (shape(dPitch) - y.value) * ease;
  });

  return { x, y };
}
