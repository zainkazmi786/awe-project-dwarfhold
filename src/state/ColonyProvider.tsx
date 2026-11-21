import { useEffect, useRef, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import {
  advanceDay,
  attackMessage,
  canAfford,
  canCraft,
  canExplore,
  canForge,
  cancelCraft,
  craftDaysFor,
  departExpedition,
  equipTool,
  finishedJobs,
  isCrafting,
  jobLabel,
  recipes,
  returnFromExpedition,
  returnTool,
  speciesTraits,
  startCraft,
} from "../simulation";
import type { Activity, ColonyState, JobType, Recipe } from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";
import { loadSave, writeSave, type SaveData } from "./persistence";

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
      species: "dwarf",
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
      species: "dwarf",
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
      species: "dwarf",
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
  recruited: false,
  lastAttack: null,
  destroyed: false,
};

const welcome: Activity = {
  id: "welcome",
  day: initialState.day,
  message: "The forge fires are lit. Stonehome wakes.",
};

/**
 * D5: builds the starting state from localStorage.
 * - valid save: restore it and log what continues (forge orders, expeditions)
 * - corrupt / incompatible save: start a new colony and say so
 * - no save: start a new colony
 */
function boot(): SaveData {
  const result = loadSave();

  if (result.status === "invalid") {
    return {
      colony: initialState,
      activities: [
        {
          id: crypto.randomUUID(),
          day: initialState.day,
          message:
            result.reason === "incompatible"
              ? "The saved colony is from an older version — a new colony was founded."
              : "The saved colony was unreadable — a new colony was founded.",
          tone: "warning",
        },
        welcome,
      ],
    };
  }
  if (result.status === "empty") {
    return { colony: initialState, activities: [welcome] };
  }

  const { colony, activities } = result.data;
  const notes: Activity[] = [
    ...colony.crafting.map((job) => ({
      id: crypto.randomUUID(),
      day: colony.day,
      message: `Forge order resumed: ${colony.dwarves.find((d) => d.id === job.dwarfId)?.name}'s ${job.recipe} is ready on day ${job.readyDay}.`,
    })),
    ...colony.dwarves
      .filter((dwarf) => dwarf.status === "expedition")
      .map((dwarf) => ({
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${dwarf.name}'s expedition to ${dwarf.destination?.replace("-", " ")} resumed after the refresh.`,
      })),
    {
      id: crypto.randomUUID(),
      day: colony.day,
      message: `Colony restored on day ${colony.day}.`,
      tone: "good" as const,
    },
  ];
  return { colony, activities: [...notes, ...activities].slice(0, 6) };
}

export function ColonyProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: localStorage is read once, on the first render.
  const [start] = useState(boot);
  const [colony, setColony] = useState(start.colony);
  const [paused, setPaused] = useState(false);
  const [expeditionPending, setExpeditionPending] = useState(false);
  const [activities, setActivities] = useState<Activity[]>(start.activities);

  // D5: save after every change of the colony or the log.
  useEffect(() => {
    writeSave({ colony, activities });
  }, [colony, activities]);

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
    if (paused || colony.destroyed) return;

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [paused, colony.destroyed]);

  // D1: after each day's meal, report dwarves who went hungry.
  // Done in an effect (not inside advanceDay / the setColony updater) so the
  // message is logged once per day even if React re-runs state updaters.
  // D5: the ref skips the first run, so a restored hungry dwarf isn't reported again on every refresh.
  const hungerLoggedDay = useRef(colony.day);
  useEffect(() => {
    if (hungerLoggedDay.current === colony.day) return;
    hungerLoggedDay.current = colony.day;
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

  // D6: announce the new resident once, when `recruited` flips to true.
  // Starts from the loaded value, so a restored colony doesn't announce again.
  const wasRecruited = useRef(colony.recruited);
  useEffect(() => {
    if (wasRecruited.current || !colony.recruited) return;
    wasRecruited.current = true;
    const student = colony.dwarves.find((dwarf) => dwarf.species !== "dwarf");
    if (student) {
      addActivity(
        `${student.name} the ${speciesTraits[student.species].label} joined Stonehome!`,
        "good",
      );
    }
  }, [colony.recruited]);

  // D7: log a new raid once. Starts from the loaded report, so a refresh doesn't log it again.
  const loggedAttack = useRef(colony.lastAttack);
  useEffect(() => {
    const attack = colony.lastAttack;
    if (!attack || attack === loggedAttack.current) return;
    loggedAttack.current = attack;
    addActivity(attackMessage(attack), attack.defended ? "good" : "warning");
  }, [colony.lastAttack]);

  function restart() {
    setColony(initialState);
    setActivities([welcome]);
  }

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
    // D6: species limitation (working students cannot forge weapons)
    if (!canForge(colony, dwarfId, recipe)) {
      addActivity(
        `${smith.name} cannot forge a ${recipe} (${speciesTraits[smith.species].label}).`,
        "warning",
      );
      return;
    }
    if (!canAfford(colony.resources, recipes[recipe].cost)) {
      addActivity(`Not enough materials to forge a ${recipe}.`, "warning");
      return;
    }
    setColony((current) => startCraft(current, dwarfId, recipe));
    addActivity(
      `${smith.name} started a ${recipe}, ready on day ${colony.day + craftDaysFor(smith, recipe)}.`,
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
    setColony((current) => departExpedition(current, dwarfId, destination));
    addActivity(`${dwarf.name} departed for ${destination.replace("-", " ")}.`);

    await runTrip(dwarfId, dwarf.name, destination);
  }

  /** D4/D5: the server request and its result. Caller sets inFlight and pending first. */
  async function runTrip(dwarfId: string, name: string, destination: string) {
    try {
      const result = await beginExpedition(dwarfId, destination);
      setColony((current) =>
        returnFromExpedition(
          current,
          dwarfId,
          result.rewards,
          result.recruit,
          result.attack,
        ),
      );
      addActivity(result.message, "good");
    } catch (error) {
      // D4: failed request: no rewards, dwarf comes home
      setColony((current) => returnFromExpedition(current, dwarfId));
      addActivity(
        `${error instanceof Error ? error.message : "The expedition was lost from view."} ${name} returned empty-handed.`,
        "warning",
      );
    } finally {
      inFlight.current = false;
      setExpeditionPending(false);
    }
  }

  // D5: a trip interrupted by a refresh is sent to the server again (no second departure).
  // StrictMode runs this effect twice in dev; inFlight blocks the second send.
  useEffect(() => {
    const traveller = colony.dwarves.find(
      (dwarf) => dwarf.status === "expedition" && dwarf.destination,
    );
    if (!traveller || inFlight.current) return;

    inFlight.current = true;
    setExpeditionPending(true);
    void runTrip(traveller.id, traveller.name, traveller.destination!);
  }, []); // only on mount

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
    restart,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}
