# Dwarfhold — Implementation Plan

This plan covers requirements D1–D7 from `REQUIREMENTS.md`: what each one means, an example, the code and interface changes, and the decisions the team must make.

> Names and shapes below are proposals. Anything marked **Decision** is ours to choose, but we must document it and defend it in the exam.

---

## 0. Current state (baseline)

| Area | Where | Notes |
|---|---|---|
| All game state | `src/state/ColonyProvider.tsx` (`useState`) | In memory only. Lost on refresh. |
| Day tick (every 8 s) | `src/state/ColonyProvider.tsx:62` | Calls `advanceDay` |
| Daily simulation | `src/simulation.ts` (`advanceDay`, `production`) | Pure function |
| Assign job | `assignDwarf` in provider | No availability check |
| Craft tool | `craftTool` in provider | Instant. Never checks stone. |
| Expedition | `sendExpedition` in provider, then `src/api.ts`, then `server/index.js` | No guard against repeats |
| Types | `src/types.ts` | |
| Context API | `src/state/ColonyContext.ts` | |

**Bugs in the current code that these requirements expose:**
1. A dwarf on an expedition still produces from their job: `advanceDay` checks `assignment`, not `status`. (D1, D4)
2. `Math.max(0, food - n)` silently hides food shortages. (D1)
3. `craftTool` can make stone negative. (D2, D3)
4. Some activity entries skip `.slice(0, 6)`, so the log can grow without limit.
5. Tools are just a number. They have no owner and no effect. (D2)

---

## 1. Shared interfaces (agree on these first)

Both team members build on these, so commit them before splitting the work.

### `src/types.ts` (proposed)

```ts
export type ResourceKey = "wood" | "stone" | "food" | "tools" | "weapons";
export interface Resources {
  wood: number; stone: number; food: number;
  tools: number;     // tools in STORAGE (not equipped)
  weapons: number;   // D2
}

export type JobType = "woodcutting" | "mining" | "farming" | null;
export type CharacterStatus = "idle" | "working" | "expedition" | "crafting";
export type Species = "dwarf" | "<new-species>";           // D6

export interface Character {          // was: Dwarf
  id: string; name: string; title: string; icon: string;
  species: Species;                   // D6
  assignment: JobType;
  status: CharacterStatus;
  specialty?: Exclude<JobType, null>;
  hasTool: boolean;                   // D2
  hungry: boolean;                    // D1
}

export type Recipe = "tool" | "weapon";
export interface CraftingTask {       // D3
  id: string;
  characterId: string;
  recipe: Recipe;
  completesOnDay: number;
}

export interface ActiveExpedition {   // D4
  requestId: string;
  characterId: string;
  destination: string;
  startedOnDay: number;
}

export interface ColonyState {
  version: number;                    // D5
  day: number;
  resources: Resources;
  characters: Character[];            // was: dwarves
  craftingTasks: CraftingTask[];      // D3
  activeExpedition: ActiveExpedition | null; // D4
  completedExpeditions: string[];     // D6, D7
  newSpeciesJoined: boolean;          // D6
  activities: Activity[];             // moved here so it can be saved (D5)
}

export interface ExpeditionResult {
  expeditionId: string;
  status: "completed";
  rewards: Partial<Resources>;
  message: string;
  event?: "recruit" | "attack";       // D6, D7
}

export interface Activity {
  id: string; day: number; message: string;
  tone?: "good" | "warning" | "danger";
}
```

### `ColonyContextValue` (proposed)

```ts
interface ColonyContextValue {
  colony: ColonyState;
  paused: boolean;
  expeditionPending: boolean;
  togglePaused(): void;
  assignCharacter(id: string, job: JobType): void;            // D1
  equipTool(id: string): void;                                // D2
  returnTool(id: string): void;                               // D2
  startCrafting(id: string, recipe: Recipe): void;            // D3 (replaces craftTool)
  sendExpedition(id: string, destination: string): Promise<void>; // D4
  resetColony(): void;                                        // D5
}
```

### Architecture suggestion
Keep game rules in **pure functions** in `src/simulation.ts`, for example `advanceDay`, `canCraft`, `applyExpeditionResult` and `resolveAttack`. The provider only calls them and stores the result. This makes every rule unit-testable in `src/simulation.test.ts` and makes "deterministic" easy to prove.

