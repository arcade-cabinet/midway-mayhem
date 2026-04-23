---
title: App Store Compliance URLs
updated: 2026-04-23
status: current
domain: product
---

# App Store Compliance URLs

These are the static legal document URLs required by iOS App Store and Google Play Store for app review and public visibility.

## Public URLs

| Document | URL | Path |
|----------|-----|------|
| Privacy Policy | https://arcade-cabinet.github.io/midway-mayhem/privacy.html | `public/privacy.html` |
| Terms of Service | https://arcade-cabinet.github.io/midway-mayhem/terms.html | `public/terms.html` |
| Legal Landing | https://arcade-cabinet.github.io/midway-mayhem/legal/ | `public/legal/index.html` |

## Usage

Both iOS (App Store Connect) and Android (Google Play Console) require URLs to legal documents during app submission and in app store listings.

### App Store Connect (iOS)

When setting up app metadata:

1. Privacy Policy URL: `https://arcade-cabinet.github.io/midway-mayhem/privacy.html`
2. Terms of Service URL: `https://arcade-cabinet.github.io/midway-mayhem/terms.html`

### Google Play Console (Android)

When setting up app information:

1. Privacy Policy: `https://arcade-cabinet.github.io/midway-mayhem/privacy.html`
2. Terms of Service: `https://arcade-cabinet.github.io/midway-mayhem/terms.html`

## Implementation Details

- **Static HTML:** All pages are plain HTML5, no JavaScript or external resources beyond Google Fonts (Rajdhani)
- **No cookies:** No tracking cookies or local storage manipulation
- **Offline accessible:** Pages can be served on GitHub Pages at the specified URLs
- **Mobile responsive:** All pages are optimized for mobile viewing
- **Brand colors:** Pages use the standard Midway Mayhem palette (Red, Yellow, Night)
- **Consistent navigation:** Links between documents for easy discovery

## Key Claims

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

## Deployment

These files are deployed to GitHub Pages via the CI/CD pipeline when pushed to the `main` branch:

1. Files are committed to `public/` directory
2. CI builds the project with Vite
3. `dist/` folder is deployed to GitHub Pages
4. Files become available at the URLs listed above

## Updates

These documents are updated on an as-needed basis when:
- Privacy practices change
- Legal requirements evolve
- App features or data handling changes
- License or terms require adjustment

Always verify that the app store listing references the current URLs whenever updating these documents.
