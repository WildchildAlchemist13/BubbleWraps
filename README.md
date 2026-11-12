# Pocket Apps

Nine small mobile apps built on one shared kit (Expo + React Native + TypeScript).

```
pocket-apps/
  shared/            @pocket/kit: theme, haptics, sound pool, saved state, PillButton
  apps/bubble-wrap/  App 1: Bubble Wrap
```

## Run Bubble Wrap on your phone

1. Install the **Expo Go** app on your phone (App Store / Play Store).
2. On your computer (Node 20+), from this folder:

   ```bash
   npm install
   cd apps/bubble-wrap
   npx expo start
   ```

3. Scan the QR code: iPhone → Camera app; Android → Expo Go's "Scan QR code".
   Phone and computer must be on the same Wi-Fi. If not, use `npx expo start --tunnel`.

## Bubble Wrap: what's in it

Design canvas: screens, style guide and motion spec live in the "Bubble Wrap — App Design" artifact.

- Hex-packed sheet of bubbles that fills any screen size. Tap to pop, or drag a finger across a row. Multi-finger works.
- About 6% of bubbles are "stubborn": the first press squashes them (110% x 80%, wobble), the second pops them. "Tough one." shows the first time.
- Every pop: swell to 112%, spring flat, a ring bursts outward; random sound (4 variants) and a haptic (medium/rigid on taps, light on drags).
- **Tilt shine**: bubble highlights slide toward the light as you tilt (gravity sensor, pitch/roll; level = how you hold it at launch, re-levels over ~10 s, 3 degree dead zone).
- First launch hint: "Tap to pop. Or drag across a row."
- Clear a sheet: "Every last one." and a pulsing "Another sheet". New sheets drop in and land with a small squash.
- Milestones (max one per session): 100 today, 1,000 all time, 10 sheets, coming back the next day.
- Stats sheet (tap the "all time" line): today, all time, sheets cleared, best day, this week's chart; Sound, Vibration and Tilt shine toggles; Reset counts with confirmation.
- Respects Reduce Motion: no bounces or pulses, quick fades, tilt off; haptics stay.
- Font: Nunito. Ground colour #5B4BE0 (white text 5.6:1).
