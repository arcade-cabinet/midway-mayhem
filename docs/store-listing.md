---
title: Store Listing Copy
updated: 2026-04-23
status: draft
domain: product
---

# Midway Mayhem — Store Listing Draft

Canonical store metadata for Google Play + Apple App Store. Peer reviewed before each submission (see `docs/RELEASE.md` Step 4).

---

## Short title (30 chars max)

**Midway Mayhem: Clown Car Chaos**

## Subtitle / short description (80 chars)

Race a polka-dot clown car down a Hot Wheels coil inside a circus big-top.

## Full description (4000 chars)

> The ride has gone off the rails. Literally.
>
> You are a clown. You are in your polka-dot car. Somehow, against all rational explanation, you are on the Hot Wheels mega-track inside the big-top. The Ringmaster did not sanction this. The crowd is screaming. The SANITY meter is dropping.
>
> Midway Mayhem: Clown Car Chaos is a cockpit-perspective arcade runner. The track is a procedurally generated coil that descends through four escalating carnival zones — from the warm, forgiving Midway Strip to the strobing chaos of Funhouse Frenzy. The car goes forward. Your job is to steer.
>
> **Features**
>
> - **Cockpit POV, always**: you see the polka-dot hood, the chrome wheel, the track rushing toward you. No third-person, no map view.
> - **Four zones, one coil**: The Midway Strip, Balloon Alley, Ring of Fire, and Funhouse Frenzy each have distinct hazards, lighting, audio, and atmosphere. The track descends into the dome floor.
> - **Procedural track + daily route**: every run is seeded. The Daily Route gives all players the same track once per day — with ghost cars from prior runs.
> - **SANITY vs CROWD REACTION**: your durability is SANITY; your score is CROWD REACTION. Chaining clean passes builds a combo multiplier. A well-timed honk at max LAUGH BOOST produces the biggest crowd-pleasing moment you can manufacture.
> - **Raids**: the Ringmaster announces. You have 2 seconds to find the gap lane. Surviving clean adds 100 CROWD REACTION. Failing costs 30 SANITY.
> - **Critters on the track**: honk at them. They scatter. The crowd loves it.
> - **Ghost cars**: your best run for each seed is replayed as a translucent ghost. Beat your ghost.
> - **Tickets**: collect them on track; spend them on cosmetic unlocks.
> - **Cross-platform**: Android and iOS — local persistence via SQLite. No account required. No network required.
> - **One-thumb portrait play**: designed mobile-first. The steering control is a drag input — no buttons to miss. Tablets get a wider composition. Desktop is supported for development.
>
> Midway Mayhem is made under the Arcade Cabinet label.

---

## Keywords / tags

arcade, runner, casual, clown, circus, hot wheels, cockpit, procedural, daily challenge, one-thumb, colorful, mobile

## Categories

- Google Play: Arcade / Casual
- Apple App Store: Games → Arcade, Games → Casual

---

## Screenshots (deliverables per platform)

Per device profile (iPhone 6.7", iPhone 5.5", iPad Pro 12.9", Android phone, Android 7" tablet, Android 10" tablet):

1. **Title screen** — "Drive fast. Honk louder." hero composition with circus big-top background art
2. **Zone 1 cockpit POV** — polka-dot hood, Midway Strip amber lighting, sawhorses ahead
3. **Zone 3 fire hoops** — deep red Ring of Fire, fire hoop rings in frame, SANITY pressure visible
4. **Zone 4 chaos** — Funhouse Frenzy strobing neon, mirror layer, maximum density
5. **Game Over** — CROWD REACTION score + combo streak, daily route rank, ticket earned

Source fixtures: `pnpm test:browser VisualMatrix` produces `.test-screenshots/visual-matrix/slice-*.png`. Final store screenshot set requires a marketing overlay pass — tracked as a pre-store-submit task in `PRODUCTION.md`.

---

## App icon

Single source vector at `branding/icon.svg` (polka-dot clown car front-on, circus big-top silhouette behind). Generated across all densities via `@capacitor/assets` (`pnpm run assets:generate`). Placeholder in place until vector is authored.

---

## Rating

- Google Play: **Everyone** (mild cartoon violence — critters scatter, car crumbles. No blood, no weapons, no real-world themes.)
- Apple: **4+** (no objectionable content)

### Content rating questionnaire answers (Google Play)

| Question | Answer |
|----------|--------|
| Violence | Mild, cartoon. Car crashes into obstacles; critters scatter. No blood, no injury depiction. |
| Sexual content | None |
| Profanity | None |
| Drugs, alcohol, tobacco | None |
| Gambling | None (no real money; Tickets are gameplay-only collectibles) |
| User-generated content | None |
| Shares location | No |
| Digital purchases | None at launch |

### IARC questionnaire key points

- "Tickets" in gameplay are collectibles with no real-money value. No in-app purchase system at launch.
- Violence is entirely cartoon abstraction (car hitting obstacles, SANITY meter draining). No weapon use, no human injury.
- The Ringmaster's audio lines are theatrical announcements, not threatening speech.

---

## Privacy policy

Hosted at: `https://[project]/privacy-policy` (TBD — pre-store-submit blocker, tracked in `PRODUCTION.md`).

Summary:

- No account system; profile stored locally in SQLite.
- No analytics, no ads, no third-party SDKs at launch.
- No data leaves the device.
- The Daily Route ghost feature uses only locally-stored replay data from the device owner's own prior runs. No network request is made.

---

## Support contact

- Support email: `support@[project]`
- Web: `https://[project]/support`

---

## Release notes template

```
Version X.Y.Z

- [feat]: [one-line user-facing change]
- [fix]: [...]

Track updates:
- [zone]: [what changed in the run layout for this version]

Thanks for playing — send feedback to support@[project].
```

---

## Review notes (for Apple / Google reviewer)

- The game has no in-app purchases and no ads.
- Account creation is not required; the app functions fully offline.
- "Tickets" are a collectible score currency within the game — no real-world monetary value, no store, no exchange.
- The Ringmaster character is a theatrical narrator; raid announcements are circus-show voice lines, not threatening or mature content.

---

## Open questions before first submission

- [ ] Final publisher / company name
- [ ] Real privacy policy URL
- [ ] Real support email
- [ ] Final app icon source (`branding/icon.svg`)
- [ ] Real screenshots (require visual polish + title screen hero art to land first — see `PRODUCTION.md`)
- [ ] Real marketing copy pass (current full description is a working draft)
- [ ] iOS short description field (100 char Apple limit — subtitle above needs trimming)
