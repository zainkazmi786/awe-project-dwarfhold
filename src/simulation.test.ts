import { describe, expect, it } from "vitest";
import {
  advanceDay, cancelCraft, departExpedition, equipTool, feedDwarves, returnFromExpedition, returnTool, startCraft,
} from "./simulation";
import { parseSave, SAVE_VERSION, serializeSave } from "./state/persistence";
import type { ColonyState, Dwarf } from "./types";

const dwarf = (overrides: Partial<Dwarf> = {}): Dwarf => ({
  id: "d1", name: "Brom", title: "", icon: "",
  assignment: "woodcutting", status: "working", hungry: false, hasTool: false,
  ...overrides,
});

const colony = (dwarves: Dwarf[], food = 5): ColonyState => ({
  day: 1,
  resources: { wood: 0, stone: 0, food, tools: 0, weapons: 0 },
  dwarves,
  crafting: [],
});

describe("colony simulation", () => {
  it("produces assigned resources and feeds the company", () => {
    const state = colony([dwarf()]);
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 3, food: 4 } });
    expect(state.resources.wood).toBe(0);
  });

  it("does not let a dwarf on expedition produce or eat colony food", () => {
    const next = advanceDay(colony([dwarf({ status: "expedition" })]));
    expect(next.resources).toMatchObject({ wood: 0, food: 5 });
    expect(next.dwarves[0].hungry).toBe(false);
  });

  it("does not let an idle dwarf produce", () => {
    const next = advanceDay(colony([dwarf({ status: "idle", assignment: null })]));
    expect(next.resources.wood).toBe(0);
  });

  it("does not let a hungry dwarf produce", () => {
    const next = advanceDay(colony([dwarf({ hungry: true })]));
    expect(next.resources.wood).toBe(0);
  });

  it("feeds in roster order and marks the unfed dwarf hungry", () => {
    const { dwarves, food } = feedDwarves(
      [dwarf({ id: "a" }), dwarf({ id: "b" }), dwarf({ id: "c" })],
      2,
    );
    expect(food).toBe(0);
    expect(dwarves.map((d) => d.hungry)).toEqual([false, false, true]);
  });

  it("never lets food go negative", () => {
    const next = advanceDay(colony([dwarf(), dwarf({ id: "d2" })], 0));
    expect(next.resources.food).toBe(0);
    expect(next.dwarves.every((d) => d.hungry)).toBe(true);
  });

  it("lets food produced today feed the farmer at the end of the day", () => {
    const next = advanceDay(colony([dwarf({ assignment: "farming" })], 0));
    expect(next.resources.food).toBe(3);
    expect(next.dwarves[0].hungry).toBe(false);
  });

  it("lets a hungry dwarf recover once food is available", () => {
    const next = advanceDay(colony([dwarf({ hungry: true })], 3));
    expect(next.dwarves[0].hungry).toBe(false);
    expect(next.resources.food).toBe(2);
  });

  it("is deterministic", () => {
    const state = colony([dwarf(), dwarf({ id: "d2" }), dwarf({ id: "d3" })], 1);
    expect(advanceDay(state)).toEqual(advanceDay(state));
  });
});

const withStock = (dwarves: Dwarf[], stock: Partial<ColonyState["resources"]>) => {
  const state = colony(dwarves);
  return { ...state, resources: { ...state.resources, ...stock } };
};
const smith = (overrides: Partial<Dwarf> = {}) => dwarf({ assignment: "smithing", ...overrides });

