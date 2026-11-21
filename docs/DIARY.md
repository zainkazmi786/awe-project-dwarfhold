# Development Diary

## 2026-11-20 — D1: Colony work and survival

### Problem
- `advanceDay` produced for every dwarf with an `assignment`, even while on an expedition, so one dwarf did two activities.
- Food was reduced by `dwarves.length` and clamped with `Math.max(0, …)`, so a shortage was silent and had no consequence.
- `assignDwarf` could change a travelling dwarf's job and set their status to `"working"` while away.

### Decisions
| Decision | Choice | Reason |
|---|---|---|
| Shortage consequence | An unfed dwarf is `hungry` and produces nothing the next day | Affects gameplay, easy to explain, deterministic |
| Meal time | End of day, after production | Food farmed today can feed dwarves today |
| Feeding order | Roster order | Deterministic: same state gives the same result |
| Recovery | A hungry dwarf who is fed again becomes `hungry: false` | No permanent penalty |


### Day order (`advanceDay`)
1. **Production:** only dwarves where `isProducing` is true (`status === "working"`, an assignment, `!hungry`).
2. **Meals:** `feedDwarves` gives 1 food per present dwarf in roster order. Anyone left unfed becomes hungry. Food stays ≥ 0.
3. `day + 1`.

### Interface changes
- `src/types.ts`: `Dwarf.hungry: boolean` added (required).

### Code changes
| File | Change |
|---|---|
| `src/simulation.ts` | New `isProducing(dwarf)`, `eatsColonyFood(dwarf)` and `feedDwarves(dwarves, food)`. `advanceDay` uses them and also returns the updated `dwarves`. |
| `src/state/ColonyProvider.tsx` | `hungry: false` added to the starting dwarves. `assignDwarf` ignores dwarves on an expedition. A `useEffect` on `colony.day` logs a Chronicle warning naming the hungry dwarves. |
| `src/components/DwarfRoster.tsx` | A "🍽️ hungry" badge with a tooltip on a hungry dwarf's card. The job select was already disabled while away. |
| `src/pages/ColonyPage.tsx` | The Daily Production forecast now uses the same rules (`isProducing`, `eatsColonyFood`). A rule text is shown under "Net food after meals". |
| `src/styles.css` | `.status .hungry` and `.food-rule` styles. |
| `src/simulation.test.ts` | Tests extended from 1 to 9. |


### Tests (`npm test`, 9/9 passing)
- normal production and eating
- expedition dwarf: no production, no colony food eaten
- idle dwarf: no production
- hungry dwarf: no production
- roster-order feeding (2 food, 3 dwarves gives `[fed, fed, hungry]`)
- food never negative
- a farmer's food from today feeds them today
- a hungry dwarf recovers when fed
- determinism (same input gives the same output)

### Known limitations / follow-ups
- Hunger applies with a one-day delay: hungry at the end of day N means no production on day N+1. This is shown in the UI text.
- `craftTool` can still make stone negative. To be fixed in D2/D3.
- Some Chronicle entries still skip `.slice(0, 6)`.

## 2026-11-21 — D2: Tools, weapons and equipment

### Decisions
| Decision | Choice |
|---|---|
| Tool bonus | +1 of the assigned resource for all three jobs, only while `isProducing` (working, assigned, not hungry) |
| Equip / return | Any dwarf at home without a tool, if storage has ≥ 1. A travelling dwarf can't equip or return. |
| `tools` counter | Counts tools in storage only. Equipped tools are shown on the dwarf card. |
| Weapon recipe | 3 wood + 3 stone → 1 weapon, stored as a colony resource (`weapons`) |

### Code changes
- `src/types.ts`: `weapons` in `Resources`, `hasTool` on `Dwarf`, new `Recipe` type.
- `src/simulation.ts`: `dailyOutput` (production + tool bonus, used by `advanceDay` and the forecast), pure `equipTool`, `returnTool`, `canAfford`, `craft` with a `recipes` table. `craft` checks all materials, so stone can no longer go negative.
- `src/state/ColonyProvider.tsx`: `craftTool` replaced by `craft(recipe)`, new `equipTool` / `returnTool` actions, `addActivity` helper (always keeps 6 entries).
- UI: Equip / Return button and "⚒️ equipped" badge in `DwarfRoster.tsx`, weapons in `ResourceBar.tsx`, two recipes on `ForgePage.tsx`.

