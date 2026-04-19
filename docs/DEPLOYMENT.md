---
title: Deployment
updated: 2026-04-18
status: current
domain: ops
---

# Deployment

## Web (GitHub Pages)

Web build is **debug-only** — it exists for development and CI preview. The shipped targets are native iOS and Android.

### How it deploys

1. Every push to `main` triggers `.github/workflows/cd.yml`
2. `pnpm build` produces `dist/` (Vite, base path `/midway-mayhem/`)
3. GitHub Pages action deploys `dist/` to `https://arcade-cabinet.github.io/midway-mayhem/`

### Build locally

```bash
pnpm build         # standard web build (base = /midway-mayhem/)
pnpm preview       # serve dist/ locally for e2e testing
```

### Secrets / env vars

**None required at present.** The game has no backend, no API keys, no third-party auth. When/if a leaderboard is added this section will need updating.

---

## Android (Capacitor)

### Debug APK (CI artifact)

Every CD run (push to `main`) assembles a debug APK and uploads it as a workflow artifact via `actions/upload-artifact@v4`. Download from the workflow run in GitHub Actions.

### Release APK

Signing happens in `.github/workflows/release.yml` triggered by release-please version tags (`v*.*.*`).

Note: the `android/` directory is not yet committed to the repo. The android-debug-apk job in `cd.yml` is commented out until `npx cap add android` is run and the directory is committed. See the TODO comment in `cd.yml`.

### Build locally

```bash
pnpm build:native           # Vite build with base='./'
pnpm exec cap sync android  # copy dist/ into android assets
cd android
./gradlew assembleDebug     # → android/app/build/outputs/apk/debug/app-debug.apk
```

Requires:
- Java 21 (Temurin) — `setup-java@v4` in CI
- Android SDK — `setup-android@v3` in CI
- `android/` directory committed (run `npx cap add android` first)

---

## iOS (Capacitor)

### Archive + distribute

```bash
pnpm build:native           # Vite build with base='./'
pnpm exec cap sync ios      # copy dist/ into ios App/public/
open ios/App/App.xcworkspace
# → Archive → Distribute (App Store Connect or Ad Hoc)
```

CI does not run Xcode builds (no macOS runner configured). iOS builds are manual or via a separate macOS CI runner if added.

---

## URL flags (dev + test only)

These flags are only active when `import.meta.env.DEV` is true or the flag is explicitly present. They are stripped in production builds.

| Flag | Effect |
|------|--------|
| `?debug=1` | Expose `window.__mm` diagnostics object + `window.__mmCapture()` |
| `?governor=1` | Start Yuka.js autonomous driver (governor playthrough) |
| `?diag=1` | (legacy, no-op) `window.__mm.diag()` is now always installed |
| `?skip=1` | Skip title screen, drop directly into gameplay |
| `?autoplay=1` | Alias for skip — auto-starts a run on load |
| `?daily=1` | Boot into daily-route mode (deterministic seed from today's date) |
| `?night=1` | Force night-mode visual theme |

---

## release-please gotcha

Release-please creates PRs to bump the version and update CHANGELOG.md. These PRs are opened **by the github-actions bot**. By default, GitHub Actions cannot approve its own PRs.

**Required repo setting (one-time, manual):**
Go to repo Settings → Actions → General → scroll to "Workflow permissions" → enable **"Allow GitHub Actions to create and approve pull requests"**.

Until this is enabled, release-please PRs will be blocked from merging via branch protection. This is a repository-settings change, not a code change.

---

## Workflow summary

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | `pull_request` (any branch) | lint, typecheck, node tests, browser tests |
| `cd.yml` | `push: main` | release-please reconcile, deploy to GitHub Pages, assemble debug APK |
| `release.yml` | `release: published` | build signed release artifacts, upload to GitHub Releases |
