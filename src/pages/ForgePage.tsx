import { Chronicle } from "../components/Chronicle";
import { recipes } from "../simulation";
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
  const { activities, craft } = useColony();

  return (
    <div className="forge-layout">
      <div className="recipe-stack">
        {(Object.keys(recipes) as Recipe[]).map((recipe) => (
          <section className="panel forge" key={recipe}>
            <div>
              <small>EMBER FORGE</small>
              <h2>{recipeInfo[recipe].title}</h2>
              <p>{recipeInfo[recipe].text}</p>
            </div>
            <div className="recipe">
              <span>{recipes[recipe].cost.wood} 🪵</span>
              <i>+</i>
              <span>{recipes[recipe].cost.stone} 🪨</span>
              <i>→</i>
              <span>1 {recipeInfo[recipe].icon}</span>
              <button onClick={() => craft(recipe)}>Forge {recipe}</button>
            </div>
          </section>
        ))}
      </div>

      <Chronicle activities={activities} />
    </div>
  );
}
