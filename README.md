# Wildchild Apps

Nine small mobile apps built on one shared kit (Expo + React Native + TypeScript).

```
BubbleWraps/
  shared/            @wildchild/kit: theme, haptics, sound pool, saved state, PillButton
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

## Bubble Wrap: ads and "Remove ads"

**When ads show** (`apps/bubble-wrap/src/adRules.ts`): one full-screen ad, only after a *cleared* sheet when the
user taps "Another sheet". Never mid-popping, never on launch, never on "New sheet" mid-sheet. Nothing on the
day the app is first opened, then at most one ad every 3 cleared sheets and at least 4.5 minutes apart.
Ads are non-personalized and rated G. Google's consent form appears where the law requires it.

**Remove ads**: a one-time purchase through RevenueCat. Offered in the stats sheet, and as a small button on the
"Every last one." screen once someone has seen at least one ad. "Restore purchase" is in the stats sheet.

**Where it runs**: ads and purchases need a *development build*. They're switched off in Expo Go and on web,
so the app still runs there. In development, "Remove ads" offers a test-mode "Pretend I bought it" when the
store isn't set up.

### Try the ads on your phone (Google test ads)

```bash
cd apps/bubble-wrap
npx eas build --profile development --platform android   # or ios (needs an Apple developer account)
```

Install the build, then run `npx expo start --dev-client` and open the app. To see an ad straight away for
testing, temporarily set `graceDays`/`sheetsBetweenAds` lower in `src/adRules.ts`.

### Going live

1. AdMob: create the app and an interstitial ad unit for iOS and Android. Put the **app IDs** in `app.json`
   (replacing Google's test IDs) and the **ad unit IDs** in `.env` (see `.env.example`).
2. RevenueCat: create a project, a non-consumable product `bubblewrap_remove_ads` in App Store Connect and
   Google Play, and an entitlement `remove_ads` that includes it. Put the public SDK keys in `.env`.
3. Change `ios.bundleIdentifier` / `android.package` in `app.json` if you want your own (currently
   `com.wildchildalchemist.bubblewrap`).