### Tests (`npm test`, 16/16 passing)
- tool bonus +1 (wood 3 → 4, stone 2 → 3), no bonus when hungry or unassigned
- equip / return moves the tool between storage and dwarf; second tool, empty storage and travelling dwarf are refused
- total tools (storage + equipped) stays constant
- weapon costs 3 wood + 3 stone; missing materials change nothing

## 2026-11-21 — D3: Crafting as colony work

### Decisions
| Decision | Choice |
|---|---|
| Who can craft | A dwarf assigned to the new job `smithing` (Ember Forge), at home, not hungry, with no open order |
| Duration | Tool 2 days, weapon 3 days (`recipes[...].days`). Started on day N → item in storage on day N + days |
| Payment | Full cost paid at the start. Invalid attempt (no free smith or missing materials) changes nothing and logs a warning |
| While crafting | Smith produces no resources, can't be reassigned or sent on an expedition |
| Cancel | Full refund, smith is free again |

### Code changes
- `src/types.ts`: job `smithing`, new `CraftJob { dwarfId, recipe, readyDay }`, `ColonyState.crafting`.
- `src/simulation.ts`: instant `craft` replaced by pure `canCraft`, `startCraft`, `cancelCraft`. `advanceDay` moves finished orders into storage (step 3).
- `src/state/ColonyProvider.tsx`: `startCraft` / `cancelCraft` actions with warnings; reassigning and expeditions are blocked for a busy smith; a day-change effect logs "finished forging".
- UI: "Forging now" panel on `ForgePage.tsx` (smith, item, "ready on day X", Cancel, smith select with free smiths only), "🔥 tool · day X" badge and locked job select in `DwarfRoster.tsx`.

### Tests (`npm test`, 21/21 passing)
- tool: cost paid at start, nothing on day 2, tool in storage on day 3
- weapon arrives after exactly 3 days
- non-smith, hungry, travelling, unknown and busy dwarves are refused with unchanged state
- cancel restores resources exactly; a working smith with a tool produces nothing

## 2026-11-21 — D4: Resilient expeditions

### Decisions
| Decision | Choice |
|---|---|
| Who can leave | A dwarf at home, not hungry and not forging (`canExplore`). Others are disabled in the Scout dropdown |
| Equipped tool | Stays with the travelling dwarf. No bonus while away, still equipped on return |
| Double send | Refused in code by a `useRef` flag (works before React re-renders), plus the disabled button |
| Failed request | No rewards, dwarf goes back to `working`/`idle`, warning in the chronicle |
| Result message | Stamped with the day the answer arrives, not the departure day |

### Code changes
- `src/simulation.ts`: pure `canExplore`, `departExpedition`, `returnFromExpedition`. Return only works if the dwarf is away, so rewards are applied once.
- `src/state/ColonyProvider.tsx`: `sendExpedition` rewritten with eligibility check, `inFlight` ref, `catch` that brings the dwarf home and `finally` that clears the pending flag. `addActivity` uses a `today` ref for the current day.
- `src/pages/ColonyPage.tsx`: ineligible dwarves are disabled in the Scout dropdown, and the rule text was updated.

### Tests (`npm test`, 25/25 passing)
- away, hungry, forging and unknown dwarves are refused with unchanged state
- rewards applied once; a second return changes nothing
- failed trip: resources unchanged, dwarf idle again
- one day away: no production, no food eaten, tool kept after return
- Manual check (Playwright, 10 s delayed response): double click sent 1 request; result logged on day 13; Blocked Pass brought Dori back

## 2026-11-21 — D5: Save and restore

### Decisions
| Decision | Choice | Reason |
|---|---|---|
| Storage | `localStorage`, key `dwarfhold-save` | Built in, synchronous, the state is small JSON |
| Format | `{ version: 1, colony, activities }` | `version` detects incompatible saves |
| What is saved | `colony` (day, resources, dwarves, crafting) and the Chronicle | `paused` is not saved, so the game always starts running |
| When | After every change of `colony` or `activities` (`useEffect`) | Nothing meaningful is lost on refresh |
| Corrupt / incompatible save | Start a new colony and log a warning | Safe fallback, visible to the player |
| Expedition interrupted by refresh | **Resume:** the request is sent again for the same destination. The dwarf stays away until the result arrives. | The player doesn't lose the trip. Rewards are still applied once (`returnFromExpedition` ignores a dwarf who isn't away). |
| Forge order interrupted by refresh | **Continue:** the order is saved and finishes on its `readyDay` | Orders are day-based, so `advanceDay` already handles them |

