# 2. World & Spawns

## 2.1 Biomes from real map data

Every location resolves to one **primary biome** (plus optional modifiers)
using OpenStreetMap tags and elevation.

| Biome | OSM signals | Featured types |
|-------|-------------|----------------|
| `lake` | `natural=water` + `water=lake/pond/reservoir` | Water, Bug (surface), Flying |
| `river` | `waterway=river/stream`, `water=river` | Water, Dragon (rare), Ground (banks) |
| `ocean` / `coast` | `natural=coastline`, `natural=beach`, `place=sea` | Water, Rock, Flying |
| `wetland` | `natural=wetland`, `wetland=marsh/swamp` | Poison, Water, Bug, Grass |
| `forest` | `landuse=forest`, `natural=wood` | Bug, Grass, Normal, Fairy |
| `grassland` | `landuse=meadow/grass`, `natural=grassland/heath` | Normal, Grass, Bug, Electric |
| `farmland` | `landuse=farmland/orchard/vineyard` | Normal, Ground, Grass |
| `park` | `leisure=park/garden/nature_reserve` | Normal, Grass, Fairy, Bug |
| `mountain` | elevation > 1,000 m, `natural=peak/ridge/scree/bare_rock` | Rock, Ground, Fighting, Flying, Ice (high) |
| `cave` | `natural=cave_entrance`, tunnels | Rock, Ground, Ghost, Dark, Poison |
| `desert` | `natural=sand/desert`, arid climate | Ground, Rock, Fire |
| `snow` | `natural=glacier`, or snow season above elevation | Ice, Water |
| `urban` | `landuse=residential` | Normal, Poison, Flying |
| `industrial` | `landuse=industrial/commercial`, power lines | Electric, Steel, Poison |
| `sacred` | `amenity=place_of_worship`, `landuse=cemetery`, historic sites | Ghost, Psychic, Fairy |

**Modifiers** stack on the primary biome: `near_water` (within 50 m of water),
`high_elevation`, `trail` (on `highway=path/footway/track`), `remote` (more
than 2 km from the nearest road).

### Offline biome tiles

1. `tools/import-osm` downloads an OSM extract for your region (Geofabrik) and
   pre-computes a biome for every **S2 level-16 cell** (~150 m), stored as a
   compact SQLite tile pack bundled with or side-loaded into the app.
2. **Trip prep:** before heading somewhere new, open the map and tap
   "Download area", which fetches that region's biome cells over
   Overpass/Geofabrik while you have Wi-Fi.
3. Fallback when there's no data: biome = `grassland`, with water detected
   from map tiles if possible.

Elevation comes from GPS altitude, smoothed with the barometer. A terrain
dataset (e.g. AWS Terrain Tiles) is baked into the tile pack for
`high_elevation`.

## 2.2 Activity detection

| Mode | How it's detected | Gameplay effect |
|------|-------------------|-----------------|
| `walk` | OS motion activity = walking, 2–6.5 km/h | Baseline spawns, full distance credit |
| `run` | OS = running, 6.5–20 km/h | Spawn rate ×1.2, Fighting/Electric/Normal boost |
| `hike` | Walk/run on a `trail` cell, **or** > 50 m elevation gain per km | "Wilderness" table unlocked; rare rate ×1.5 after 5 km in one session |
| `bike` | OS = cycling, or 10–35 km/h with no automotive flag | Rolls per km ×0.5 (you cover more ground), Steel/Flying/Electric boost, encounters queue |
| `kayak` | Position inside a water polygon at 1–10 km/h (or manual toggle) | Water spawns, **fishing** with rods, river/lake exclusives, encounters queue |
| `vehicle` | OS = automotive, or > 35 km/h sustained | No spawns, no distance credit |
| `still` | < 1 km/h for 60 s | Queued encounters become playable; incense/lures work here |

A **manual mode picker** on the map overrides detection (e.g., you're paddling
somewhere the water polygon is missing).

### Distance & anti-noise

- Drop GPS fixes with accuracy worse than 25 m (50 m on water).
- Ignore jumps implying > 60 km/h unless the mode is `vehicle`.
- Kalman-smooth the track; take the larger of pedometer distance and smoothed
  GPS distance while walking/hiking, and GPS only while biking/kayaking.
