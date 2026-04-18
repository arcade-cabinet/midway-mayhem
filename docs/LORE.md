---
title: Lore
updated: 2026-04-18
status: current
domain: creative
---

# Lore

## The premise

The ride has gone off the rails.

You are a clown. You are in your polka-dot car. You are somehow, against all rational explanation, on the Hot Wheels mega-track inside the big-top. The Ringmaster did not sanction this run. The crowd absolutely did not consent to the speed you are currently traveling. Your SANITY is dropping by the second.

Keep going. They love it.

---

## The world

**The Big Top** is a full circus arena. Its canvas walls are striped red and white. Its tent poles glow with carnival lights. HDRI: `circus_arena_2k.hdr` (PolyHaven CC0) wraps the sky and provides physically-based lighting for the entire scene.

**The Track** is a Hot Wheels-style mega-track — bright orange plastic, blue guardrails, white lane markings. It is suspended inside the arena at impossible angles, looping through zones the designers called carnival "acts." The track exists in a space that is both very real (you can crash into it) and cartoonishly implausible (Ring of Fire exists, somehow).

**The Car** is the star. A polka-dot clown car: red body, yellow and blue dots, chrome steering wheel with purple spokes, squirting flower hood ornament. It is loud, fast, and structurally held together by confidence alone.

---

## Characters

### The Player: The Clown

No name. No face visible. You are the driver. You see your own gloved hands on the wheel. The gauges read LAUGHS and FUN, which is all the information you need.

### The Ringmaster (Raid Announcer)

The Ringmaster does not want you on his track. He announces raids with practiced showmanship — the announcements are delivered as though he's building up an act, not trying to kill you. Voice lines are delivered via the `BarkerCrowd` system. He is theatrical, not malicious. Probably not malicious.

### The Crowd Critters

The audience is not entirely human. Five categories of crowd critters populate the bleachers and, occasionally, the track edges:

1. **Chicken** — nervous, scatters when you honk
2. **Bear** — sits exactly where you need to be, completely unperturbed
3. **Mime** — silent, watching, judgmental
4. **Seal** — clapping regardless of what you do, enthusiastic supporter
5. **Clown** (NPC) — on the track, not driving, deeply confused

All critters are sourced from Quaternius Ultimate Animated Farm Animals (CC0). The honk-flee mechanic: honking at a critter on the track causes it to scatter. CROWD REACTION goes up.

### Ghost Cars

Past-run ghosts overlay the current run as translucent replicas of your car. They replay your exact input trace from a previous run. The best run for the current seed is automatically stored and displayed. Ghost cars are rendered by `render/obstacles/GhostCar.tsx`.

---

## Zone lore

### Zone 1 — The Midway Strip

The entrance. Warm amber light, the smell of popcorn (imagined). Red and white striped arches overhead. The barker is here, hawking tickets, narrating your approach. This is where you remember: this is supposed to be fun.

*Hazards: sawhorses, cone clusters — forgiving, tutorial-paced.*

### Zone 2 — Balloon Alley

The crowds went quiet. Someone released several hundred balloons simultaneously. The pastel sky is beautiful. The gates ahead are not. Threading between gates at speed requires actual precision; you are no longer in warm-up territory.

*Hazards: gate arrays requiring precision threading. Balloon pickups = +1 ticket.*

### Zone 3 — Ring of Fire

The lights changed. The music changed. The crowd is making sounds you cannot categorize. The rings ahead are definitely on fire. The hammers swing on a timing you must learn by watching, not intuiting. There are no free passes here.

*Hazards: fire hoops (graze = SANITY loss), swinging hammers (timing-based dodge).*

### Zone 4 — Funhouse Frenzy

The mirrors are moving. There are two of you now. The obstacle density is a deliberate punishment for getting this far. The crowd is in full frenzy. Your SANITY is at its last few points. The CROWD REACTION meter is peaking.

The track loops back. There is no exit.

*Hazards: everything, mirrored, at maximum density.*

---

## Tickets

Tickets are the in-world carnival currency. Collect them on track, spend them in the Ticket Shop on cosmetic unlocks. Tickets are persistent across runs; they are stored in the `profile` table.

One ticket = one ride. The carnival economy makes perfect sense.

---

## The daily route

Once per calendar day, a fixed seed produces the exact same track layout for all players worldwide. The Ringmaster announces it. Ghost cars from other players on the daily route can appear. Accessed via `?daily=1` or the in-game "Daily Route" button.

---

## Credits

All third-party assets used under their respective open licenses:

| Asset | Author | License |
|-------|--------|---------|
| Kenney Racing Kit | Kenney.nl | CC0 1.0 |
| Quaternius Ultimate Animated Farm Animals | Quaternius | CC0 1.0 |
| `circus_arena_2k.hdr` | PolyHaven | CC0 1.0 |
| GeneralUser GS 1.472 soundfont | S. Christian Collins | Custom permissive (free for use, attribution required) |
| Bangers typeface | Vernon Adams | SIL OFL 1.1 |
| Rajdhani typeface | Indian Type Foundry | SIL OFL 1.1 |

Full license texts are included in `public/licenses/`.
