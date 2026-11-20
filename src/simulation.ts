import type { ColonyState, Dwarf, JobType, Resources } from "./types";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
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

export function advanceDay(state: ColonyState): ColonyState {
  const resources = { ...state.resources };

  // 1. Production (uses hunger from the previous day's meal)
  state.dwarves.forEach((dwarf) => {
    if (!isProducing(dwarf)) return;

    const output = production[dwarf.assignment!];

    Object.entries(output).forEach(([resource, amount]) => {
      resources[resource as keyof Resources] += amount ?? 0;
    });
  });

  // 2. Meals at the end of the day
  const { dwarves, food } = feedDwarves(state.dwarves, resources.food);
  resources.food = food;

  return { ...state, day: state.day + 1, resources, dwarves };
}

export const jobLabel = (job: JobType) => job ? ({
  woodcutting: "Woodcutting",
  mining: "Deep Mining",
  farming: "Mushroom Farm"
}[job]) : "Unassigned";
