---
title: Midway Mayhem — Rules Reference
updated: 2026-04-23
status: current
domain: product
---

# Midway Mayhem — Rules Reference

Authoritative, implementation-level rules for a single run of Midway Mayhem. Design intent lives in [DESIGN.md](./DESIGN.md). When rules disagree with this file, this file wins.

The mental model: **a single continuous descent through four escalating zones.** The car moves forward automatically. Your only agency is the steering input, the honk, and the moment-to-moment decision of whether to trade SANITY for CROWD REACTION.

---

## 1. Objective

Survive the descent. The run ends when:

1. **SANITY reaches zero** — the car crumbles; run is over.
2. **The FinishBanner is crossed** — you completed the coil. High-score eligible.

There are no opponents. The only adversary is the track and your own SANITY budget. The score is CROWD REACTION accumulated over the run, multiplied by the longest continuous combo chain and the current difficulty multiplier.

---

## 2. The Track

The track is procedurally generated from `src/config/archetypes/track-pieces.json` + a 32-bit seed. Each run is deterministic: the same seed produces the same obstacle layout, zone transitions, and critter placements.

### Run structure

| Zone | Metres | Name | Tone |
|------|--------|------|------|
| 1 | 0–450m | The Midway Strip | Warm, forgiving — tutorial space |
| 2 | 450–900m | Balloon Alley | Precision threading, pastel sky |
| 3 | 900–1350m | Ring of Fire | Fire hoops, swinging hammers, SANITY pressure |
| 4 | 1350–1800m | Funhouse Frenzy | Maximum density, mirrored chaos |

Default run length: 80 track pieces (22 m each, ≈ 1760 m total). Configurable via `runLength` in `tunables.json`.

### Descent profile

The Midway is a **coiled descent through the big-top**. Track altitude is monotonically non-increasing across the descent zones:

- Zone 1 descends ≤ 8m (flat tutorial space).
- Zones 2–4 accumulate a total descent of 25–70m, with the coil reading as a sustained downward spiral.
- Cumulative pitch is clamped to ±0.06 rad (about ±3.4°) so no individual piece creates a free-fall artifact.

The finish line is on the dome floor. You started on a suspended platform above it.

### Daily route

Once per calendar day, a fixed seed (derived from the UTC date) produces the same track layout for all players worldwide. Accessed via `?daily=1` or the in-game "Daily Route" button. Ghost cars from previous players on the same daily route may appear.

---

## 3. The Car

The polka-dot clown car is the only controllable vehicle. It is not physics-simulated — speed is governed by `tunables.json:baseSpeedMps` + zone speed modifiers. The car's lateral position on the track is the only axis the player controls.

### Stats

| Stat | In-world name | Range | Notes |
|------|--------------|-------|-------|
| Lateral position | (internal) | [−1.0, 1.0] normalized | Steered via drag/tilt/keyboard |
| Speed (m/s) | (internal) | `baseSpeedMps` × zone modifier | No player control |
| SANITY | SANITY | [0, 100] | Reduced by crashes, grazes, SANITY drains |
| Crowd reaction | CROWD REACTION | [0, ∞) | Accumulated from pickups, tricks, combos |
| Boost | LAUGH BOOST | [0, 1.0] | Fills on trick chains; consumed on honk-trick |

### Damage levels

| State | Trigger | Visual |
|-------|---------|--------|
| Clean | No recent crash | Polka-dot hood at full brightness |
| Scratched | ≥ 1 crash since last repair pickup | Scratches on hood panels |
| Damaged | SANITY < 60 | Dents, cracked windshield texture |
| Critical | SANITY < 30 | Smoke particles, cockpit wobble FX |
| Dead | SANITY = 0 | Run ends; game-over overlay |

Damage is visual-only — it does not alter car handling. SANITY is the only mechanical representation of damage.

---

## 4. Input

| Input method | Action |
|-------------|--------|
| Pointer drag (left/right) | Steer left/right |
| Touch drag (left/right) | Steer left/right (mobile) |
| Arrow keys | Steer left/right (secondary) |
| Space / tapping screen center | Honk |
| Escape / P | Pause |

Steering is continuous: hold left to drift left, release to return toward center. There is no handbrake, no acceleration control, and no braking.

### Honk

Honking produces a CROWD REACTION burst proportional to the current combo chain. If LAUGH BOOST is full, a honk-trick fires — consuming the boost for a larger burst and a camera-shake effect.

Critters on the track scatter when honked at, adding a small CROWD REACTION bonus.

---

## 5. Obstacles and Hazards

Obstacles are placed deterministically by `src/game/runPlan.ts` at run start. The layout is seeded: same seed = same layout.

### Obstacle types by zone

| Zone | Obstacle | Effect on contact |
|------|----------|------------------|
| 1 (Midway Strip) | Sawhorse | Mild crash: −5 SANITY |
| 1 (Midway Strip) | Cone cluster | Mild crash: −5 SANITY per cone |
| 2 (Balloon Alley) | Gate array | Threading gap: 0 penalty. Side hit: −8 SANITY |
| 3 (Ring of Fire) | Fire hoop | Graze: −12 SANITY. Direct hit: −20 SANITY |
| 3 (Ring of Fire) | Swinging hammer | Timing-based. Hit: −25 SANITY |
| 4 (Funhouse Frenzy) | Mirror double | Same as source obstacle, mirrored position |
| 4 (Funhouse Frenzy) | NPC clown car | Wandering obstacle. Hit: −15 SANITY |

