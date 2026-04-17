---
title: Deployment
updated: 2026-04-16
status: ops
domain: ops
---

# Deployment

## Targets

| Platform | Status | URL / Artifact |
|---|---|---|
| Web (GitHub Pages) | planned | `https://arcade-cabinet.github.io/midway-mayhem/` |
| Android debug APK | active | `midway-mayhem-debug-apk` artifact on every PR + main push |
| iOS simulator build | planned | local only until App Store pipeline |

## Android

The `android/` Capacitor project is checked into the repository (scaffolded via `pnpm exec cap add android`). The CI `android-smoke` job builds and distributes a debug APK for every PR and every push to `main`.

### Android CI job (`android-smoke` in ci.yml)

Runs on `ubuntu-latest` with KVM enabled for hardware acceleration.

Steps:
1. `pnpm build:native` — builds `dist/` with `CAPACITOR=true` (relative base `./`)
2. `pnpm exec cap sync android` — copies `dist/` into `android/app/src/main/assets/public/`
3. `./gradlew assembleDebug` — produces `android/app/build/outputs/apk/debug/app-debug.apk`
4. Uploads APK as `midway-mayhem-debug-apk` artifact (14-day retention)
5. Boots `api-level: 33 / x86_64 / google_apis` emulator via `reactivecircus/android-emulator-runner@v2`
6. Runs all 6 Maestro flows sequentially (see `docs/TESTING.md → Maestro native smoke tests`)
7. Uploads screenshots + Maestro test output as `maestro-android-results` artifact

### Local Android QA

```bash
# Full build + install + 6 flows (requires adb device / emulator)
pnpm qa:native:android

# Just build the APK without running flows
pnpm native:android:debug
# APK: android/app/build/outputs/apk/debug/app-debug.apk

# Install manually
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### App ID

`com.midwaymayhem.app` — defined in `capacitor.config.ts` and baked into `android/app/src/main/res/values/strings.xml` during `cap add android`.

## Build commands

```bash
pnpm build                  # web → dist/
pnpm build:native           # CAPACITOR=true web build, base='./'
pnpm cap:sync               # sync into android/ + ios/
pnpm native:android:debug   # APK at android/app/build/outputs/apk/debug/
pnpm native:ios:build       # iOS simulator build via xcodebuild
```

## Environments

- **Dev**: `pnpm dev` → http://localhost:5173/midway-mayhem/
- **Preview**: `pnpm preview` → http://localhost:4175/midway-mayhem/ (what e2e tests hit)
- **Production**: Vite build with `base: '/midway-mayhem/'` for GH Pages
- **Capacitor (native)**: Vite build with `base: './'` (relative) for file:// WKWebView

## Workflows (`.github/workflows/`, planned)

| File | Trigger | Job | Output |
|---|---|---|---|
| `ci.yml` | `pull_request` | lint, typecheck, test, test:browser, test:e2e (xvfb), build, android debug APK | PR artifacts |
| `release.yml` | release-please tag | signed Android release APK, iOS archive, web bundle | GitHub Release assets |
| `cd.yml` | `push: main` | deploy dist/ to GH Pages | Pages live site |

Order: **ci → release → cd**. CI gates merges; release produces artifacts; CD deploys what release produced.

## Secrets matrix (when workflows land)

| Secret | Used by | Source |
|---|---|---|
| `ANDROID_KEYSTORE_B64` | release.yml | generated locally, base64-encoded |
| `ANDROID_KEY_ALIAS` | release.yml | |
| `ANDROID_KEYSTORE_PASSWORD` | release.yml | |
| `ANDROID_KEY_PASSWORD` | release.yml | |
| `SENTRY_DSN` | ci.yml + runtime | (optional) sentry.io project |

Never commit secrets. All keystore material stays in GitHub Secrets.

## Native smoke checklist (before shipping)

- [ ] Game boots on iOS simulator (iPhone 15 Pro + iPad Pro)
- [ ] Game boots on Android emulator (Pixel 7 phone + Pixel Tablet + fold)
- [ ] Governor completes ≥30s run per device
- [ ] Verify 60 FPS on M1 Mac / 45 FPS minimum on iPhone 14 Pro / 30 FPS on mid-tier Android
- [ ] HONK button reaches user thumb on portrait phone
- [ ] No ErrorModal during a 2-min play session
- [ ] HDRI loads in-bundle (not a CORS miss)
- [ ] Haptics fire on boost/crash (when Capacitor.Haptics wired)
- [ ] SQLite save round-trips across app backgrounding

## Rollback

Web: `gh workflow run cd.yml --ref <previous-green-sha>` — GH Pages re-deploys that SHA's bundle.

Native: cannot rollback production Play/App Store builds; hotfix-forward via release-please patch release.

## Third-party services

- **GitHub** (source + Pages + Actions)
- **PolyHaven** (HDRI upstream — must stay accessible during CI asset sync; we ship bytes in-repo so this is CI-only)
- **Kenney.nl** (model upstream — we ship baked bytes in-repo)
- **Sentry** (optional, when wired — `@sentry/react` + `@sentry/capacitor`)

No runtime 3rd-party API dependencies.
