import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import {
  attackMessage,
  canExplore,
  dailyOutput as outputOf,
  eatsColonyFood,
  jobLabel,
  production,
  speciesTraits,
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
      // D6: appetite per species
      food: -colony.dwarves
        .filter(eatsColonyFood)
        .reduce((sum, dwarf) => sum + speciesTraits[dwarf.species].appetite, 0),
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
                <strong>
                  🧔 +{Object.values(production[job])[0]} / day
                  {colony.recruited && (
                    <>
                      {" · 🎓 +"}
                      {
                        Object.values(
                          speciesTraits["working-student"].production[job],
                        )[0]
                      }
                    </>
                  )}
                </strong>
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
            At the end of the day everyone at home eats, in roster order: a
            dwarf eats 1 ration, a working student 2. Anyone who can't get their
            full meal eats nothing, goes hungry and produces nothing the next
            day. Travellers forage for themselves.
          </p>
          <p className="food-rule">
            An equipped tool adds +1 of the dwarf's resource per day while they
            work.
          </p>
        </section>
      </section>

      <aside className="side-stack">
        {colony.lastAttack && (
          <section
            className={`panel raid ${colony.lastAttack.defended ? "held" : "lost"}`}
          >
            <small>GOBLIN RAID · DAY {colony.lastAttack.day}</small>
            <h2>
              {colony.lastAttack.defended
                ? "Stonehome held"
                : "Stonehome was looted"}
            </h2>
            <p>{attackMessage(colony.lastAttack)}</p>
          </section>
        )}

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
                <option
                  key={dwarf.id}
                  value={dwarf.id}
                  disabled={!canExplore(colony, dwarf.id)}
                >
                  {dwarf.name}
                  {canExplore(colony, dwarf.id) ? "" : " (unavailable)"}
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
              <option value="university">The University 🎓</option>
              <option value="goblin-warrens">Goblin Warrens ⚠️</option>
            </select>
          </label>
          {destination === "goblin-warrens" && (
            <p className="raid-hint">
              Goblins follow a successful scout home. Each attacker breaks 1
              weapon. If more attackers than weapons arrive, the rest loot
              tools, then stone, then wood, then food. Nothing left = Stonehome
              falls. You have {colony.resources.weapons} 🗡️.
            </p>
          )}
          {destination === "university" && (
            <p className="recruit-hint">
              {colony.recruited
                ? "The working student already lives in Stonehome. Nobody else will join."
                : "Rumour says an exhausted working student at the university needs a home. The first successful trip brings them to Stonehome."}
            </p>
          )}

          <button
            disabled={expeditionPending}
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {expeditionPending ? "Beyond the gate…" : "Send expedition"}
          </button>
          <p>
            Only a fed dwarf at home who is not forging can leave. The dwarf is
            unavailable while travelling and takes an equipped tool along. A
            failed trip brings the dwarf back with no rewards. If the page is
            refreshed during a trip, the expedition resumes automatically.
          </p>
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}
