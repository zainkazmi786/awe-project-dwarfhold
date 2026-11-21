import type { Resources } from "../types";

const details = {
  wood: ["🪵", "Timber"],
  stone: ["🪨", "Stone"],
  food: ["🍄", "Rations"],
  tools: ["⚒️", "Tools in storage"],
  weapons: ["🗡️", "Weapons"],
} as const;

export function ResourceBar({ resources }: { resources: Resources }) {
  return (
    <section className="resource-bar">
      {Object.entries(resources).map(([key, value]) => {
        const [icon, label] = details[key as keyof Resources];

        return (
          <article key={key}>
            <span>{icon}</span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}
