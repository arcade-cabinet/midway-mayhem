---
title: App Store Assets — Midway Mayhem
updated: 2026-04-23
status: current
domain: product
---

# App Store Assets

This directory contains all assets used for App Store (iOS) and Google Play (Android) listings.

## Store Screenshots

5 canonical moments × 2 platforms = **10 PNG files**.

```
resources/store-screenshots/
  ios/
    01-title.png        Title screen — cockpit + big-top dome before DRIVE
    02-mid-run.png      Mid-run POV with hood visible and track in motion
    03-boost.png        Boost active — speed-lines / BoostRush FX
    04-trick.png        Trick in-progress — ArrowUp barrel-roll
    05-game-over.png    Game-over overlay (score + replay prompt)
  android/
    01-title.png
    02-mid-run.png
    03-boost.png
    04-trick.png
    05-game-over.png
```

### Regenerating

Screenshots are generated via the Playwright-based governor script:

```bash
# Requires pnpm dev running on :5173
pnpm screenshots:store

# Self-hosted (builds + previews automatically)
pnpm screenshots:store:self
```

The GitHub Actions workflow at `.github/workflows/store-screenshots.yml` regenerates
them on manual dispatch or weekly on Sunday 04:00 UTC. Outputs are uploaded as
a workflow artifact for review — they are **not** auto-committed.

### Platform specs

| Platform | Viewport (CSS px) | DPR | Physical pixels |
|----------|-------------------|-----|-----------------|
| iOS 6.7" | 430 × 932 | 3× | 1290 × 2796 |
| Android Phone | 412 × 732 | 2.625× | ≈ 1080 × 1920 |

### Seed

All in-run screenshots use the deterministic seed phrase `lightning-kerosene-ferris`
at difficulty `plenty` so captures are reproducible and match CI visual baselines.

## Compliance URLs

These are the static legal document URLs required by iOS App Store and Google Play Store for app review and public visibility.

### Public URLs

| Document | URL | Path |
|----------|-----|------|
| Privacy Policy | https://arcade-cabinet.github.io/midway-mayhem/privacy.html | `public/privacy.html` |
| Terms of Service | https://arcade-cabinet.github.io/midway-mayhem/terms.html | `public/terms.html` |
| Legal Landing | https://arcade-cabinet.github.io/midway-mayhem/legal/ | `public/legal/index.html` |

### Usage

Both iOS (App Store Connect) and Android (Google Play Console) require URLs to legal documents during app submission and in app store listings.

**App Store Connect (iOS):**
1. Privacy Policy URL: `https://arcade-cabinet.github.io/midway-mayhem/privacy.html`
2. Terms of Service URL: `https://arcade-cabinet.github.io/midway-mayhem/terms.html`

**Google Play Console (Android):**
1. Privacy Policy: `https://arcade-cabinet.github.io/midway-mayhem/privacy.html`
2. Terms of Service: `https://arcade-cabinet.github.io/midway-mayhem/terms.html`

### Key Claims

**Privacy Policy:**
- Zero data collection (local-only saves)
- No telemetry or analytics
- Fully COPPA-compliant (Children's Online Privacy Protection Act)
- Device permissions (haptics, orientation) are local-only

**Terms of Service:**
- MIT License with permissive usage
- AS-IS warranty disclaimer
- No liability for gameplay issues or data loss
- Age-appropriate for all audiences

## App Description

See [description.md](./description.md) for long-form App Store / Google Play copy.