All exact values are in `src/config/tunables.json` — the source file (`.ts`) never contains magic numbers.

### Pickups

| Pickup | Effect |
|--------|--------|
| Balloon cluster | +1 Ticket, +CROWD REACTION |
| LAUGH BOOST capsule | Fill LAUGH BOOST meter |
| Star pickup | 2× CROWD REACTION multiplier for 5s |
| Repair kit | +20 SANITY, visual damage step healed |

---

## 6. Scoring

CROWD REACTION accumulates throughout the run. The final score is:

```
score = CROWD_REACTION × combo_multiplier × difficulty_multiplier
```

- **Combo multiplier**: increases with consecutive clean passes through obstacles (no contact). Breaks on any crash or out-of-lane penalty. Max multiplier is configurable in `tunables.json:maxComboMultiplier`.
- **Difficulty multiplier** (see §8).

CROWD REACTION events:
- Threading a gate array: +10 per gate
- Passing through a fire hoop cleanly: +25
- Balloon pickup: +5
- Critter scatter (honk on track critter): +8
- Honk trick combo (LAUGH BOOST full): +50 × current combo chain

---

## 7. Raids

Raids are the central tension beat of **Ring of Fire**. The `RaidDirector` (wired into `GameLoop`) samples a raid probability per zone transition. A raid spawns a Ringmaster announcement via `BarkerCrowd`, then drops a sweeping hazard across all lanes simultaneously.

Raid behaviour:
- 2s audio warning (Ringmaster voice line) before the hazard appears.
- Hazard spans all lanes — the player must dodge to the gap lane announced in the voice line.
- Surviving a raid with no contact: +100 CROWD REACTION.
- Failed dodge: −30 SANITY.

Raid frequency is controlled by `tunables.json:raidProbabilityPerZone`. Zone 3 (Ring of Fire) has the highest raid coefficient; zones 1–2 have near-zero coefficients.

---

## 8. Difficulty

| Tier | Speed multiplier | SANITY drain rate | Combo max | Score multiplier |
|------|-----------------|-------------------|-----------|-----------------|
| Casual | ×0.8 | ×0.8 | ×3 | ×0.75 |
| Normal | ×1.0 | ×1.0 | ×5 | ×1.0 |
| Nightmare | ×1.3 | ×1.3 | ×8 | ×1.5 |

Difficulty is selected from the title screen. It affects speed, drain rate, the maximum combo multiplier cap, and the final score multiplier. Difficulty values are all in `tunables.json` — no magic numbers in logic files.

---

## 9. Ghost Cars

At run end, the best-scoring run for the current seed is persisted to `profile.replay`. On subsequent runs of the same seed, a translucent ghost car replays the exact steering input trace of the best prior run.

- Ghost car is rendered by `render/obstacles/GhostCar.tsx`.
- Ghost collision is visual-only — no SANITY penalty for passing through the ghost.
- Ghost is displayed for both personal-best seeds and the daily route (where ghosts from other players may appear).

---

## 10. Persistence

| Data | Table | When written |
|------|-------|-------------|
| Run result (score, seed, difficulty, distance) | `run` | On run end |
| Best replay for seed | `replay` | On run end, only if new best |
| Lifetime stats (runs, total distance, max score) | `lifetime_stats` | On run end |
| Ticket balance | `profile` | On run end |
| Unlocked cosmetics | `achievements` | On unlock event |
| Preferences (audio, motion-reduce) | `preferences` | On settings change |

Persistence uses `@capacitor-community/sqlite` on native (iOS + Android) and `sql.js` (WASM) on web. Schema in `src/persistence/schema.ts`. Both paths share identical drizzle-orm schema.

---

## 11. Leaderboard

The leaderboard displays the top 10 scores for the daily route, by seed, scoped to the local device profile. There is no cross-device sync at launch. Player name is set in the profile onboarding screen (D1).

---

## 12. Glossary

- **SANITY**: The car's durability analog. Reduced by crashes, hazard contact, and some raid effects. Run ends at 0.
- **CROWD REACTION**: The run score. Accumulates from pickups, combos, tricks, and surviving raids.
- **LAUGH BOOST**: A meter that fills on trick chains. When full, a honk consumes it for a larger event burst.
- **Combo**: consecutive clean passes (no obstacle contact). Builds multiplier; breaks on crash.
- **Daily route**: a fixed seed shared worldwide each calendar day.
- **Raid**: a Ringmaster-announced sweeping hazard crossing all lanes.
- **Ghost car**: a translucent replay of a prior run at the same seed.
- **Critter**: crowd animal that can wander onto the track and scatter on honk.
- **Archetype**: a JSON-defined track piece type (`straight`, `dip`, `plunge`, `slight-left`, etc.) from which the procedural run is assembled.
- **Zone**: one of four themed 450m sections of the track, each with distinct hazard density, audio, and visual treatment.

This file is the authoritative rules spec. Tuning values are all in `src/config/tunables.json`. The design intent that shaped these rules lives in `docs/DESIGN.md`.
