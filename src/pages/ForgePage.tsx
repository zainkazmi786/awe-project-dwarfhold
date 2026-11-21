import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { canCraft, recipes } from "../simulation";
import { useColony } from "../state/ColonyContext";
import type { Recipe } from "../types";

const recipeInfo: Record<
  Recipe,
  { title: string; text: string; icon: string }
> = {
  tool: {
    title: "Craft a tool",
    text: "Equip a dwarf: +1 of their resource per day.",
    icon: "⚒️",
  },
  weapon: {
    title: "Craft a weapon",
    text: "Stored in the armoury to defend Stonehome.",
    icon: "🗡️",
  },
};

export function ForgePage() {
  const { colony, activities, startCraft, cancelCraft } = useColony();
  const smiths = colony.dwarves.filter((dwarf) => canCraft(colony, dwarf.id));
  const [picked, setPicked] = useState("");
  // Falls back to the first free smith if the picked one became busy.
  const smithId = smiths.some((dwarf) => dwarf.id === picked)
    ? picked
    : (smiths[0]?.id ?? "");

  return (
    <div className="forge-layout">
      <div className="recipe-stack">
        <section className="panel forge-orders">
          <small>EMBER FORGE</small>
          <h2>Forging now</h2>
          {colony.crafting.length === 0 && <p>The anvils are quiet.</p>}
          {colony.crafting.map((job) => {
            const smith = colony.dwarves.find((d) => d.id === job.dwarfId);
            return (
              <div className="order" key={job.dwarfId}>
                <span>
                  {smith?.icon} {smith?.name} · {recipeInfo[job.recipe].icon}{" "}
                  {job.recipe}
                </span>
                <b>ready on day {job.readyDay}</b>
                <button onClick={() => cancelCraft(job.dwarfId)}>Cancel</button>
              </div>
            );
          })}
          <label>
            Smith
            <select
              value={smithId}
              onChange={(event) => setPicked(event.target.value)}
            >
              {smiths.length === 0 && <option value="">No free smith</option>}
              {smiths.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Only fed dwarves assigned to the Ember Forge can craft, one order
            each. Materials are paid at the start.
          </p>
        </section>

        {(Object.keys(recipes) as Recipe[]).map((recipe) => (
          <section className="panel forge" key={recipe}>
            <div>
              <small>{recipes[recipe].days} DAYS</small>
              <h2>{recipeInfo[recipe].title}</h2>
              <p>{recipeInfo[recipe].text}</p>
            </div>
            <div className="recipe">
              <span>{recipes[recipe].cost.wood} 🪵</span>
              <i>+</i>
              <span>{recipes[recipe].cost.stone} 🪨</span>
              <i>→</i>
              <span>1 {recipeInfo[recipe].icon}</span>
              <button onClick={() => startCraft(smithId, recipe)}>
                Forge {recipe}
              </button>
            </div>
          </section>
        ))}
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}