---

## D1 — Colony work and survival (15%)

**Meaning:** each day is one consistent step covering who is assigned, who is available, what is produced and how much food is eaten. A character does at most one activity, and a food shortage has a visible effect.

**Example (current bug):** Bromli mines, then leaves for the Crystal Cave. During travel, each tick still gives +2 stone. On return the expedition gives +8 stone as well. One dwarf has done two activities.

**Example (food):** 18 food, 3 dwarves, nobody farming. Food goes 15, 12, 9, 6, 3, 0, then stays at 0 forever with no consequence. That is invalid.

**Example (after the fix, using the "hungry don't work" rule):** food is 2 and there are 3 workers. Bromli and Yrsa eat (in roster order). Dori goes hungry, produces nothing and is marked 🍽️ in the roster. The Chronicle says *"Not enough food — Dori went hungry and did not work."*

**Code changes**
- `src/simulation.ts` `advanceDay`:
  - A character produces only if `status === "working"`.
  - Feed characters in a fixed order. Anyone who can't be fed gets `hungry = true` and produces nothing.
  - Food never goes below 0, and the shortfall becomes the consequence.
  - Return the activity messages as well, e.g. `{ state, events }`.
- Provider `assignCharacter`: refuse if the status is `expedition` or `crafting`.
- `DwarfRoster.tsx`: show the hungry state and disable the job select for busy characters.
- UI text explaining the rule, e.g. a tooltip or help line near the food counter.

**Decisions**
- [ ] The shortage consequence. Options: *hungry characters don't produce* (recommended), lose morale, or a character leaves.
- [ ] Feeding order: roster order, farmers first, and so on. It must be deterministic.
- [ ] Do characters eat before or after production in a day?
- [ ] Do travelling characters eat colony food?

---

## D2 — Tools, weapons and equipment (20%)

**Meaning:** a tool can be equipped to one character and gives +1 of their assigned resource per day. There is one tool per character and one owner per tool. Weapons are a colony resource used against attacks (D7).

**Example:** storage has 2 tools. Yrsa (woodcutting) equips one, so storage tools go 2 → 1, Yrsa's card shows 🪓, and her daily wood goes 3 → 4. Yrsa returns it, so storage goes 1 → 2 and her production drops back to 3. Trying to equip a second tool to Yrsa is refused.

**Code changes**
- `types.ts`: add `weapons` to `Resources` and `hasTool` to `Character`.
- `simulation.ts`: `production + (hasTool ? 1 : 0)` for a compatible local job only.
- Provider:
  - `equipTool(id)` requires `tools > 0 && !hasTool`, then does `tools - 1` and sets `hasTool = true`.
  - `returnTool(id)` does the reverse.
- `DwarfRoster.tsx`: Equip and Return buttons, plus a tool owner indicator.
- `ResourceBar.tsx`: show weapons.
- `ForgePage.tsx`: a weapon recipe with its cost shown.
- **Invariant to test:** `storage tools + characters with a tool` stays constant except when crafting.

**Decisions**
- [ ] Weapon recipe cost, e.g. 2 wood + 4 stone.
- [ ] Which jobs count as "compatible local jobs". All three, or exclude farming?
- [ ] Does a tool give a bonus while the job is unassigned or the character is hungry? (Probably no.)

---

## D3 — Crafting as colony work (10%)

**Meaning:** crafting needs materials, an eligible character and time. An invalid attempt changes nothing. The UI shows who is crafting and when it finishes.

**Example:** on day 14, Dori (idle) starts a tool, which costs 3 wood + 2 stone and takes 2 days. Wood goes 14 → 11, stone goes 9 → 7, and Dori's status becomes `crafting`. The Forge shows *"Dori — Tool — ready day 16"*. On day 16 tools +1 and Dori returns to idle or working. If there's only 2 wood, the attempt shows a warning and **nothing changes**: Dori stays idle and the resources stay the same.

**Code changes**
- `types.ts`: `CraftingTask` and the `crafting` status.
- `simulation.ts`:
  - `canCraft(state, id, recipe)` returns ok or a reason.
  - `advanceDay` completes tasks where `completesOnDay <= day`.
- Provider: `startCrafting` validates first, then deducts materials, sets the status and adds the task, all in one `setColony`. It replaces `craftTool`.
- `ForgePage.tsx`: a character picker, a recipe picker and a list of active tasks with finish days.

