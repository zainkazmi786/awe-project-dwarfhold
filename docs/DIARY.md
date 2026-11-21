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
