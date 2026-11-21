import { useEffect, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import {
  advanceDay,
  canAfford,
  craft,
  equipTool,
  jobLabel,
  recipes,
  returnTool,
} from "../simulation";
import type {
  Activity,
  ColonyState,
  JobType,
  Recipe,
  ResourceKey,
} from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";

const initialState: ColonyState = {
  day: 12,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    tools: 1,
    weapons: 0,
  },
  dwarves: [
    {
      id: "dwarf-1",
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      assignment: "mining",
      status: "working",
      specialty: "mining",
      hungry: false,
      hasTool: false,
    },
    {
      id: "dwarf-2",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      assignment: "woodcutting",
      status: "working",
      specialty: "woodcutting",
      hungry: false,
      hasTool: false,
    },
    {
      id: "dwarf-3",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
      hungry: false,
      hasTool: false,
    },
  ],
};

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [colony, setColony] = useState(initialState);
  const [paused, setPaused] = useState(false);
  const [expeditionPending, setExpeditionPending] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: "welcome",
      day: 12,
      message: "The forge fires are lit. Stonehome wakes.",
    },
  ]);

  function addActivity(message: string, tone?: Activity["tone"]) {
    setActivities((current) =>
      [
        { id: crypto.randomUUID(), day: colony.day, message, tone },
        ...current,
      ].slice(0, 6),
    );
  }

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [paused]);

  // D1: after each day's meal, report dwarves who went hungry.
  // Done in an effect (not inside advanceDay / the setColony updater) so the
  // message is logged once per day even if React re-runs state updaters.
  useEffect(() => {
    const hungry = colony.dwarves.filter((dwarf) => dwarf.hungry);
    if (hungry.length === 0) return;

    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `Not enough food — ${hungry
            .map((dwarf) => dwarf.name)
            .join(", ")} went hungry and will not work tomorrow.`,
          tone: "warning" as const,
        },
        ...current,
      ].slice(0, 6),
    );
  }, [colony.day]); // intentionally only on day change

  function assignDwarf(id: string, assignment: JobType) {
    // D1: a dwarf on an expedition cannot take a second activity.
    if (
      colony.dwarves.find((item) => item.id === id)?.status === "expedition"
    ) {
      return;
    }

    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((dwarf) =>
        dwarf.id === id && dwarf.status !== "expedition"
          ? {
              ...dwarf,
              assignment,
              status: assignment ? "working" : "idle",
            }
          : dwarf,
      ),
    }));

    const dwarf = colony.dwarves.find((item) => item.id === id);
    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf?.name ?? "A dwarf"} assigned to ${jobLabel(assignment)}.`,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  function equip(id: string) {
    const dwarf = colony.dwarves.find((item) => item.id === id);
    if (!dwarf || equipTool(colony, id) === colony) {
      addActivity("No tool available to equip.", "warning");
      return;
    }
    setColony((current) => equipTool(current, id));
    addActivity(`${dwarf.name} equipped a tool.`);
  }

  function unequip(id: string) {
    const dwarf = colony.dwarves.find((item) => item.id === id);
    if (!dwarf || returnTool(colony, id) === colony) return;
    setColony((current) => returnTool(current, id));
    addActivity(`${dwarf.name} returned a tool to storage.`);
  }

  function craftItem(recipe: Recipe) {
    if (!canAfford(colony.resources, recipes[recipe].cost)) {
      addActivity(`Not enough materials to forge a ${recipe}.`, "warning");
      return;
    }
    setColony((current) => craft(current, recipe));
    addActivity(
      recipe === "tool"
        ? "A sturdy iron tool joins the stores."
        : "A new weapon joins the armoury.",
      "good",
    );
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf) return;

    setExpeditionPending(true);
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === dwarf.id ? { ...item, status: "expedition" } : item,
      ),
    }));
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${dwarf.name} departed for ${destination.replace("-", " ")}.`,
      },
      ...current,
    ]);

    try {
      const result = await beginExpedition(dwarf.id, destination);

      setColony((current) => ({
        ...current,
        resources: Object.entries(result.rewards).reduce(
          (all, [key, amount]) => ({
            ...all,
            [key]: all[key as ResourceKey] + (amount ?? 0),
          }),
          current.resources,
        ),
        dwarves: current.dwarves.map((item) =>
          item.id === dwarf.id
            ? {
                ...item,
                status: item.assignment ? "working" : "idle",
              }
            : item,
        ),
      }));
      setActivities((current) =>
        [
          {
            id: result.expeditionId,
            day: colony.day,
            message: result.message,
            tone: "good" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    } catch (error) {
      setActivities((current) =>
        [
          {
            id: crypto.randomUUID(),
            day: colony.day,
            message:
              error instanceof Error
                ? error.message
                : "The expedition was lost from view.",
            tone: "warning" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    }

    setExpeditionPending(false);
  }

  const value: ColonyContextValue = {
    colony,
    paused,
    activities,
    expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf,
    equipTool: equip,
    returnTool: unequip,
    craft: craftItem,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