**Decisions**
- [ ] When materials are deducted: at start (recommended) or at completion.
- [ ] Craft durations for tool and weapon.
- [ ] Who is eligible: only idle characters, or working ones too (who would then stop their job)?
- [ ] Can a crafting task be cancelled? If so, are the materials refunded?
- [ ] Does pausing the game pause crafting? (It does if crafting is counted in days.)

---

## D4 — Resilient expeditions (10%)

**Meaning:** the traveller is unavailable during the expedition. The reward is applied exactly once. A failure gives no reward and frees the character. Slow or double clicks can't create a contradictory state.

**Example:** you send Yrsa to the Old Mine and double-click Send. Only one request goes out, and the button is disabled while `activeExpedition !== null`. The server takes 2 s. On success, stone +12 and wood +2, **once**. With Blocked Pass you get a 503, no rewards, Yrsa back to her previous status, and a warning in the Chronicle.

**Code changes**
- Provider `sendExpedition`:
  - Refuse if `activeExpedition` exists or the character isn't eligible.
  - Store `activeExpedition` with a `requestId`.
  - On response, apply rewards only if `activeExpedition.requestId` still matches, then clear it.
  - Use a `finally` block to always free the character.
  - Use the functional `setColony(current => ...)` form only. Never read a stale `colony` after `await`.
- `simulation.ts`: a pure `applyExpeditionResult(state, requestId, result)`.
- `ColonyPage.tsx`: list only eligible characters, disable the button while pending, show who is away and where.
- Tool handling per the decision below.

**Decisions**
- [ ] **Required:** does an equipped tool travel with the dwarf or get returned before departure?
- [ ] Who is eligible: only idle characters, or working ones who leave their job? Do they get their job back afterwards?
- [ ] Is only one expedition allowed at a time, or one per character?

---

## D5 — Save and restore (10%)

**Meaning:** refreshing the browser restores the meaningful state. Corrupt or incompatible data falls back safely. There is a visible policy for interrupted expeditions and forge tasks.

**Example:** on day 20 with 30 stone and Dori crafting, you refresh. You come back to day 20, 30 stone and Dori still crafting. If `localStorage` holds `"{garbage"` or `version: 0`, the game starts fresh with the message *"Saved colony was unreadable — a new colony was founded."* If Yrsa was on an expedition during the refresh, she returns empty-handed and the Chronicle says so (example policy).

**Code changes**
- New `src/state/persistence.ts`:
  - `saveColony(state)`
  - `loadColony(): ColonyState | null`, which wraps `JSON.parse` in try/catch and validates `version` and the shape.
- Provider:
  - `useState(() => loadColony() ?? initialState)`.
  - A `useEffect` that saves on every change.
  - `resetColony()`.
- Interrupted expedition handling on load, e.g. clear `activeExpedition` and free the character.
- Show the "restored" or "fallback" message.
- Tests for corrupt JSON, the wrong version and missing fields.

