---
title: Release Runbook
updated: 2026-04-23
status: current
domain: ops
---

# Midway Mayhem — Release Runbook

Step-by-step procedure for cutting a new release. Every pre-store build goes through this runbook. For day-to-day feature work see `docs/ARCHITECTURE.md` and `docs/PRODUCTION.md`; this file is only about getting a build onto the stores.

## Release channels

| Channel | Target | Audience |
|---------|--------|----------|
| `internal` | Google Play internal track + TestFlight IT | Team only |
| `beta` | Google Play closed testing + TestFlight beta | Opt-in testers |
| `production` | Google Play production + App Store production | Public |

All three follow the same runbook; only the final store-submit step differs.

## Preconditions

For the **automated channel** (every push to `main`), CI is the only gate: `ci.yml` must be green for the HEAD commit. Release-please then opens / updates a release PR automatically.

For a **store-submit channel** (`internal` / `beta` / `production`), walk `docs/LAUNCH_READINESS.md` end-to-end first. That checklist owns manual QA, signing-key verification, physical-device smoke, and accessibility pre-submit sweep. This runbook only covers what happens after Launch Readiness is signed off.

## Step 1 — Let release-please cut the version

We use **release-please** (see `release-please-config.json` + `.release-please-manifest.json`). On every push to `main`, the `Release` workflow runs `release-please-action`, which inspects the conventional-commits log and either opens/updates a release PR ("chore(main): release X.Y.Z") or, if such a PR is already merged, creates the GitHub Release + tag.

Do **not** run `pnpm version` or `git tag` by hand. The contract:

- Land commits on `main` using Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:` …). The commit verb determines the bump (feat → minor, fix → patch, breaking footer → major).
- Wait for the release-please PR to update on top of the new commits.
- Approve + squash-merge the release-please PR (`gh pr merge <pr> --squash` if `automerge.yml` didn't run).
- The merge fires another `Release` run; this time `release_created` is `true` and the `android` + `ios` build jobs execute.

> **release-please gotcha**: release-please PRs are opened by the github-actions bot. Go to repo Settings → Actions → General → enable "Allow GitHub Actions to create and approve pull requests" if release PRs are blocked. (One-time setting, documented in `docs/DEPLOYMENT.md`.)

## Step 2 — Watch the release workflow build artifacts

This fires `.github/workflows/release.yml`. The `android` and `ios` build jobs each upload a GitHub Actions artifact:

- `midway-mayhem-android-vX.Y.Z` — directory containing `app-*.aab`
- `midway-mayhem-ios-vX.Y.Z` — directory containing `App.xcarchive`

Artifacts attach to the workflow run on the **Actions tab**, not to the GitHub Release page. Download via `gh run download <run-id>` or the workflow run UI. Web bundle deployment is owned by `cd.yml` (push to `main`), not the release tag.

> Until the `android/` directory is committed and the `ios/` Xcode build is configured on a macOS runner, these artifact jobs will be skipped. See `PRODUCTION.md` "Partial" section.

## Step 3 — Validate artifacts

### Android

- Download `midway-mayhem-android-vX.Y.Z`, extract the AAB.
- Install on a physical device via `bundletool build-apks` → `adb install`.
- Smoke-test the golden path: Title screen → Daily Route → car descends Zone 1 (Midway Strip) → Zone 2 (Balloon Alley) → at least one Balloon pickup collected → honk → pause + resume.
- Verify saved-game persistence: kill app → reopen → run state or profile preserved.
- Verify SQLite database survives reinstall on at least one device.

### iOS

- Download `midway-mayhem-ios-vX.Y.Z` — this is an **unsigned xcarchive**.
- Open in Xcode Organizer. Re-sign with the App Store distribution certificate.
- Same smoke-test golden path as Android.
- Verify safe-area insets: notch/Dynamic Island not clipped on iPhone with Face ID cutout.
- Verify status bar contrast against the circus Night dark background (`#0B0F1A`).

## Step 4 — Submit to stores

### Google Play

1. Play Console → Internal testing → Create new release
2. Upload AAB
3. Release notes: paste the `CHANGELOG.md` entry for `vX.Y.Z`
4. Review → Rollout

### Apple App Store

1. TestFlight → Internal testing group → `+` → Select build
2. Submit for review (production channel only)
3. App Store Connect → My Apps → Version `X.Y.Z` → What to Test (paste changelog)

## Step 5 — Monitor

- First 24 h: watch Play Console ANR/crash dashboard and App Store Connect crash reports.
- First 72 h: track reviews; respond to crash-inducing reviews with a patch plan.
- First 7 d: diff aggregated metrics (session length, d1 retention, average run distance) against the prior release baseline.

## Step 6 — Tag regression point, merge changelog

```bash
gh release edit vX.Y.Z --notes-file CHANGELOG.md
```

## Rollback

If the release breaks in the first 2 h:

1. Play Console → Releases → Halt rollout (90% of installs paused within 10 min)
2. App Store Connect → Pause manual release
3. Revert offending commit on `main`
4. Follow this runbook from Step 1 with the patch version

If the release ships with a content/balance bug but no crash:

- Hold at the current store build; push the fix in the next scheduled release cycle (tunable changes ship as new versions, not patches, per `PRODUCTION.md` ship policy).

## Release cadence target

| Phase | Cadence |
|-------|---------|
| Pre-launch beta | Weekly internal builds |
| Soft launch | Bi-weekly minor releases |
| Global launch | Monthly minor; hotfix AOE |
| Post-launch | Monthly minor + ad-hoc |

## Related

- `docs/PRODUCTION.md` — implementation status + post-1.0 polish list
- `docs/LAUNCH_READINESS.md` — pre-store-submit manual QA sweep
- `docs/STATE.md` — current branch state + recent releases
- `docs/ARCHITECTURE.md` — tech stack the release must respect
- `docs/store-listing.md` — store copy + metadata draft
- `docs/DEPLOYMENT.md` — workflow summary + Capacitor build instructions
