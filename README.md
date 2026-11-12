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

- Hex-packed sheet of bubbles that fills any screen size.
- Tap to pop, or drag a finger across to pop a whole row. Multi-finger works.
- About 6% of bubbles are "stubborn": the first press squishes them, the second pops them.
- Every pop has a random sound (4 variants) plus a haptic; drag pops use a lighter haptic.
- Counters for today, all time and sheets cleared, saved on the phone.
- Clear a sheet to get "Sheet cleared!" and a pulsing "Grab a fresh sheet" that slides in a new one.
- Sound on/off toggle (also saved). Pops follow the phone's silent switch.
