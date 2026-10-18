# 1. Architecture

## Platform choice

A native mobile app is required. Web apps can't run location tracking in the
background on iOS, and iOS Safari has no WebXR AR support.

| Option | Pros | Cons |
|--------|------|------|
| **React Native (Expo, dev client) + TypeScript** ✅ | Reuses existing TS/React skills; one codebase for iOS/Android; good location, sensor, SQLite and map libraries | AR library ecosystem is thinner than Unity's |
| Unity + AR Foundation | Best-in-class 3D and AR | C#, different tooling, maps/background GPS are harder |
| Native Swift / Kotlin | Maximum control | Two codebases |

**Decision: Expo (with a custom dev client, not Expo Go) + TypeScript.** If AR
quality later becomes the bottleneck, the AR view alone can be swapped for a
Unity-as-a-library module without touching the engine.

### Key libraries

| Need | Library |
|------|---------|
| Foreground + background GPS | `expo-location` + `expo-task-manager` |
| Steps / pedometer | `expo-sensors` (`Pedometer`) |
| Activity recognition | Small native module wrapping iOS `CMMotionActivityManager` / Android Activity Recognition API |
| Barometric altitude | `expo-sensors` (`Barometer`) |
| Map with offline tiles | `@maplibre/maplibre-react-native` + OpenStreetMap vector tiles |
| AR | `@reactvision/react-viro` (ARKit / ARCore) |
| Local database | `expo-sqlite` (+ Drizzle ORM for typed queries) |
| Haptics / notifications | `expo-haptics`, `expo-notifications` |
| Weather | Open-Meteo API (free, no key), cached |
| State | Zustand |
| Tests | Vitest for the engine |

## Repository layout (monorepo)

```
ar-pokemon/
  apps/
    mobile/              Expo app (screens, map, AR, sensors)
  packages/
    engine/              Pure TS game engine — NO React, NO device APIs
      src/
        rng/             Seeded PRNG (xoshiro128**), hashing
        data/            Loaders/types for species, moves, items, abilities, types
        pokemon/         Creating Pokémon, stat calc, natures, IVs/EVs, experience
        battle/          Turn engine, damage, status, weather, AI
        capture/         Catch formula, ball modifiers
        evolution/       Evolution condition checks
        breeding/        Egg generation, inheritance, hatching
        progression/     Badges, trainers, level caps, Pokédex
    world/               Spawning, biomes, activity rules (pure TS, testable)
    data/                Generated JSON data + build scripts
  tools/
    import-showdown/     Script converting Pokémon Showdown data → our JSON
    import-osm/          Script pre-baking biome tiles for a region
  docs/                  These planning docs
```

`engine` and `world` have zero device dependencies, so the entire game can be
run and tested in Node, including a CLI "simulate a hike" harness.

## Runtime data flow

```
 GPS / pedometer / motion activity / barometer
                │
                ▼
     ┌───────────────────────┐
     │  Movement Tracker     │  filters GPS noise, computes distance,
     │  (apps/mobile)        │  speed, elevation gain, activity mode
     └──────────┬────────────┘
                ▼
     ┌───────────────────────┐   biome tiles (OSM, cached offline)
     │  World (packages/world)│◄── time of day, season, cached weather
     │  - biome lookup        │
     │  - spawn generator     │
     │  - encounter queue     │
     └──────────┬────────────┘
                ▼
     ┌───────────────────────┐
     │  Engine               │  battle, capture, exp, evolution,
     │  (packages/engine)    │  eggs, Pokédex
     └──────────┬────────────┘
                ▼
     ┌───────────────────────┐
     │  SQLite save + UI/AR  │
     └───────────────────────┘
```

## Data source

- **Pokémon Showdown** (`smogon/pokemon-showdown`, MIT-licensed code) has
  machine-readable species, base stats, abilities, moves, learnsets, items and
  the type chart for all generations. `tools/import-showdown` converts it to
  our own JSON schema once at build time.
- **PokeAPI** fills gaps Showdown doesn't cover: catch rates, base experience,
  growth rates, egg groups, egg cycles, base friendship, evolution chains,
  Pokédex flavor text, habitat.
- Data is generated into `packages/data/*.json` and bundled into the app; no
  network needed at runtime.

### Core data types (sketch)

```ts
type TypeName = 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock'
  | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

interface Species {
  id: number; name: string; types: [TypeName] | [TypeName, TypeName];
  baseStats: Stats; abilities: { 0: string; 1?: string; H?: string };
  catchRate: number; baseExp: number; growthRate: GrowthRate;
  evYield: Partial<Stats>; genderRatio: number | 'genderless';
  eggGroups: string[]; eggCycles: number; baseFriendship: number;
  evolutions: EvolutionRule[]; learnset: LearnsetEntry[];
  habitats: BiomeId[];          // ours — drives real-world spawning
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary';
}

interface PokemonInstance {
  uid: string; speciesId: number; nickname?: string; level: number; exp: number;
  nature: Nature; ability: string; gender: 'M' | 'F' | 'N'; shiny: boolean;
  ivs: Stats; evs: Stats; moves: { id: string; pp: number; ppUps: number }[];
  heldItem?: string; friendship: number; status?: StatusCondition;
  currentHp: number; ball: string;
  caughtAt: { lat: number; lon: number; biome: BiomeId; activity: ActivityMode; time: string };
}
```

## Storage

SQLite tables: `trainer`, `pokemon`, `party`, `box`, `inventory`, `pokedex`,
`eggs`, `badges`, `spawn_history` (prevents re-catching the same spawn),
`movement_log` (daily distance per activity), `places` (your gyms/landmarks).

**Backups:** export the full save as a JSON file to iCloud Drive / Google Drive
from the settings screen, plus an automatic weekly local snapshot. Losing a
save after a year of hiking would be painful.

## Randomness

- One PRNG implementation (xoshiro128**) seeded from a 32-bit hash.
- **World RNG:** seeded from `hash(worldSeed, cellId, timeBucket)` — fully
  deterministic (see doc 2).
- **Battle RNG:** seeded per battle and stored, so any battle can be replayed
  exactly for debugging.
