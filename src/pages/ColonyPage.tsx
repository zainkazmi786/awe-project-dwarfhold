import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import {
  dailyOutput as outputOf,
  eatsColonyFood,
  jobLabel,
  production,
} from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { ResourceKey } from "../types";

export function ColonyPage() {
  const {
    colony,
    activities,
    expeditionPending,
    assignDwarf,
    equipTool,
    returnTool,
    sendExpedition,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  // Same rules as advanceDay: only producing dwarves count, only present dwarves eat.
  const dailyOutput = colony.dwarves.reduce<Record<ResourceKey, number>>(
    (total, dwarf) => {
      Object.entries(outputOf(dwarf)).forEach(([resource, amount]) => {
        total[resource as ResourceKey] += amount ?? 0;
      });
      return total;
    },
    {
      wood: 0,
      stone: 0,
      food: -colony.dwarves.filter(eatsColonyFood).length,
      tools: 0,
      weapons: 0,
    },
  );

  return (
    <div className="dashboard">
      <DwarfRoster
        dwarves={colony.dwarves}
        toolsInStorage={colony.resources.tools}
        crafting={colony.crafting}
        onAssign={assignDwarf}
        onEquip={equipTool}
        onReturn={returnTool}
      />

      <section className="center-stack">
        <section className="panel production">
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          <div className="job-grid">
            {(["woodcutting", "mining", "farming"] as const).map((job) => (
              <article key={job}>
                <b>
                  {job === "woodcutting"
                    ? "🌲"
                    : job === "mining"
                      ? "⛏️"
                      : "🍄"}
                </b>
                <h3>{jobLabel(job)}</h3>
                <p>
                  {
                    colony.dwarves.filter((dwarf) => dwarf.assignment === job)
                      .length
                  }{" "}
                  assigned
                </p>
                <strong>+{Object.values(production[job])[0]} / day</strong>
              </article>
            ))}
          </div>

          <div className="net-line">
            <span>NET FOOD AFTER MEALS</span>
            <strong className={dailyOutput.food >= 0 ? "gain" : "loss"}>
              {dailyOutput.food >= 0 ? "+" : ""}
              {dailyOutput.food}
            </strong>
          </div>
          <p className="food-rule">
            Each dwarf at home eats 1 ration at the end of the day, in roster
            order. Dwarves on expedition forage for themselves. A dwarf who gets
            no ration goes hungry and produces nothing the next day.
          </p>
          <p className="food-rule">
            An equipped tool adds +1 of the dwarf's resource per day while they
            work.
          </p>
        </section>
      </section>

      <aside className="side-stack">
        <section className="panel expedition">
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          <label>
            Scout
            <select
              value={expeditionDwarf}
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destination
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="crystal-cave">Crystal Cave</option>
              <option value="old-mine">The Old Mine</option>
              <option value="blocked-pass">Blocked Pass</option>
            </select>
          </label>

          <button
            disabled={expeditionPending}
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {expeditionPending ? "Beyond the gate…" : "Send expedition"}
          </button>
          <p>
            A result returns in one request. The selected dwarf is unavailable
            while travelling.
          </p>
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}