describe("D2: tools and weapons", () => {
  const totalTools = (state: ColonyState) =>
    state.resources.tools + state.dwarves.filter((d) => d.hasTool).length;

  it("adds +1 production for an equipped, working dwarf", () => {
    expect(advanceDay(colony([dwarf({ hasTool: true })])).resources.wood).toBe(4);
    expect(advanceDay(colony([dwarf({ hasTool: true, assignment: "mining" })])).resources.stone).toBe(3);
  });

  it("gives no bonus when the dwarf is hungry or unassigned", () => {
    expect(advanceDay(colony([dwarf({ hasTool: true, hungry: true })])).resources.wood).toBe(0);
    expect(advanceDay(colony([dwarf({ hasTool: true, assignment: null, status: "idle" })])).resources.wood).toBe(0);
  });

  it("moves a tool from storage to the dwarf and back", () => {
    const start = withStock([dwarf()], { tools: 1 });
    const equipped = equipTool(start, "d1");
    expect(equipped.resources.tools).toBe(0);
    expect(equipped.dwarves[0].hasTool).toBe(true);
    const returned = returnTool(equipped, "d1");
    expect(returned.resources.tools).toBe(1);
    expect(returned.dwarves[0].hasTool).toBe(false);
  });

  it("refuses a second tool, an empty storage and a travelling dwarf", () => {
    const state = withStock([dwarf({ hasTool: true }), dwarf({ id: "d2" }), dwarf({ id: "d3", status: "expedition" })], { tools: 0 });
    expect(equipTool(state, "d1")).toBe(state);
    expect(equipTool(state, "d2")).toBe(state);
    const stocked = withStock(state.dwarves, { tools: 1 });
    expect(equipTool(stocked, "d3")).toBe(stocked);
  });

  it("keeps the total number of tools constant", () => {
    const start = withStock([dwarf(), dwarf({ id: "d2" })], { tools: 2 });
    const end = returnTool(equipTool(equipTool(start, "d1"), "d2"), "d1");
    expect(totalTools(end)).toBe(totalTools(start));
  });

  it("forges a weapon for 3 wood + 3 stone", () => {
    const next = startCraft(withStock([smith()], { wood: 3, stone: 3 }), "d1", "weapon");
    expect(next.resources).toMatchObject({ wood: 0, stone: 0 });
  });

  it("changes nothing when materials are missing (stone never negative)", () => {
    const state = withStock([smith()], { wood: 10, stone: 1 });
    expect(startCraft(state, "d1", "tool")).toBe(state);
    expect(startCraft(state, "d1", "weapon")).toBe(state);
  });
});

describe("D3: crafting takes a smith and time", () => {
  const stocked = (dwarves: Dwarf[]) => withStock(dwarves, { wood: 20, stone: 20, food: 10 });

  it("pays at the start and delivers a tool after 2 days", () => {
    const started = startCraft(stocked([smith()]), "d1", "tool");
    expect(started.resources).toMatchObject({ wood: 17, stone: 18, tools: 0 });
    expect(started.crafting).toEqual([{ dwarfId: "d1", recipe: "tool", readyDay: 3 }]);
    const day2 = advanceDay(started);
    expect(day2.resources.tools).toBe(0);
    const day3 = advanceDay(day2);
    expect(day3.resources.tools).toBe(1);
    expect(day3.crafting).toEqual([]);
  });

  it("takes 3 days for a weapon", () => {
    let state = startCraft(stocked([smith()]), "d1", "weapon");
    state = advanceDay(advanceDay(state));
    expect(state.resources.weapons).toBe(0);
    expect(advanceDay(state).resources.weapons).toBe(1);
  });

  it("refuses non-smiths, hungry, travelling and busy dwarves without changes", () => {
    const state = stocked([
      dwarf(),
      smith({ id: "d2", hungry: true }),
      smith({ id: "d3", status: "expedition" }),
    ]);
    ["d1", "d2", "d3", "nobody"].forEach((id) => expect(startCraft(state, id, "tool")).toBe(state));
    const busy = startCraft(stocked([smith()]), "d1", "tool");
    expect(startCraft(busy, "d1", "tool")).toBe(busy);
  });

  it("cancel refunds everything and frees the smith", () => {
    const start = stocked([smith()]);
    const cancelled = cancelCraft(startCraft(start, "d1", "weapon"), "d1");
    expect(cancelled.resources).toEqual(start.resources);
    expect(cancelled.crafting).toEqual([]);
    expect(cancelCraft(start, "d1")).toBe(start);
  });

  it("a smith produces no resources while crafting", () => {
    const next = advanceDay(startCraft(stocked([smith({ hasTool: true })]), "d1", "tool"));
    expect(next.resources).toMatchObject({ wood: 17, stone: 18 });
  });
});

