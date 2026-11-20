import { describe, expect, it } from "vitest";
import { advanceDay, feedDwarves } from "./simulation";
import type { ColonyState, Dwarf } from "./types";

const dwarf = (overrides: Partial<Dwarf> = {}): Dwarf => ({
  id: "d1", name: "Brom", title: "", icon: "",
  assignment: "woodcutting", status: "working", hungry: false,
  ...overrides,
});

const colony = (dwarves: Dwarf[], food = 5): ColonyState => ({
  day: 1,
  resources: { wood: 0, stone: 0, food, tools: 0 },
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