- Distance is tracked per mode per day in `movement_log` for stats and medals.

## 2.3 The spawn algorithm (deterministic, offline)

Each S2 level-16 cell has **spawn points**: 0–4 fixed positions derived from
`hash(worldSeed, cellId)`, more in parks/forests and near water, fewer in
dense urban cells.

Time is divided into **10-minute buckets**. For each spawn point and bucket:

```
seed     = hash32(worldSeed, cellId, spawnPointIndex, bucket)
rng      = xoshiro(seed)
if rng.next() > spawnChance(biome, modifiers, timeOfDay, weather): no spawn
table    = encounterTable(biome, modifiers, activity, timeOfDay, season, weather)
species  = weightedPick(table, rng)
level    = levelFor(species, playerBadges, remoteness, rng)
shiny    = rng.int(4096) === 0            // see shiny rules in doc 3
ivs, nature, ability, gender = rolled from the same rng
```

Because everything derives from the seed, a spawn exists whether or not
you're looking at it. Close and reopen the app, and the same Pokémon is still
there. Catching or fleeing writes `(cellId, spawnPointIndex, bucket)` to
`spawn_history` so it won't reappear.

**Encounter radius:** spawn points within 40 m of your position, or 80 m while
biking/kayaking (GPS is less precise and you move faster).

### Encounter tables

Tables are authored as JSON per biome. Each entry has a species, a weight,
conditions and a level range:

```json
{
  "biome": "lake",
  "entries": [
    { "species": "magikarp", "weight": 40, "levels": [5, 20], "method": "fishing_old" },
    { "species": "psyduck",  "weight": 20, "levels": [10, 25] },
    { "species": "lapras",   "weight": 1,  "levels": [30, 40], "conditions": { "activity": ["kayak"], "remote": true } },
    { "species": "gyarados", "weight": 2,  "levels": [30, 40], "method": "fishing_super" }
  ]
}
```

Seed the tables from the species' `habitat` field (PokeAPI) and its types, then
hand-tune them. An auto-generator script produces a first draft of every table.

### Level scaling

Wild levels follow your progress: `base range` clamped to
`[badgeFloor, badgeCeiling + 5]`, where each badge raises the window. Remote
and `hike`-mode spawns get +3–8 levels. This keeps routes meaningful without
ever making a walk around the block pointless.

## 2.4 Time, season & weather

- **Time of day** uses your actual sunrise/sunset (computed locally from
  lat/lon): morning, day, evening, night. Night-only species (Hoothoot,
  Gastly, Umbreon via evolution) appear only after dark.
- **Seasons** follow the real calendar for your hemisphere, rotating some
  spawns (e.g., Ice types more common in winter, Deerling forms).
- **Weather** comes from Open-Meteo, cached for 3 hours (offline uses the
  last cache, or "clear"). It maps to game weather and spawn boosts:

| Real weather | Spawn boost | In battle |
|--------------|-------------|-----------|
| Clear / sunny | Fire, Grass, Ground | Harsh sunlight (optional toggle) |
| Rain | Water, Electric, Bug | Rain |
| Snow | Ice, Steel | Snow |
| Fog | Ghost, Dark | — |
| Wind > 30 km/h | Dragon, Flying, Psychic | — |
| Thunderstorm | Electric | Rain (and a safety warning) |

## 2.5 Points of interest (your own)

There's no global POI database. **You create places** by long-pressing the map:

- **PokéMart / Pokémon Center:** restock items and heal (e.g., your house, a
  trailhead, a favorite coffee shop). Daily item stipend on visit.
- **Gym:** pick 8 meaningful places (a summit, a lake, a long trail's end).
  Each is assigned a type and leader team (see doc 3).
- **Landmark:** special evolution locations (Moss Rock → Leafeon near forest,
  Ice Rock → Glaceon near snow, magnetic field → Magnezone near industrial).
- **Legendary sites:** endgame spawns that need a specific activity and
  distance (e.g., reach the summit on a hike of 10+ km to encounter a bird
  legendary; Kyogre only while kayaking open water in the rain).
