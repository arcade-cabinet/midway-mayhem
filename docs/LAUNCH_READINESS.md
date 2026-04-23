---
title: Launch Readiness Checklist
updated: 2026-04-23
status: current
domain: ops
---

# Launch Readiness — Pre-Submission Sweep

This is the manual QA pass to run before clicking Submit on Google Play / App Store. The automated matrix on `main` is assumed green:

- `ci.yml` (PR + push): lint, tsc, node tests, browser tests (49+ browser + unit tests)
- `cd.yml` (push: main): Playwright e2e (smoke), GitHub Pages deploy, debug APK
- `e2e-nightly.yml` (scheduled): deep seed-playthrough matrix across 3 phrases × 3 viewports

This file covers everything CI/CD cannot: physical-device behavior, accessibility on real screen readers, signing keys, store metadata, and sign-off.

Every box below must be checked OR have an explicit owner + ticket reference before the build moves forward.

---

## Playthrough sanity (local)

Run before signing off, even though CI gates the same data:

- [ ] `pnpm e2e:smoke` — smoke suite green on desktop-chromium (title loads, car moves, HUD renders)
- [ ] `pnpm e2e:nightly` — nightly suite green (3 seed phrases × 3 viewports × 15 frames; distance telemetry monotonically increasing; no NaN in diag dumps)
- [ ] `pnpm test:node` — all node unit tests green (≥ 815 passing)
- [ ] `pnpm test:browser` — all browser screenshot tests green; visual-matrix 8-slice captures within 30% per-pixel tolerance of pinned baselines

---

## Mobile flows (real device — not emulator only)

- [ ] **Android physical**: golden path — Title screen → Daily Route button → run starts → car moves through Zone 1 (Midway Strip) → Balloon pickup collected → honk heard → CROWD REACTION increments → Zone 2 (Balloon Alley) reached → Pause → resume → run ends → game-over overlay displays score
- [ ] **iOS physical**: same golden path
- [ ] **Android**: kill app → reopen → run state or profile preserved (SQLite persistence)
- [ ] **iOS**: same resume flow
- [ ] Notch / Dynamic Island / safe-area not clipped on iPhone with Face ID
- [ ] Status bar contrast OK against dark circus background (`#0B0F1A`)
- [ ] Pinch / zoom / browser chrome do NOT activate (Capacitor native shell)
- [ ] App icon renders at all densities (`pnpm run assets:generate` already ran, mipmap-* + AppIcon-* committed)
- [ ] Splash screen art matches brand (circus big-top composition, not placeholder color block)
- [ ] Touch steering is responsive at 60 fps on Pixel 7 / iPhone 14 baseline devices
- [ ] Haptic feedback on crash event (Capacitor Haptics)

---

## Accessibility

- [ ] Tap-only flow reaches Zone 1 gameplay with no drag required (tap to steer left / tap to steer right mode)
- [ ] System "reduce motion" honoured: no rapid flash effects on Zone 3 fire hoops under reduced-motion setting
- [ ] VoiceOver (iOS): title screen announces "Midway Mayhem: Clown Car Chaos" and difficulty options
- [ ] TalkBack (Android): same
- [ ] Minimum touch target size: all HUD controls ≥ 44 × 44 pt
- [ ] `pnpm lint` clean — no `localStorage` / `sessionStorage` references (biome rule enforced)

---

## Persistence

- [ ] Profile (ticket balance, best scores, achievement unlocks) survives app restart on physical device
- [ ] Active-run distance and SANITY survive kill + relaunch (run-in-progress persistence)
- [ ] Daily route ghost car: best prior daily-route run reappears on next day's run
- [ ] SQLite survives app reinstall on at least one platform
- [ ] On fresh install: onboarding screen (D1 — profile name input) appears before first run

---

## Visual