**Decisions**
- [ ] Policy for an **expedition** interrupted by refresh: cancel with no reward (simplest and safe) or retry.
- [ ] Policy for a **forge task** interrupted by refresh: keep the task (it's day-based, so it survives naturally) or cancel and refund.
- [ ] What gets saved: is `paused` saved? Is the activity log saved?
- [ ] How strict validation is: a full shape check or just the `version` plus key fields.
- [ ] Storage key name and version number.

---

## D6 — A new species joins Stonehome (20%)

**Meaning:** after the first successful expedition to a chosen destination, a non-dwarf character joins, once. The character must look and play differently, with their own production and their own crafting ability or limitation. The character follows all the colony rules: availability, food, equipment, tasks and saving.

**Example (illustrative):** the first success at the Crystal Cave brings *Pip, a Gnome Tinkerer* 🧝. Pip appears with a distinct badge. Pip farms +5 food but mines only +1 stone. Pip crafts tools in 1 day instead of 2 but **cannot** forge weapons. Pip eats 1 food like everyone else, can equip a tool and is saved with the colony. A second success at the Crystal Cave adds nobody.

**Code changes**
- `types.ts`: a `Species` field on `Character` and `newSpeciesJoined`.
- Rename `Dwarf` to `Character` everywhere. It's a big but mechanical change, so do it early.
- `simulation.ts`:
  - Per-species production, e.g. `production[species][job]`.
  - Per-species crafting rules inside `canCraft`.
- `applyExpeditionResult`: if the destination is the recruit destination and `!newSpeciesJoined`, add the character and set the flag.
- `DwarfRoster.tsx`: a species badge, a different style, and production numbers shown per job so the player can decide.
- `ForgePage.tsx`: show the crafting limitation, e.g. a greyed-out weapon option with the reason.

**Decisions**
- [ ] Species, name, icon and story.
- [ ] Which destination recruits, and how the game tells the player beforehand (e.g. "rumours of a stranger in the Crystal Cave").
- [ ] Production table for the species.
- [ ] Crafting ability or limitation.
- [ ] Does the species eat differently? Can they use tools or go on expeditions?
- [ ] Does the client or the server decide on recruitment? (The client is simpler and works with D5 saving.)

---

## D7 — Expedition consequences and defense (15%)

**Meaning:** a new destination whose success causes attackers to follow the traveller home. With at least N weapons the colony defends itself. Otherwise the attackers loot a deterministic set of resources. Failed requests never trigger an attack.

**Example (threshold 3, weapons kept):** a successful return from the *Goblin Warrens*, +6 stone, triggers an attack.
- With 3 weapons: *"Stonehome's defenders drove the goblins back!"* Nothing is lost.
- With 1 weapon: the goblins loot **half of the food and half of the wood (rounded down)**. 20 food → 10, 8 wood → 4. A red Chronicle entry lists the exact losses.
- If the Warrens request fails (503), there's no attack.

**Code changes**
- `server/index.js`: a new destination in `outcomes` with `event: "attack"`.
- `ColonyPage.tsx`: the new `<option>`, ideally with a danger hint.
- `simulation.ts`: a pure `resolveAttack(state, threshold): { state, report }`, called only in the success path of `applyExpeditionResult`.
- UI: a clear result, either a `danger` Chronicle entry or a banner showing what was lost or that the defense held.
- Tests: above the threshold, below it, exactly at it, and that a failed request causes no attack.

**Decisions**
- [ ] Destination name and its rewards.
- [ ] Weapon threshold.
- [ ] Does defense **consume** weapons (how many?) or **preserve** them? Communicate it in the UI.
- [ ] Loot rule. It must be deterministic, e.g. a fixed percentage of fixed resources or "the largest stockpile".
- [ ] Does every successful trip trigger an attack or only the first?
- [ ] Can the attack take tools that are equipped to characters? (Probably not.)

---

## Qualitative goals (team must define)

Proposed goals with ideas for how to evaluate each:

| Goal | Why | Decisions supporting it | How to evaluate |
|---|---|---|---|
| **Correctness and consistency** | Most requirements are about invariants | Pure rule functions; a single `setColony` per action | Unit tests for invariants (tool count, no negative resources, rewards applied once) |
| **Determinism and testability** | D1 and D7 require determinism | No `Math.random` in rules; fixed orderings | Same input gives the same output in tests |
| **Robustness** | D4 and D5 involve failures and corrupt data | Request IDs, guards, validated loading | Tests with `?fail=true`, high latency, corrupt `localStorage` |
| **Understandability for the player** | Requirements say "visible" and "explained" | Chronicle messages, tooltips, disabled buttons with reasons | Walkthrough checklist or a small user test |
| **Maintainability** | A second species, more recipes and destinations | Data tables per species, recipe and destination | Adding a recipe touches only one table |

---

## Suggested work split

| Person A: colony and forge | Person B: expeditions |
|---|---|
| D1 (15%) | D4 (10%) |
| D2 (20%) | D7 (15%) |
| D3 (10%) | D6 (20%) |

- **Together first:** section 1 (shared interfaces) and the `Dwarf` → `Character` rename.
- **Together last:** D5 save and restore, plus the qualitative goals document.
- **Dependencies:**
  - D7 needs `weapons` from D2.
  - D6 needs the D1 and D3 rules.
  - The D4 tool decision affects D2.
  - Both of us edit `advanceDay`, so merge often.

## Suggested order

1. Shared types and the rename.
2. D1.
3. D2 in parallel with D4.
4. D3 in parallel with D7.
5. D6.
6. D5.
7. Qualitative goals and tests.
