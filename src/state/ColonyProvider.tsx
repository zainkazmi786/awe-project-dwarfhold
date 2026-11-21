import { useEffect, useRef, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import {
  advanceDay,
  canAfford,
  canCraft,
  canExplore,
  cancelCraft,
  departExpedition,
  equipTool,
  finishedJobs,
  isCrafting,
  jobLabel,
  recipes,
  returnFromExpedition,
  returnTool,
  startCraft,
} from "../simulation";
import type { Activity, ColonyState, JobType, Recipe } from "../types";
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
  crafting: [],
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

  // D4: current day for messages that arrive later (slow expedition requests)
  const today = useRef(colony.day);
  useEffect(() => {
    today.current = colony.day;
  }, [colony.day]);
  // D4: blocks a second send before React has re-rendered
  const inFlight = useRef(false);

  function addActivity(message: string, tone?: Activity["tone"]) {
    setActivities((current) =>
      [
        { id: crypto.randomUUID(), day: today.current, message, tone },
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

  // D3: log finished orders. The ref holds the orders from before the day change.
  const openOrders = useRef(colony.crafting);
  useEffect(() => {
    finishedJobs(openOrders.current, colony.day).forEach((job) => {
      const smith = colony.dwarves.find((item) => item.id === job.dwarfId);
      addActivity(`${smith?.name} finished forging a ${job.recipe}.`, "good");
    });
  }, [colony.day]);
  useEffect(() => {
    openOrders.current = colony.crafting;
  }, [colony.crafting]);

  function assignDwarf(id: string, assignment: JobType) {
    // D1: a dwarf on an expedition cannot take a second activity.
    if (
      colony.dwarves.find((item) => item.id === id)?.status === "expedition"
    ) {
      return;
    }
    // D3: a smith stays at the forge until the order is done or cancelled.
    if (isCrafting(colony, id)) {
      addActivity("Finish or cancel the forge order first.", "warning");
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

  function beginCraft(dwarfId: string, recipe: Recipe) {
    const smith = colony.dwarves.find((item) => item.id === dwarfId);
    if (!smith || !canCraft(colony, dwarfId)) {
      addActivity("Choose a free, fed dwarf working at the forge.", "warning");
      return;
    }
    if (!canAfford(colony.resources, recipes[recipe].cost)) {
      addActivity(`Not enough materials to forge a ${recipe}.`, "warning");
      return;
    }
    setColony((current) => startCraft(current, dwarfId, recipe));
    addActivity(
      `${smith.name} started a ${recipe}, ready on day ${colony.day + recipes[recipe].days}.`,
    );
  }

  function stopCraft(dwarfId: string) {
    const smith = colony.dwarves.find((item) => item.id === dwarfId);
    if (!smith || !isCrafting(colony, dwarfId)) return;
    setColony((current) => cancelCraft(current, dwarfId));
    addActivity(`${smith.name} cancelled the order. Materials refunded.`);
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf || inFlight.current || !canExplore(colony, dwarfId)) {
      addActivity(
        `${dwarf?.name ?? "This dwarf"} can't leave now (away, hungry or forging).`,
        "warning",
      );
      return;
    }

    inFlight.current = true;
    setExpeditionPending(true);
    setColony((current) => departExpedition(current, dwarfId));
    addActivity(`${dwarf.name} departed for ${destination.replace("-", " ")}.`);

    try {
      const result = await beginExpedition(dwarfId, destination);
      setColony((current) =>
        returnFromExpedition(current, dwarfId, result.rewards),
      );
      addActivity(result.message, "good");
    } catch (error) {
      // D4: failed request: no rewards, dwarf comes home
      setColony((current) => returnFromExpedition(current, dwarfId));
      addActivity(
        `${error instanceof Error ? error.message : "The expedition was lost from view."} ${dwarf.name} returned empty-handed.`,
        "warning",
      );
    } finally {
      inFlight.current = false;
      setExpeditionPending(false);
    }
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
    startCraft: beginCraft,
    cancelCraft: stopCraft,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
