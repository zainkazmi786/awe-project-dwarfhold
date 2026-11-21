import { NavLink, Outlet } from "react-router";
import { ResourceBar } from "../components/ResourceBar";
import { useColony } from "../state/ColonyContext";

export function Layout() {
  const { colony, paused, togglePaused, restart } = useColony();

  return (
    <main>
      <header className="masthead">
        <div className="brand">
          <b>⛏</b>
          <div>
            <small>THE DEEP REALMS OF</small>
            <h1>
              Dwarf<span>hold</span>
            </h1>
          </div>
        </div>

        <div className="hold-title">
          <small>COLONY</small>
          <strong>STONEHOME</strong>
          <span>Founded beneath Emberpeak</span>
        </div>

        <div className="day">
          <small>DEEP DAY</small>
          <strong>{colony.day}</strong>
          <button onClick={togglePaused} disabled={colony.destroyed}>
            {paused ? "Wake the hold" : "Pause"}
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Colony navigation">
        <NavLink to="/" end>
          Colony
        </NavLink>
        <NavLink to="/forge">Forge</NavLink>
      </nav>

      <ResourceBar resources={colony.resources} />
      {colony.destroyed ? (
        <section className="panel fallen">
          <small>DAY {colony.day}</small>
          <h2>Stonehome has fallen</h2>
          <p>The goblins took everything that was left. The hold is empty.</p>
          <button onClick={restart}>Found a new colony</button>
        </section>
      ) : (
        <Outlet />
      )}

      <footer>
        <span>🔥 Forge: burning</span>
        <span>Next deep day in ~8 seconds</span>
        <span>{paused ? "The hold is resting" : "⚙ Simulation active"}</span>
      </footer>
    </main>
  );
}
