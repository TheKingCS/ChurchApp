# 5. Roadmap

Each phase ends with a **field test** — a real walk, ride, hike or paddle.
Phases 1 and 2 can run in parallel.

## Phase 0 — Setup (a weekend)

- [ ] Create a new repo with the monorepo layout from doc 1 (pnpm workspaces).
- [ ] `packages/engine` with Vitest and a strict TS config.
- [ ] `tools/import-showdown`: generate `species.json`, `moves.json`,
      `abilities.json`, `items.json`, `learnsets.json`, `typechart.json`.
- [ ] Merge PokeAPI fields (catch rate, growth rate, base exp, egg data,
      evolution chains, habitats).
- [ ] Expo app with a dev client running on your own phone.

## Phase 1 — Map & encounters (field-testable MVP)

- [ ] Map screen (MapLibre + OSM tiles), position, follow mode.
- [ ] Movement tracker: GPS filtering, distance, speed, elevation.
- [ ] Activity detection (motion activity + speed + manual override).
- [ ] `tools/import-osm`: biome tile pack for your home region.
- [ ] Spawn generator: S2 cells, spawn points, 10-min buckets, seeded RNG.
- [ ] Auto-generated draft encounter tables for all biomes.
- [ ] Simple encounter screen: sprite + "Catch" with the real catch formula
      (no battle yet) + Poké Balls only.
- [ ] Save caught Pokémon to SQLite; simple box list.
- [ ] Background tracking + queued encounters.
- [ ] **Field test:** a walk, a bike ride and a paddle. Verify biomes match
      reality and spawn density feels right.

## Phase 2 — Engine core (laptop-only, test-driven)

- [ ] Seeded PRNG + hashing.
- [ ] Pokémon generation: IVs, nature, ability, gender, shiny, moves.
- [ ] Stat formulas, growth rates, exp formula.
- [ ] Type chart, damage formula, crits, STAB, stat stages, accuracy.
- [ ] Status conditions, weather, turn order and priority.
- [ ] First ~250 moves via generic fields + special handlers.
- [ ] Ability/item event hook system + the 60 most common abilities.
- [ ] Wild battle flow: fight, bag, switch, run, catch inside battle.
- [ ] Trainer AI (basic).
- [ ] **CLI harness:** `pnpm sim battle charizard:50 blastoise:50` and
      `pnpm sim hike --km 10 --biome forest` for quick balance checks.
- [ ] Unit tests reproducing known damage/catch values from the real games.

## Phase 3 — Real game loop

- [ ] Battle UI in the app wired to the engine.
- [ ] Party, box, summary, bag screens.
- [ ] Exp, level-up, move learning, evolution (all methods in doc 3.6).
- [ ] Items: medicine, balls (incl. Dive/Dusk/Net/Quick/Timer), evolution
      items, TMs.
- [ ] Places: Pokémon Center, Mart, Day Care, Landmarks.
- [ ] Hidden items, berry trees, prize money.
- [ ] Eggs and distance hatching; breeding with inheritance.
- [ ] Starter selection + onboarding.
- [ ] Save export/import + auto snapshots.
- [ ] **Field test:** a week of normal life playing it.

## Phase 4 — AR

- [ ] Level 1 camera overlay encounter.
- [ ] Throw mechanics with the ×1.3 cap.
- [ ] Level 2 plane-detected placement on ground and water.
- [ ] AR photo mode.
- [ ] **Field test:** catch on a trail, on the water, in town.

## Phase 5 — Progression

- [ ] 8 gyms at your chosen places, with leader teams and activity requirements.
- [ ] Route trainers spawning on trails/parks.
- [ ] Rival encounters.
- [ ] Elite Four + Champion + rematches.
- [ ] Legendary sites and their activity conditions.
- [ ] Medals, trainer card, journal with route maps.
- [ ] Fishing minigame and rods.
- [ ] Remaining moves/abilities/items until full coverage.

## Phase 6 — Polish & extras

- [ ] Music and sound by biome; evolution animation.
- [ ] Doubles battles.
- [ ] Mega Evolution and/or Terastal.
- [ ] Weather-driven battle conditions in the wild.
- [ ] Lock-screen widgets / Live Activities.
- [ ] Battery profiling and tuning to < 8%/hour.

## Open decisions

| Question | Recommendation |
|----------|----------------|
| Which Pokémon roster? | All 1,025, but launch with **Gen 1–4 (493)** to keep tables and testing manageable; add later gens by region "expansion". |
| Which mechanics generation? | Gen 7–9 formulas (as in doc 3). |
| Pokémon GO style throwing vs. classic battle-then-catch? | Classic battle-then-catch is the default; AR throw modifies the formula a little. |
| Obedience / level caps? | Yes, tied to badges. |
| Gimmicks (Mega/Z/Dynamax/Tera)? | Off at launch; Mega + Tera later. |
| Hardware | Your current phone. ARCore/ARKit support is required for Level 2 AR. |
| Map tiles offline | Self-hosted vector tiles for your region (Protomaps PMTiles file) — free and offline. |

## First concrete next step

Phase 0 + the Phase 2 engine skeleton: the data import script and stat/damage/
catch formulas with tests. No phone required, and everything else builds on it.
