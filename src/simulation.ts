import type { ColonyState, Dwarf, JobType, Recipe, Resources } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

export const TOOL_BONUS = 1;

export const recipes: Record<Recipe, { cost: Partial<Resources>; output: keyof Resources }> = {
  tool: { cost: { wood: 3, stone: 2 }, output: "tools" },
  weapon: { cost: { wood: 3, stone: 3 }, output: "weapons" },
};

/** A dwarf produces only when present, assigned, working and not hungry. */
export const isProducing = (dwarf: Dwarf): boolean =>
  dwarf.status === "working" && dwarf.assignment !== null && !dwarf.hungry;

/** Dwarves on an expedition forage for themselves and do not eat colony food. */
export const eatsColonyFood = (dwarf: Dwarf): boolean =>
  dwarf.status !== "expedition";

/**
 * Feeds dwarves one by one in roster order (deterministic).
 * Each eater takes 1 food if available; otherwise they become hungry.
 * Food never goes below 0.
 */
export function feedDwarves(dwarves: Dwarf[], food: number): { dwarves: Dwarf[]; food: number } {
  let remaining = food;
  const fed = dwarves.map((dwarf) => {
    if (!eatsColonyFood(dwarf)) return dwarf;
    if (remaining > 0) {
      remaining -= 1;
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
    Object.entries(production[dwarf.assignment!]).map(([resource, amount]) => [resource, (amount ?? 0) + bonus]),
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

  return { ...state, day: state.day + 1, resources, dwarves };
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

/** Pays the recipe cost and adds the result. Returns the same state if materials are missing. */
export function craft(state: ColonyState, recipe: Recipe): ColonyState {
  const { cost, output } = recipes[recipe];
  if (!canAfford(state.resources, cost)) return state;
  const resources = { ...state.resources };
  Object.entries(cost).forEach(([resource, amount]) => {
    resources[resource as keyof Resources] -= amount ?? 0;
  });
  resources[output] += 1;
  return { ...state, resources };
}

export const jobLabel = (job: JobType) => job ? ({
  woodcutting: "Woodcutting",
  mining: "Deep Mining",
  farming: "Mushroom Farm"
}[job]) : "Unassigned";