### Interface changes
- `src/types.ts`: `Dwarf.destination?: string`, set while on an expedition.
- `departExpedition(state, id, destination)`: new required `destination` parameter.

### Code changes
| File | Change |
|---|---|
| `src/state/persistence.ts` (new) | `parseSave(raw)` is pure and validates the JSON, the version and every field. Results are `ok`, `empty`, or `invalid` with `corrupt` / `incompatible`. Also `serializeSave`, plus `loadSave` and `writeSave`, which wrap `localStorage` in try/catch. |
| `src/simulation.ts` | `departExpedition` stores `destination`. `returnFromExpedition` clears it. |
| `src/state/ColonyProvider.tsx` | `boot()` loads the save via the `useState` initializer and builds the Chronicle notes ("Colony restored", "Forge order resumed", "expedition resumed", or the fallback warning). A save effect runs on every change. The trip logic is split into `runTrip()`, and `sendExpedition` is now checks, then departure, then `runTrip`. A mount effect resumes a saved trip by calling `runTrip` only (no second departure); `inFlight` blocks StrictMode's double run. The hunger message is skipped on mount so a refresh doesn't repeat it. |
| `src/pages/ColonyPage.tsx`, `src/pages/ForgePage.tsx` | Hint texts explaining the refresh policy. |
| `src/simulation.test.ts` | Expedition tests pass a destination. 7 D5 tests added. |

### Validation rules (`parseSave`)
- `day` is a finite number.
- Every resource key exists and is a number ≥ 0.
- Each dwarf has the correct field types, plus a valid `assignment`, `status` and optional `destination`.
- Each forge order refers to an existing dwarf, a known recipe and a numeric `readyDay`.
- Each Chronicle entry has the correct field types.

### Tests (`npm test`, 32/32 passing)
- destination is stored on departure and cleared on return
- a saved colony is restored exactly (forge order and traveller included)
- a restored forge order finishes on its ready day
- missing save gives `empty`
- broken JSON gives `corrupt`
- wrong version gives `incompatible`
- wrong shapes (string day, negative stone, unknown status, order for an unknown dwarf) give `corrupt`

### Known limitations / follow-ups
- A dwarf saved as away **without** a destination is not handled (deliberately left out for now). They would stay away.
- Days only pass while the tab is open; there is no offline progress. A partly elapsed day (< 8 s) restarts after a refresh.
- No "New colony" button. To reset, clear `dwarfhold-save` in the browser's devtools.

## 2026-11-21 — D6: A new species joins Stonehome

### Decisions
| Decision | Choice | Reason |
|---|---|---|
| Species | **Working Student** (`"working-student"`), icon 🎓, joins as *Mira Nightshift* | Team choice. Story: always exhausted. |
| Recruit destination | **The University** (`university`) | Chosen by the team. The UI shows a rumour hint when it's selected. |
| Who decides recruitment | **Both.** The client chooses the university; the server returns `recruit` (species, name, title). The client adds the character only if `recruited === false`. | The server is stateless, so "only once" must be guarded where the state is saved (client, D5). |
| Appetite | **2 rations** per day ("always exhausted") | Gameplay difference: costs more food |
| Partial food | All-or-nothing: with fewer than 2 rations left the student eats nothing, goes hungry, and the food stays for the next in line | Deterministic, no negative food |
| Production | Wood **+2**, Stone **+1**, Food **+5** (dwarf: 3 / 2 / 4) | Too tired for heavy labour, but a part-time canteen-garden job makes them the best farmer. Net food when farming is +3, the same as a dwarf. |
| Crafting ability | Forges **tools in 1 day** (dwarf: 2) | Engineering lectures |
| Crafting limitation | **Cannot forge weapons** | No time (or will) for weapons |
| Tools | Can equip one; the +1 bonus applies | Same rules as everyone (D2 requirement) |
| Expeditions | Can go | Same rules as everyone |
| Starting state | Idle, unassigned, fed, no tool | Player decides the job |
| Old saves (v1) | `SAVE_VERSION` 1 → 2; v1 saves are "incompatible" and start a new colony | Simpler than a migration |
| Rename `Dwarf` → `Character` | Not done | Large mechanical change with no gameplay value; `species` on `Dwarf` is enough |

### Interface changes (`src/types.ts`)
- `Species = "dwarf" | "working-student"`
- `Dwarf.species: Species`
- `ColonyState.recruited: boolean`
- `ExpeditionResult.recruit?: Recruit` and the new `Recruit { species, name, title }`

