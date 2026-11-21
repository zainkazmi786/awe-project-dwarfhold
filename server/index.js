import cors from "cors";
import express from "express";

const app = express();
const port = Number(process.env.PORT ?? 4200);
let expeditionNumber = 16;

const outcomes = {
  "crystal-cave": { rewards: { stone: 8, tools: 1 }, message: "The scout found a crystal seam and an abandoned mason's tool." },
  "old-mine": { rewards: { stone: 12, wood: 2 }, message: "The old mine still holds good stone and usable supports." },
  // D6: the university always offers a recruit; the client accepts only the first one
  university: {
    rewards: { food: 2 },
    message: "At the university gates the scout met an exhausted working student looking for a place to sleep.",
    recruit: { species: "working-student", name: "Mira Nightshift", title: "Working Student" },
  },
};

app.use(cors()); app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "dwarfhold" }));

app.post("/api/expeditions", (req, res) => {
  // simulated latency
  const latency = Math.max(0, Math.min(5000, Number(req.query.latency ?? process.env.API_LATENCY ?? 2000)));

  setTimeout(() => {
    const { dwarfId, destination } = req.body ?? {};

    if (typeof dwarfId !== "string" || typeof destination !== "string") {
      return res.status(400).json({ error: "dwarfId and destination are required" });
    }
    if (req.query.fail === "true" || destination === "blocked-pass") {
      return res.status(503).json({ error: "Rockfall has sealed the route. The company heard no signal." });
    }
    
    const outcome = outcomes[destination];
    
    if (!outcome) return res.status(404).json({ error: "That destination is not on the hold map" });
    
    expeditionNumber += 1;
    
    res.json({ expeditionId: `exp-${expeditionNumber}`, status: "completed", ...outcome });
  }, latency);
});

app.listen(port, () => console.log(`Dwarfhold API listening on http://localhost:${port}`));
