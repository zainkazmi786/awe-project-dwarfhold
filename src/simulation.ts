import type { ColonyState, CraftJob, Dwarf, JobType, Recipe, Recruit, Resources, Species } from "./types";

type ProductionTable = Record<Exclude<JobType, null>, Partial<Resources>>;

/** D6: everything that differs between species lives in this one table. */
export interface SpeciesTraits {
  label: string;
  icon: string;
  appetite: number;                              // rations eaten per day
  production: ProductionTable;                   // base output per job (tool bonus comes on top)
  craftable: Recipe[];                           // what this species may forge
  craftDays: Partial<Record<Recipe, number>>;    // overrides recipes[recipe].days
  summary: string;                               // shown in the roster
}

export const speciesTraits: Record<Species, SpeciesTraits> = {
  dwarf: {
    label: "Dwarf",
    icon: "🧔",
    appetite: 1,
    production: { woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 }, smithing: {} },
    craftable: ["tool", "weapon"],
    craftDays: {},
    summary: "Eats 1 · Wood +3 · Stone +2 · Food +4 · Forges tools and weapons",
  },
  "working-student": {
    label: "Working Student",
    icon: "🎓",
    appetite: 2,                                 // always exhausted: needs two rations
    production: { woodcutting: { wood: 2 }, mining: { stone: 1 }, farming: { food: 5 }, smithing: {} },
    craftable: ["tool"],                         // no time (or will) for weapons
    craftDays: { tool: 1 },                      // engineering lectures: tools in 1 day
    summary: "Eats 2 · Wood +2 · Stone +1 · Food +5 · Tools in 1 day · Cannot forge weapons",
  },
};

/** Dwarf production (kept for existing callers). */
export const production = speciesTraits.dwarf.production;

export const TOOL_BONUS = 1;

export const recipes: Record<Recipe, { cost: Partial<Resources>; output: keyof Resources; days: number }> = {
  tool: { cost: { wood: 3, stone: 2 }, output: "tools", days: 2 },
  weapon: { cost: { wood: 3, stone: 3 }, output: "weapons", days: 3 },
};

/** A dwarf produces only when present, assigned, working and not hungry. */
export const isProducing = (dwarf: Dwarf): boolean =>
  dwarf.status === "working" && dwarf.assignment !== null && !dwarf.hungry;

/** Dwarves on an expedition forage for themselves and do not eat colony food. */
export const eatsColonyFood = (dwarf: Dwarf): boolean =>
  dwarf.status !== "expedition";

/**
 * Feeds characters one by one in roster order (deterministic).
 * Each eater takes their full appetite (D6) if available; otherwise they take
 * nothing and become hungry (the food stays for the next in line).
 * Food never goes below 0.
 */
export function feedDwarves(dwarves: Dwarf[], food: number): { dwarves: Dwarf[]; food: number } {
  let remaining = food;
  const fed = dwarves.map((dwarf) => {
    if (!eatsColonyFood(dwarf)) return dwarf;
    const appetite = speciesTraits[dwarf.species].appetite;
    if (remaining >= appetite) {
      remaining -= appetite;
      return { ...dwarf, hungry: false };
    }
    return { ...dwarf, hungry: true };
  });
  return { dwarves: fed, food: remaining };
}

/** What one dwarf produces today, including the +1 tool bonus (D2). */
export function dailyOutput(dwarf: Dwarf): Partial<Resources> {
  if (!isProducing(dwarf)) return {};
  const bonus = dwarf.hasTool ? TOOL_BONUS : 0;
  return Object.fromEntries(
    Object.entries(speciesTraits[dwarf.species].production[dwarf.assignment!]).map(([resource, amount]) => [resource, (amount ?? 0) + bonus]),
  );
}

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  // 1. Production (uses hunger from the previous day's meal)
  state.dwarves.forEach((dwarf) => {
    Object.entries(dailyOutput(dwarf)).forEach(([resource, amount]) => {
      resources[resource as keyof Resources] += amount ?? 0;
    });
  });

  // 2. Meals at the end of the day
  const { dwarves, food } = feedDwarves(state.dwarves, resources.food);
  resources.food = food;

  // 3. D3: finished forge orders go into storage
  const day = state.day + 1;
  finishedJobs(state.crafting, day).forEach((job) => {
    resources[recipes[job.recipe].output] += 1;
  });
  const crafting = state.crafting.filter((job) => job.readyDay > day);

  return { ...state, day, resources, dwarves, crafting };
}

/** D2: takes one tool from storage. Returns the same state if not allowed. */
export function equipTool(state: ColonyState, id: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === id);
  if (!dwarf || dwarf.hasTool || dwarf.status === "expedition" || state.resources.tools < 1) return state;
  return {
    ...state,
    resources: { ...state.resources, tools: state.resources.tools - 1 },
    dwarves: state.dwarves.map((item) => (item.id === id ? { ...item, hasTool: true } : item)),
  };
}

/** D2: puts the dwarf's tool back into storage. */
export function returnTool(state: ColonyState, id: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === id);
  if (!dwarf || !dwarf.hasTool || dwarf.status === "expedition") return state;
  return {
    ...state,
    resources: { ...state.resources, tools: state.resources.tools + 1 },
    dwarves: state.dwarves.map((item) => (item.id === id ? { ...item, hasTool: false } : item)),
  };
}

