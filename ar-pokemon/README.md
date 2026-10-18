# AR Pokémon — Personal Project Plan

A private, single-player, augmented-reality Pokémon game that turns real outdoor
activity — walking, running, biking, hiking, kayaking — into a full main-series
Pokémon adventure. Personal use only; never distributed or sold.

> This folder lives in the ChurchApp repo temporarily. It is self-contained and
> will be moved into its own repository when development starts.

## Vision

- **The real world is the region.** Your neighborhood, local trails, lakes and
  rivers are the routes. What spawns depends on where you actually are: water
  types on the lake, bug types in the forest, rock types on the summit.
- **Your activity is the gameplay.** Distance hatches eggs, paddling unlocks
  fishing, long hikes reach "deep wilderness" rare spawns, and biking covers
  ground fast.
- **Full main-series mechanics.** IVs, EVs, natures, abilities, the 18-type
  chart, the real damage and catch formulas, evolution methods, breeding,
  shinies, gyms, badges and an Elite Four — not the simplified Pokémon GO model.
- **Works offline.** Trails and lakes rarely have signal, so spawning, battling
  and saving all run on the phone with no server.
- **Safe outdoors.** Nothing demands attention while you're pedaling or
  paddling; encounters queue up and you play them when you stop.

## Documents

| # | Doc | What it covers |
|---|-----|----------------|
| 1 | [Architecture](docs/01-architecture.md) | Tech stack, project layout, modules, data flow, storage |
| 2 | [World & Spawns](docs/02-world-and-spawns.md) | Biomes from map data, activity detection, the offline spawn algorithm, time/weather |
| 3 | [Game Mechanics](docs/03-game-mechanics.md) | Stats, battles, damage, catching, experience, evolution, breeding, shinies, progression |
| 4 | [AR, UX & Safety](docs/04-ar-ux-safety.md) | AR encounter view, screens, queued encounters, pocket mode, battery |
| 5 | [Roadmap](docs/05-roadmap.md) | Phased milestones with checklists, and open decisions |

## Guiding principles

1. **Engine first, AR last.** The battle/catch/stat engine is pure TypeScript
   with unit tests and can be built and verified on a laptop. AR is the final
   layer of polish on top of a game that already works.
2. **Data-driven.** Species, moves, items, abilities, learnsets and type charts
   are loaded from data files, never hard-coded.
3. **Deterministic.** Spawns, battle RNG and egg results come from seeded
   random number generators, so bugs are reproducible and the world is
   consistent offline.
4. **Field-test early.** Every phase ends with a real walk, ride, hike or paddle.
