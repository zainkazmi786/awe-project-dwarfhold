import { jobLabel } from "../simulation";
import type { Dwarf, JobType } from "../types";

const jobs: Exclude<JobType, null>[] = ["woodcutting", "mining", "farming"];

interface Props {
  dwarves: Dwarf[];
  toolsInStorage: number;
  onAssign: (id: string, job: JobType) => void;
  onEquip: (id: string) => void;
  onReturn: (id: string) => void;
}

export function DwarfRoster({
  dwarves,
  toolsInStorage,
  onAssign,
  onEquip,
  onReturn,
}: Props) {
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentDwarves} / {dwarves.length} present
        </span>
      </header>

      <div className="dwarf-list">
        {dwarves.map((dwarf) => {
          const isAway = dwarf.status === "expedition";
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : "Generalist";

          return (
            <article className={isAway ? "dwarf away" : "dwarf"} key={dwarf.id}>
              <div className="portrait">
                {dwarf.icon}
                <i className={dwarf.status} />
              </div>

              <div className="dwarf-details">
                <h3>{dwarf.name}</h3>
                <p>
                  {dwarf.title} · {specialty}
                </p>

                <select
                  value={dwarf.assignment ?? ""}
                  disabled={isAway}
                  onChange={(event) =>
                    onAssign(dwarf.id, (event.target.value || null) as JobType)
                  }
                >
                  <option value="">Unassigned</option>
                  {jobs.map((job) => (
                    <option value={job} key={job}>
                      {jobLabel(job)}
                    </option>
                  ))}
                </select>

                {dwarf.hasTool ? (
                  <button
                    className="tool-btn"
                    disabled={isAway}
                    onClick={() => onReturn(dwarf.id)}
                  >
                    Return tool
                  </button>
                ) : (
                  <button
                    className="tool-btn"
                    disabled={isAway || toolsInStorage < 1}
                    title={
                      toolsInStorage < 1 ? "No tools in storage" : undefined
                    }
                    onClick={() => onEquip(dwarf.id)}
                  >
                    Equip tool
                  </button>
                )}
              </div>

              <span className="status">
                {dwarf.status}
                {dwarf.hasTool && <em className="tool">⚒️ equipped</em>}
                {dwarf.hungry && (
                  <em
                    className="hungry"
                    title="Not fed at the last meal — produces nothing until fed."
                  >
                    🍽️ hungry
                  </em>
                )}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