export const canAfford = (resources: Resources, cost: Partial<Resources>): boolean =>
  Object.entries(cost).every(([resource, amount]) => resources[resource as keyof Resources] >= (amount ?? 0));

export const finishedJobs = (jobs: CraftJob[], day: number): CraftJob[] =>
  jobs.filter((job) => job.readyDay <= day);

export const isCrafting = (state: ColonyState, id: string): boolean =>
  state.crafting.some((job) => job.dwarfId === id);

/** D3: a smith at home, fed and without an open order. */
export function canCraft(state: ColonyState, id: string): boolean {
  const dwarf = state.dwarves.find((item) => item.id === id);
  return !!dwarf && dwarf.status === "working" && dwarf.assignment === "smithing" && !dwarf.hungry && !isCrafting(state, id);
}

/** D6: the species of this character is allowed to forge this recipe. */
export function canForge(state: ColonyState, id: string, recipe: Recipe): boolean {
  const dwarf = state.dwarves.find((item) => item.id === id);
  return !!dwarf && speciesTraits[dwarf.species].craftable.includes(recipe);
}

/** D6: forge time depends on the species (falls back to the recipe default). */
export const craftDaysFor = (dwarf: Dwarf | undefined, recipe: Recipe): number =>
  (dwarf && speciesTraits[dwarf.species].craftDays[recipe]) ?? recipes[recipe].days;

/** D3: pays the cost now, the item arrives after `days`. Returns the same state if not allowed. */
export function startCraft(state: ColonyState, id: string, recipe: Recipe): ColonyState {
  const { cost } = recipes[recipe];
  if (!canCraft(state, id) || !canForge(state, id, recipe) || !canAfford(state.resources, cost)) return state;
  const days = craftDaysFor(state.dwarves.find((item) => item.id === id), recipe);
  const resources = { ...state.resources };
  Object.entries(cost).forEach(([resource, amount]) => {
    resources[resource as keyof Resources] -= amount ?? 0;
  });
  return { ...state, resources, crafting: [...state.crafting, { dwarfId: id, recipe, readyDay: state.day + days }] };
}

/** D3: full refund and the smith is free again. */
export function cancelCraft(state: ColonyState, id: string): ColonyState {
  const job = state.crafting.find((item) => item.dwarfId === id);
  if (!job) return state;
  const resources = { ...state.resources };
  Object.entries(recipes[job.recipe].cost).forEach(([resource, amount]) => {
    resources[resource as keyof Resources] += amount ?? 0;
  });
  return { ...state, resources, crafting: state.crafting.filter((item) => item !== job) };
}

/** D4: at home, fed and not busy at the forge. */
export function canExplore(state: ColonyState, id: string): boolean {
  const dwarf = state.dwarves.find((item) => item.id === id);
  return !!dwarf && dwarf.status !== "expedition" && !dwarf.hungry && !isCrafting(state, id);
}

/** D4: marks the dwarf as travelling. The equipped tool goes along. D5: remembers the destination. */
export function departExpedition(state: ColonyState, id: string, destination: string): ColonyState {
  if (!canExplore(state, id)) return state;
  return {
    ...state,
    dwarves: state.dwarves.map((item) => (item.id === id ? { ...item, status: "expedition", destination } : item)),
  };
}

/** D6: builds the new resident from the server's recruit data. */
export function createRecruit(recruit: Recruit): Dwarf {
  return {
    id: `${recruit.species}-1`,
    species: recruit.species,
    name: recruit.name,
    title: recruit.title,
    icon: speciesTraits[recruit.species].icon,
    assignment: null,
    status: "idle",
    hungry: false,
    hasTool: false,
  };
}

/**
 * D4: brings the dwarf back and adds rewards (none on failure). Only works once per trip.
 * D6: if the server sent a recruit and nobody has joined yet, they join in the same update,
 * so "joins only once" is protected by the same guard as "rewards applied once".
 */
export function returnFromExpedition(
  state: ColonyState,
  id: string,
  rewards: Partial<Resources> = {},
  recruit?: Recruit,
): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === id);
  if (!dwarf || dwarf.status !== "expedition") return state;
  const resources = { ...state.resources };
  Object.entries(rewards).forEach(([resource, amount]) => {
    resources[resource as keyof Resources] += amount ?? 0;
  });
  const dwarves: Dwarf[] = state.dwarves.map((item) =>
    item.id === id
      ? { ...item, status: item.assignment ? "working" : "idle", destination: undefined }
      : item,
  );
  const joins = !!recruit && !state.recruited && recruit.species in speciesTraits;
  return {
    ...state,
    resources,
    dwarves: joins ? [...dwarves, createRecruit(recruit!)] : dwarves,
    recruited: state.recruited || joins,
  };
}

export const jobLabel = (job: JobType) => job ? ({
  woodcutting: "Woodcutting",
  mining: "Deep Mining",
  farming: "Mushroom Farm",
  smithing: "Ember Forge"
}[job]) : "Unassigned";
