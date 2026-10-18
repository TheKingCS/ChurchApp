# 3. Game Mechanics

Target: **modern main-series rules (Gen 7–9 formulas)**, singles battles first.
Bulbapedia is the reference for exact edge cases. Every formula below gets a
unit test with known values from the real games.

## 3.1 Pokémon generation

When a wild Pokémon or egg is created:

- **IVs:** 6 values, each 0–31, uniform random. Legendaries get 3 guaranteed 31s.
- **Nature:** 1 of 25. Raises one stat ×1.1 and lowers another ×0.9; five are neutral.
- **Ability:** slot 0 or 1 (50/50). Hidden ability: 1/150 in the wild, or via
  special "remote" spawns.
- **Gender:** from the species' gender ratio.
- **Moves:** the last 4 level-up moves learned at or below its level.
- **Shiny:** 1/4096. Shiny Charm (complete the Pokédex) = 3 rolls. Chaining
  the same species consecutively raises rolls (+1 per 10 in a chain, max +3),
  similar to catch combos.
- **Held item:** per-species 50%/5% wild item chances (from data).
- **Friendship:** species base (usually 50, 70 in modern games).

## 3.2 Stats

```
HP    = floor((2·Base + IV + floor(EV/4)) · Level / 100) + Level + 10
Other = floor((floor((2·Base + IV + floor(EV/4)) · Level / 100) + 5) · NatureMod)
```
(Shedinja's HP is always 1.)

**EVs:** max 252 per stat, 510 total. Gained from each defeated (or caught)
Pokémon's EV yield. Power items add +8; vitamins add +10; berries reduce.
*Outdoor twist (optional):* activity grants small bonus EVs to the lead
Pokémon — running → Speed, hiking elevation → Defense, kayaking → Attack —
capped by the normal limits.

## 3.3 Experience & levels

Growth rates (exp needed to reach level n):

| Rate | Formula |
|------|---------|
| Fast | 4n³/5 |
| Medium Fast | n³ |
| Medium Slow | 6n³/5 − 15n² + 100n − 140 |
| Slow | 5n³/4 |
| Erratic | piecewise (see Bulbapedia) |
| Fluctuating | piecewise (see Bulbapedia) |

Exp gained (Gen 7 scaled formula):
```
ΔExp = floor( (b · L / 5) · ((2L + 10) / (L + Lp + 10))^2.5 + 1 ) · t · e · v
```
`b` = base exp yield, `L` = defeated level, `Lp` = your Pokémon's level,
`t` = 1.5 if traded (n/a), `e` = 1.5 with Lucky Egg, `v` = 1.2 if past its
evolution level. **Exp Share** is always on: the whole party gets exp, with
non-participants at 50%. Catching awards exp, like modern games.

*Outdoor twist:* walking with a "buddy" Pokémon grants friendship (+1 per km,
plus a daily bonus) and a trickle of exp, so your hiking partner grows with you.

## 3.4 Battle system

### Turn order
1. Switching, then items, then running (fixed priority).
2. Moves by **priority bracket** (−7 to +5), then **Speed** (with stat stages,
   paralysis ×0.5, Tailwind ×2, Choice Scarf ×1.5, etc.), with a random
   tiebreak. Trick Room reverses Speed order.

### Damage
```
base   = floor( floor( floor(2·L/5 + 2) · Power · A/D ) / 50 ) + 2
damage = base × Targets × Weather × Critical × random(85..100)/100
              × STAB × Type × Burn × Other
```
- **Critical:** ×1.5. Chance by stage: 0 → 1/24, +1 → 1/8, +2 → 1/2, +3 → always.
  Crits ignore your negative attack stages and the target's positive defense stages.
- **STAB:** ×1.5 (×2 with Adaptability).
- **Type:** the product over defending types from the 18×18 chart (0, ¼, ½, 1, 2, 4).
- **Burn:** ×0.5 for physical moves (except Guts and Facade).
- **Weather:** rain boosts Water ×1.5 and weakens Fire ×0.5; sun is the reverse.
- **Other:** abilities, held items, screens (×0.5 singles), etc.

### Stat stages
−6 to +6. Multiplier is `max(2, 2+s) / max(2, 2−s)` for battle stats, and
`max(3, 3+s) / max(3, 3−s)` for accuracy/evasion.
Hit chance = `MoveAccuracy × AccStage(acc − eva)`.

### Status conditions
| Status | Effect |
|--------|--------|
| Burn | 1/16 max HP per turn; physical damage ×0.5 |
| Poison | 1/8 max HP per turn |
| Badly poisoned | n/16 per turn, increasing |
| Paralysis | Speed ×0.5; 25% chance of being unable to move |
| Sleep | 1–3 turns |
| Freeze | 20% thaw chance per turn; thawed by fire moves |
| Volatile | Confusion (33% self-hit, 2–5 turns), flinch, Leech Seed, trap, etc. |

Type immunities apply (Fire can't be burned, Electric can't be paralyzed, etc.).

### Moves, abilities & items
- **Moves are data + effect handlers.** Most moves are covered by generic
  fields (power, accuracy, type, category, priority, secondary effect chance,
  stat changes, status, recoil, drain, multi-hit). Unusual moves get named
  handlers in `battle/moves/special/*.ts`. Implement in waves: the common
  ~250 moves first, then the rest.
- **Abilities and items** use an event-hook system (`onModifyDamage`,
  `onSwitchIn`, `onResidual`, `onTryHit`, ...), the same architecture Showdown
  uses. Reading Showdown's `sim/` source is the best reference.
- **PP**, PP Ups and Struggle work normally.

### Battle types
- **Wild:** 1v1, can catch or run.
- **Trainer:** NPC trainers with a fixed team, can't run, prize money.
- **Gym / Elite Four / Champion:** scripted teams with held items and good AI.
- **Doubles:** phase 2+ (the engine is designed for it, with `Targets` ×0.75
  for spread moves).
- **Battle gimmicks** (Mega Evolution, Z-Moves, Dynamax, Terastal): off
  initially; Mega + Tera are the best candidates to add later.

### Running from a wild Pokémon
```
odds = floor(playerSpeed · 128 / wildSpeed) + 30 · attempts   (mod 256)
escape if rand(0..255) < odds, or always if playerSpeed ≥ wildSpeed
```

### AI
- **Wild:** random usable move.
- **Trainers:** score each move by expected damage × accuracy, plus a bonus
  for super-effective, KO-able or setup moves; switch when badly matched up.
- **Gym and above:** looks 1 turn ahead, uses held items, switches smartly.

## 3.5 Capturing

Modern (Gen 5+) catch formula:
```
a = ((3·HPmax − 2·HPcur) · CatchRate · BallBonus / (3·HPmax)) · StatusBonus
if a ≥ 255: caught
b = 65536 / (255 / a)^0.1875
four shake checks: each passes if rand(0..65535) < b; all four = caught
```
- **StatusBonus:** sleep/freeze 2.5; paralysis/poison/burn 1.5.
- **Balls:** Poké 1, Great 1.5, Ultra 2, Master always, Net 3.5 vs Water/Bug,
  Dive 3.5 **while kayaking**, Dusk 3 at night, Quick 5 on turn 1, Timer up to
  4, Repeat 3.5 if already caught, Nest scales with low level, Heal / Friend /
  Luxury special effects.
- **Critical capture:** chance scales with Pokédex count; only 1 shake check.
- **AR throw (optional skill bonus):** a well-timed or curved throw gives up to
  ×1.3 to `a`, which keeps the formula honest while rewarding AR play. It can
  be disabled for pure classic mode.

## 3.6 Evolution

Evolution rules are data, checked after level-up, item use, battles and
location/time changes:

| Method | Example | Real-world mapping |
|--------|---------|--------------------|
| Level | Charmander 16 | — |
| Level + time | Rockruff → Lycanroc forms | Real sunrise/sunset |
| Friendship (≥ 220) | Pichu, Eevee → Espeon/Umbreon | Buddy walking raises friendship |
| Item | Fire Stone | Found on hikes, sold at your Marts |
| Trade | Haunter, Machoke, Kadabra | **Linking Cord** item, found on long hikes |
| Location | Eevee → Leafeon/Glaceon, Magneton | Your own landmarks or biome (forest / snow / industrial) |
| Held item + level/trade | Scyther + Metal Coat | Linking Cord |
| Move known | Piloswine (Ancient Power) | — |
| Special | Galarian Farfetch'd (3 crits), Inkay (upside down) | Inkay: phone held upside down at level 30 😄 |
| Distance | — | *Optional:* some species need X km walked as buddy |

Evolution can be cancelled (B-button equivalent). Pokémon learn evolution moves.

## 3.7 Breeding & eggs

- **Day Care** is a place you create on the map. Leave 2 compatible Pokémon
  there (shared egg group, opposite genders, or Ditto).
- Egg chance accrues with **real distance moved while away**: one roll per km,
  50% for the same species and 20% for different species in a shared egg group
  (Oval Charm raises both).
- **Inheritance:** 3 IVs from parents (5 with Destiny Knot), nature from an
  Everstone holder, hidden ability passes from the mother/Ditto at 60%, egg
  moves, ball from the mother.
- **Hatching:** egg cycles × 257 steps → converted to **distance**
  (1 step ≈ 0.75 m, so a 20-cycle egg ≈ 3.85 km). Flame Body halves it.
  Distance counts in any mode except `vehicle`, so paddling and biking hatch
  eggs too.
- The Masuda method doesn't apply (single player, no foreign Pokémon), but
  Shiny Charm rolls apply to eggs, and Destiny Knot + Everstone breeding works
  as normal.

## 3.8 Items

Categories: Balls, Medicine (Potions, status heals, Revives, Elixirs), Battle
items (X items), Held items (Leftovers, Choice items, etc.), Evolution items,
TMs (reusable, modern style), Berries, Key items (rods, bike, Linking Cord,
Exp Share), Treasures (sellable).

**Getting items:**
- Daily stipend at your Pokémon Center / Mart places.
- **Hidden items** spawn along trails (deterministic, like spawns) — more on
  hikes, river items while kayaking.
- **Berry trees** at places you mark; they regrow over real days.
- Prize money from trainers.
- Distance milestones (every 5 km: a random useful item).

## 3.9 Progression

- **Trainer card:** money, Pokédex count, badges, total km by mode, play time.
- **8 Gyms** placed at real locations you choose, with escalating level caps
  (e.g., 14, 21, 27, 33, 40, 46, 52, 58). Each badge raises the wild level
  window and unlocks obedience for higher-level Pokémon.
- **Gym challenge requirements tied to activity** (optional but fun): the
  Water gym needs 10 km paddled first; the Rock gym requires reaching a summit;
  the Electric gym requires 50 km biked.
- **Trainers on routes:** NPC trainers spawn deterministically at trail
  junctions and park entrances (1–3 per km on hikes). They're beatable once
  per day.
- **Elite Four + Champion** after 8 badges, then rematches with higher levels.
- **Rival:** an NPC that appears every few gyms with a team that counters
  your starter.
- **Pokédex:** seen/caught counts, habitat entries record **where you
  actually found it** (map pin, activity, weather, time).
- **Starter choice** at first launch, from Gen 1–9 starters.
- **Post-game:** legendary sites, shiny hunting, competitive-grade breeding,
  Battle Tower-style challenge.
- **Medals:** distance per mode, elevation climbed, biomes visited, catches per
  type.

## 3.10 Box & party

- Party of 6, PC boxes (30 per box), sorting/searching, a summary screen with
  stats/IVs (via an "IV judge" unlocked after the Champion), moves, ribbons.
- Move Reminder, Move Deleter and Name Rater are menu services at your
  Pokémon Center places.
- Nicknames, release, held item management.