describe("D4: resilient expeditions", () => {
  const rewards = { stone: 8, tools: 1 };

  it("refuses away, hungry and forging dwarves without changes", () => {
    const state = withStock([dwarf({ status: "expedition" }), dwarf({ id: "d2", hungry: true }), smith({ id: "d3" })], { wood: 9, stone: 9 });
    const forging = startCraft(state, "d3", "tool");
    ["d1", "d2", "d3", "nobody"].forEach((id) => expect(departExpedition(forging, id, "old-mine")).toBe(forging));
  });

  it("applies rewards exactly once", () => {
    const away = departExpedition(colony([dwarf()]), "d1", "old-mine");
    const back = returnFromExpedition(away, "d1", rewards);
    expect(back.resources).toMatchObject({ stone: 8, tools: 1 });
    expect(back.dwarves[0].status).toBe("working");
    expect(returnFromExpedition(back, "d1", rewards)).toBe(back);
  });

  it("a failed trip gives nothing and frees the dwarf", () => {
    const start = colony([dwarf({ assignment: null, status: "idle" })]);
    const back = returnFromExpedition(departExpedition(start, "d1", "old-mine"), "d1");
    expect(back.resources).toEqual(start.resources);
    expect(back.dwarves[0].status).toBe("idle");
  });

  it("while away for a day the dwarf neither works nor eats, and keeps the tool", () => {
    const away = advanceDay(departExpedition(colony([dwarf({ hasTool: true })]), "d1", "old-mine"));
    expect(away.resources).toMatchObject({ wood: 0, food: 5 });
    const back = returnFromExpedition(away, "d1", rewards);
    expect(back.dwarves[0]).toMatchObject({ status: "working", hasTool: true });
  });
});

describe("D5: save and restore", () => {
  const valid = () => colony([dwarf({ status: "expedition", destination: "old-mine" })]);
  const save = (state: ColonyState) => serializeSave({ colony: state, activities: [] });

  it("remembers the destination while away and clears it on return", () => {
    const away = departExpedition(colony([dwarf()]), "d1", "old-mine");
    expect(away.dwarves[0].destination).toBe("old-mine");
    expect(returnFromExpedition(away, "d1").dwarves[0].destination).toBeUndefined();
  });

  it("restores a saved colony exactly, including forge orders and travellers", () => {
    const state = { ...valid(), crafting: [{ dwarfId: "d1", recipe: "tool" as const, readyDay: 4 }] };
    expect(parseSave(save(state))).toEqual({ status: "ok", data: { colony: state, activities: [] } });
  });

  it("a restored forge order still finishes on its ready day", () => {
    const state = { ...colony([smith()]), crafting: [{ dwarfId: "d1", recipe: "tool" as const, readyDay: 2 }] };
    const result = parseSave(save(state));
    if (result.status !== "ok") throw new Error("expected ok");
    expect(advanceDay(result.data.colony).resources.tools).toBe(1);
  });

  it("treats a missing save as empty", () => {
    expect(parseSave(null)).toEqual({ status: "empty" });
  });

  it("rejects broken JSON as corrupt", () => {
    expect(parseSave("{not json")).toEqual({ status: "invalid", reason: "corrupt" });
  });

  it("rejects another version as incompatible", () => {
    const raw = JSON.stringify({ version: 0, colony: valid(), activities: [] });
    expect(parseSave(raw)).toEqual({ status: "invalid", reason: "incompatible" });
  });

  it("rejects wrong shapes as corrupt", () => {
    const broken = [
      { ...valid(), day: "12" },
      { ...valid(), resources: { ...valid().resources, stone: -1 } },
      { ...valid(), dwarves: [{ ...dwarf(), status: "flying" }] },
      { ...valid(), crafting: [{ dwarfId: "ghost", recipe: "tool", readyDay: 3 }] },
    ];
    broken.forEach((state) =>
      expect(parseSave(JSON.stringify({ version: SAVE_VERSION, colony: state, activities: [] })))
        .toEqual({ status: "invalid", reason: "corrupt" }),
    );
  });
});
