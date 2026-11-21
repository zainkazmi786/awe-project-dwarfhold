import { describe, expect, it } from "vitest";
import { advanceDay, craft, equipTool, feedDwarves, returnTool } from "./simulation";
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

describe("D2: tools and weapons", () => {
  const withStock = (dwarves: Dwarf[], stock: Partial<ColonyState["resources"]>) => {
    const state = colony(dwarves);
    return { ...state, resources: { ...state.resources, ...stock } };
  };
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
    const next = craft(withStock([], { wood: 3, stone: 3 }), "weapon");
    expect(next.resources).toMatchObject({ wood: 0, stone: 0, weapons: 1 });
  });

  it("changes nothing when materials are missing (stone never negative)", () => {
    const state = withStock([], { wood: 10, stone: 1 });
    expect(craft(state, "tool")).toBe(state);
    expect(craft(state, "weapon")).toBe(state);
  });
});