### Code changes
| File | Change |
|---|---|
| `src/simulation.ts` | New `SpeciesTraits` and the `speciesTraits` table (label, icon, appetite, production, craftable, craftDays, summary). `production` is now `speciesTraits.dwarf.production`. `feedDwarves` uses appetite with all-or-nothing. `dailyOutput` uses the species table. New `canForge(state, id, recipe)` and `craftDaysFor(dwarf, recipe)`. `startCraft` checks `canForge` and uses the species days. New `createRecruit()`. `returnFromExpedition(..., recruit?)` adds the recruit in the same update, only if `!recruited` and the species is known. |
| `server/index.js` | New `university` outcome: `{ food: 2 }` plus `recruit` |
| `src/state/ColonyProvider.tsx` | `species: "dwarf"` and `recruited: false` in `initialState`. `runTrip` passes `result.recruit`. An effect announces "… joined Stonehome!" once, when `recruited` flips to true, starting from the loaded value so it doesn't repeat after a refresh. `beginCraft` warns when the species can't forge the recipe and shows the species craft time. |
| `src/state/persistence.ts` | `SAVE_VERSION = 2`. Validates `species` and `recruited`. |
| `src/components/DwarfRoster.tsx` | Species badge, blue portrait (`species-working-student`), and a traits line on every card |
| `src/pages/ColonyPage.tsx` | "The University 🎓" option with a rumour or "already joined" hint. Job cards show 🎓 numbers after recruitment. The food forecast sums appetites. Updated meal rule text. |
| `src/pages/ForgePage.tsx` | Days label per selected smith. A recipe the smith can't make is greyed out and disabled, with the reason shown. Updated rule text. |
| `src/styles.css` | Badge, portrait, traits, hint and locked recipe styles |
| `docs/API.md` | `university` response documented |
| `src/simulation.test.ts` | Helpers get `species` and `recruited`. 12 D6 tests added. |

### Tests (`npm test`, 44/44 passing)
- joins after a successful university trip (idle, fed, no tool, 🎓)
- joins only once (second university trip adds nobody)
- no join on a failed trip
- unknown species from the server is ignored
- eats 2; with only 1 left eats nothing, goes hungry and leaves the ration for the next dwarf
- production 2 / 1 / 5, tool bonus +1
- tool ready after 1 day
- weapon refused with unchanged state
- can go on expeditions
- saved and restored with the student
- v1 save gives `incompatible`
- Manual server check: `POST /api/expeditions {destination:"university"}` returns `recruit`. With `?fail=true` it returns 503 and no recruit.

### Known limitations
- Not clicked through in the browser yet.
- The recruit's id is fixed (`working-student-1`). That's fine because they join only once.
- Job cards on the Colony page show only dwarf and student numbers. A third species would need a generic list.

## 2026-11-21 — D7: Goblin raid

### Decisions
| Decision | Choice |
|---|---|
| Destination | **Goblin Warrens** (+6 stone). A successful trip brings an attack force of 6 goblins (server `attack.force`) |
| Defense | Each attacker breaks 1 weapon (weapons are **consumed**). Weapons ≥ force → defended |
| Loot | Attackers left over take 1 item each: tools in storage → stone → wood → food. Equipped tools are safe |
| Destroyed | Lost raid that leaves tools, stone, wood and food at 0 → game over: days stop, "Found a new colony" resets |
| Order | Rewards are added first, so the raid can take them |

### Code changes
- `server/index.js`: `goblin-warrens` outcome with `attack: { force }` (`ATTACK_FORCE` env var for demos).
- `src/simulation.ts`: pure `resolveAttack` + `LOOT_ORDER`, called at the end of `returnFromExpedition` only when the server sent `attack` (the `catch` path never does). `advanceDay` stops when `destroyed`.
- `src/types.ts` / `persistence.ts`: `AttackReport`, `lastAttack`, `destroyed`; `SAVE_VERSION` 3 validates both.
- UI: raid warning on the destination, "Goblin raid" panel on `ColonyPage.tsx`, Chronicle entry (logged once via a ref), "Stonehome has fallen" screen in `Layout.tsx`.

### Tests (`npm test`, 52/52 passing)
- weapons > force and weapons = force: defended, weapons reduced by the force
- 2 weapons vs 6: exact loot order (tools 1, stone 2, wood 1, food untouched)
- everything at 0: `destroyed`, `advanceDay` returns the same state
- rewards before the raid; equipped tools kept; failed or second return never attacks
- raid report survives save/restore, a broken report is rejected
