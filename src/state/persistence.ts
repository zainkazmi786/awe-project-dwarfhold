import { recipes, speciesTraits } from "../simulation";
import type { Activity, ColonyState, CraftJob, Dwarf } from "../types";

/** D5: saved in localStorage under this key. Bump SAVE_VERSION when the state shape changes. */
export const SAVE_KEY = "dwarfhold-save";
export const SAVE_VERSION = 2; // v2: D6 adds Dwarf.species and ColonyState.recruited

export interface SaveData {
  colony: ColonyState;
  activities: Activity[];
}

export type LoadResult =
  | { status: "ok"; data: SaveData }
  | { status: "empty" }
  | { status: "invalid"; reason: "corrupt" | "incompatible" };

const RESOURCE_KEYS = ["wood", "stone", "food", "tools", "weapons"] as const;
const JOBS = ["woodcutting", "mining", "farming", "smithing", null];
const STATUSES = ["idle", "working", "expedition"];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function isDwarf(value: unknown): value is Dwarf {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.species === "string" &&
    value.species in speciesTraits &&
    typeof value.name === "string" &&
    typeof value.title === "string" &&
    typeof value.icon === "string" &&
    JOBS.includes(value.assignment as string | null) &&
    STATUSES.includes(value.status as string) &&
    (value.specialty === undefined || JOBS.includes(value.specialty as string)) &&
    typeof value.hungry === "boolean" &&
    typeof value.hasTool === "boolean" &&
    (value.destination === undefined || typeof value.destination === "string")
  );
}

function isCraftJob(value: unknown, dwarfIds: string[]): value is CraftJob {
  return (
    isObject(value) &&
    typeof value.dwarfId === "string" &&
    dwarfIds.includes(value.dwarfId) &&
    typeof value.recipe === "string" &&
    value.recipe in recipes &&
    isNumber(value.readyDay)
  );
}

function isActivity(value: unknown): value is Activity {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    isNumber(value.day) &&
    typeof value.message === "string" &&
    (value.tone === undefined || value.tone === "good" || value.tone === "warning")
  );
}

export function isColonyState(value: unknown): value is ColonyState {
  if (!isObject(value) || !isNumber(value.day) || typeof value.recruited !== "boolean") return false;
  const { resources, dwarves, crafting } = value;
  if (!isObject(resources) || !RESOURCE_KEYS.every((key) => isNumber(resources[key]) && resources[key] >= 0)) return false;
  if (!Array.isArray(dwarves) || !dwarves.every(isDwarf)) return false;
  const ids = dwarves.map((dwarf) => dwarf.id);
  return Array.isArray(crafting) && crafting.every((job) => isCraftJob(job, ids));
}

/** Pure: turns the raw localStorage string into a checked save (testable without a browser). */
export function parseSave(raw: string | null): LoadResult {
  if (raw === null) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "corrupt" };
  }

  if (!isObject(parsed)) return { status: "invalid", reason: "corrupt" };
  if (parsed.version !== SAVE_VERSION) return { status: "invalid", reason: "incompatible" };
  if (!isColonyState(parsed.colony) || !Array.isArray(parsed.activities) || !parsed.activities.every(isActivity)) {
    return { status: "invalid", reason: "corrupt" };
  }
  return { status: "ok", data: { colony: parsed.colony, activities: parsed.activities } };
}

export const serializeSave = (data: SaveData): string =>
  JSON.stringify({ version: SAVE_VERSION, ...data });

/** Reading can throw (private mode, blocked storage): treated as "no save". */
export function loadSave(): LoadResult {
  try {
    return parseSave(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return { status: "empty" };
  }
}

/** Writing can throw (quota, blocked storage): the game keeps running unsaved. */
export function writeSave(data: SaveData): void {
  try {
    window.localStorage.setItem(SAVE_KEY, serializeSave(data));
  } catch {
    // ignore: saving is best effort
  }
}
