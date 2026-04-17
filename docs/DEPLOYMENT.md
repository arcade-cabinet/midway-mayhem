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
| Android debug APK | planned | PR artifact + GitHub Release |
| iOS simulator build | planned | local only until App Store pipeline |

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
