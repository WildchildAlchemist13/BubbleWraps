# Pop Sheet — App Store release kit

Everything App Store Connect asks for, ready to paste. v1 ships **without ads or purchases**
(AdMob only approves apps that are already live). Ads + "Remove ads" come in an update.

## Support and privacy URLs

The pages are filled in and published:

| Field | Value |
|---|---|
| Support email | `indiewrittechnology@gmail.com` |
| Published by (developer/seller name) | Wildchild Alchemist |
| Policy effective date | November 12, 2026 |

GitHub Pages serves them from **Settings → Pages → Deploy from a branch → `main` / `/docs`**.
Both are live:

- Support URL: `https://wildchildalchemist13.github.io/BubbleWraps/pop-sheet/`
- Privacy Policy URL: `https://wildchildalchemist13.github.io/BubbleWraps/pop-sheet/privacy.html`

## Listing

| Field | Text | Limit |
|---|---|---|
| **Name** | Pop Sheet | 30 |
| **Subtitle** | Pop. Repeat. Feel better. | 30 |
| **Category** | Primary: Entertainment · Secondary: Lifestyle | |
| **Age rating** | 4+ (answer "None" to every content question) | |
| **Price** | Free | |
| **Copyright** | 2026 Wildchild Alchemist | |

**Promotional text** (170, can change any time without review)
> A fresh sheet of bubbles whenever you need a minute. Tap one, or drag a finger across a whole row and hear them go.

**Description**
```
Pop Sheet is endless bubble wrap for your phone.

Tap a bubble and it pops. Drag a finger across a row and pop them all at once. Use as many fingers as you like.

MADE TO FEEL REAL
• Every pop has its own sound and a little buzz
• Some bubbles are stubborn and need a second press, just like the real thing
• Tilt your phone and the light moves across the plastic

A SHEET WHENEVER YOU NEED ONE
• Clear a sheet, grab another, as many as you want
• See how many you've popped today, all time, and your best day
• A week of pops at a glance

QUIET WHEN YOU WANT IT
• Sound, vibration and tilt each have their own switch
• Respects Reduce Motion
• No account, no sign-up. Your counts stay on your phone.
```

**Keywords** (100 chars, commas, no spaces, don't repeat words from the name)
```
bubble,popper,fidget,stress,relief,calm,anxiety,satisfying,asmr,relax,sensory,toy,tap,focus,boredom
```

**What's New** (v1.0): `Hello! Your first sheet of bubbles is ready.`

## Screenshots

`store/screenshots/iphone-6.9/` — four images at 1320 × 2868, upload in order (01 → 04).
Apple scales them down for smaller iPhones. To redo them: `store/screenshots/frame.js`.

## App Privacy (the "nutrition label")

v1: **Data Not Collected.** Answer "No, we do not collect data from this app."
(Counts live only on the phone; no ad or purchase SDK runs; no purchases yet.)

The published policy describes ads and the "Remove ads" purchase as future features only, which
matches this answer. Update both the policy and this label in the same release that adds them.

When ads + Remove ads ship, change it to: Identifiers → Device ID; Usage Data → Advertising Data,
Product Interaction; Diagnostics; Purchases → Purchase History. Linked to user: No. Used for tracking: No.

## App Review notes

```
Pop Sheet is a single-screen bubble-popping toy. No login is required.
Tap or drag across bubbles to pop them. Tap the "all time" line to open stats and settings.
```

## Build and submit (on your computer)

```bash
npm install -g eas-cli
```
```bash
cd apps/pop-sheet
```
```bash
eas login
```
```bash
eas init
```
`eas init` links the project to your Expo account and adds its ID to `app.json`. Commit and push that change.
```bash
eas build --platform ios --profile production
```
Sign in with your Apple developer account when asked; EAS creates the certificates for you.
```bash
eas submit --platform ios --latest
```
This uploads the build to App Store Connect (it can create the app record for you). After Apple
processes it (10–30 min) it shows under **TestFlight**: install it on your iPhone and pop a sheet.

Then in App Store Connect: fill in the listing above, pick the build, and **Submit for Review**.
Review usually takes a day or two.