- [ ] `pnpm test:browser VisualMatrix` — 8-slice POV captures match baselines or updated baselines are committed
- [ ] `pnpm test:browser TrackPackage` — side/plan/POV track renders match baselines; descent is visible as sustained downward slope in side-elevation view
- [ ] `docs/VISUAL_REVIEW.md` Gap Analysis Worksheet rows reviewed; every open gap has a reviewer note or an open ticket
- [ ] Polka-dot hood identity preserved: red base, yellow + blue dots visible on hood from cockpit POV at all form factors
- [ ] Zone 3 (Ring of Fire) red lighting transition visible on export
- [ ] Zone 4 (Funhouse Frenzy) mirror layer renders correctly and does not produce GPU artifacts

---

## Audio

- [ ] Audio starts on first user gesture (Web Audio API unlock) — no silent run
- [ ] Zone 1 (Midway Strip) carousel waltz phrase grammar audible from run start
- [ ] Zone transitions re-key the conductor audio phrase (zone 3 tense; zone 4 chaotic)
- [ ] Honk sound cuts through music bus without ducking artifacts
- [ ] No audio console errors on Android + iOS (`adb logcat` / Xcode console clean)
- [ ] Conductor restarts cleanly after a run end + new run start

---

## Store metadata

- [ ] `docs/store-listing.md` open-questions section is empty
- [ ] Privacy policy URL resolves (`https://[project]/privacy-policy`)
- [ ] Support email functional
- [ ] Screenshots at every required size landed in `artifacts/store/<platform>/<density>/`:
  - iPhone 6.7", iPhone 5.5", iPad Pro 12.9"
  - Android phone, Android 7" tablet, Android 10" tablet
- [ ] App icon: `branding/icon.svg` single-source vector; all densities generated
- [ ] Content rating questionnaire reviewed (see `docs/store-listing.md` §Rating)

---

## Release infrastructure

- [ ] `docs/RELEASE.md` runbook reviewed end-to-end
- [ ] Signing keys present in repo secrets:
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`
  - `APPLE_APP_STORE_API_KEY_ID`
  - `APPLE_APP_STORE_API_ISSUER_ID`
  - `APPLE_APP_STORE_API_PRIVATE_KEY`
- [ ] Latest release tag's `Release` workflow run produced both `midway-mayhem-android-vX.Y.Z` (AAB) and `midway-mayhem-ios-vX.Y.Z` (xcarchive) Actions artifacts
- [ ] `android/` directory committed and `cap sync android` runs clean
- [ ] release-please GitHub Actions PR permissions enabled in repo settings (documented in `DEPLOYMENT.md`)

---

## Crash + telemetry

- [ ] App boots cleanly with no console errors on Android + iOS
- [ ] `adb logcat` and Xcode console show no Capacitor plugin errors
- [ ] Memory under 150 MB at idle title screen on Pixel 7 / iPhone 14 baseline
- [ ] Cold launch < 4 s on Pixel 7 / iPhone 14 baseline
- [ ] No NaN values in `window.__mm.diag()` frame dump during a full Zone 1–4 run
- [ ] No WebGL context loss during a 3-minute run on either baseline device

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Product owner | | | |
| Tech lead | | | |
| QA lead | | | |
| Design lead | | | |
| Compliance/Legal | | | |

When all five sign off and every box above is checked, hand off to [RELEASE.md](./RELEASE.md) — release-please owns the version bump; the human just opens/merges the release PR.

---

## Links

- [RELEASE.md](./RELEASE.md) — what happens after sign-off
- [PRODUCTION.md](./PRODUCTION.md) — partial / post-1.0 tracker
- [STATE.md](./STATE.md) — what's on `main` right now
- [store-listing.md](./store-listing.md) — store copy + metadata draft
- [VISUAL_REVIEW.md](./VISUAL_REVIEW.md) — visual gap-analysis worksheet
- [DEPLOYMENT.md](./DEPLOYMENT.md) — workflow summary + Capacitor build instructions
