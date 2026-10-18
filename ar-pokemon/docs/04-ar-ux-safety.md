# 4. AR, UX & Safety

## 4.1 Screens

| Screen | Purpose |
|--------|---------|
| **Map** | Your position, nearby spawn rustles, places, current mode badge (walk/bike/kayak...), session distance, weather, time of day |
| **Encounter (AR)** | Camera view with the Pokémon placed in the world; throw balls or start battle |
| **Encounter (classic)** | Classic battle screen with a static background matching the biome — always available, required when AR isn't practical |
| **Battle** | Main-series style battle UI: Fight / Bag / Pokémon / Run |
| **Party / Box / Summary** | Team management |
| **Bag** | Items by pocket |
| **Pokédex** | Entries with your personal catch map |
| **Trainer card / Journal** | Badges, distance by activity, session history with route maps |
| **Queue** | Encounters saved while you were moving (see 4.3) |
| **Settings** | AR on/off, classic catch mode, units, backups, manual activity mode, download area |

## 4.2 AR encounter

**Level 1 — camera overlay (build first):** The camera feed shows behind a 2D
sprite (or 3D model) anchored roughly in the center, with a gyroscope keeping
it in place as you turn. It works on every phone and is quick to build.

**Level 2 — world-anchored AR:** ARKit/ARCore plane detection places the
Pokémon on the ground or water surface at real-world scale using the species'
height from data. Water types bob on water, flying types hover, and there's a
soft shadow and idle animation.

**Level 3 — polish:** occlusion (people/environment depth where supported),
lighting estimation, the Pokémon reacting to proximity, AR photo mode to save
pictures of your catches in the wild.

**Throw mechanics:** swipe to throw; physics arc; curveball spin bonus; a
shrinking timing ring like GO. All of this only modifies the catch formula
by up to ×1.3 (see doc 3.5). The real game math is in charge.

**Assets:** start with 2D sprites (Showdown/PokeAPI sprites) as billboards in
AR; they look surprisingly good. 3D models can be added later per species.
Cries play on appearance.

## 4.3 Queued encounters (the core safety feature)

When the mode is `bike`, `kayak` or `run`, or speed is > 8 km/h:

1. A spawn in range is **auto-recorded** to the encounter queue rather than
   opening on screen.
2. A distinct **haptic pattern** + optional sound/voice ("A wild Psyduck!")
   tells you, without needing to look.
3. Queued encounters stay valid for **2 hours** (or until the end of the
   session) and are playable once you're `still`, in the classic or AR view
   with the original location's biome background.
4. Shiny or rare spawns use a different haptic pattern so you know to stop
   when it's safe.

Walking mode can opt in to the queue too ("hands-free walk").

## 4.4 Pocket mode

- Screen-off tracking: the foreground service (Android) or background location
  (iOS) keeps counting distance, hatching eggs and queueing encounters.
- Lock-screen widget / Live Activity (iOS) / persistent notification
  (Android): mode, distance, eggs progress, queued count.
- A **start/stop activity** button (like a fitness app) creates a session
  with a route map and summary: distance, elevation, catches, eggs hatched.

## 4.5 Kayak specifics

- Assume the phone is in a **dry bag or waterproof case**: large touch
  targets, a "glove mode", and everything usable with haptics + a quick glance.
- Fishing: when `still` on water, a cast/reel minigame uses the old / good /
  super rods (found or earned), which unlock better tables.
- Dive Ball bonus applies; water-surface AR placement.
- GPS on water is noisier, so it uses wider thresholds (doc 2.2).

## 4.6 Battery

- GPS sampling adapts: 1 Hz when moving fast, 0.2 Hz walking, significant-
  change only when `still` > 5 min.
- Map rendering pauses with the screen off; there's no network use outdoors
  except a weather refresh.
- AR only runs during an encounter.
- Goal: **< 8% battery per hour** in pocket mode on a modern phone.
  Measure it in field tests.

## 4.7 Safety & sanity rules

- No encounters in `vehicle` mode (a "passenger" toggle can allow them, for
  you as a passenger only).
- Thunderstorm warning from the weather feed.
- No spawns placed in obviously unsafe spots: highway cells (`highway=motorway/trunk`),
  railways, and water cells unless you're kayaking.
- A "time outside" stat, not a "time on screen" one.

## 4.8 Feel

- Classic main-series audio feel: route music per biome, battle music,
  evolution and level-up jingles (your personal copy).
- Retro-meets-modern UI: a pixel font for battle text, clean map UI.
- Day/night tinted map; weather particles.
