# Expedition API

`POST /api/expeditions` accepts JSON containing string `dwarfId` and `destination`. A successful response contains an expedition id, `completed` status, a partial resource reward, and a narrative message. Invalid input returns 400, an unknown destination returns 404, and `blocked-pass` or `?fail=true` returns 503.

The deterministic result arrives after a configurable delay and there is no polling or server-side persisted task. Restarting the server resets expedition numbering. During Vite development, `/api` is proxied to port 4200.

## D6: `university` destination

A successful trip to `university` also returns a `recruit` object:

```json
{ "expeditionId": "exp-17", "status": "completed", "rewards": { "food": 2 },
  "message": "At the university gates…",
  "recruit": { "species": "working-student", "name": "Mira Nightshift", "title": "Working Student" } }
```

The server is stateless and returns the recruit on **every** successful university trip. The client accepts it only once (`ColonyState.recruited`), because the colony state lives on the client and is saved there (D5). `?fail=true` returns 503 with no recruit.

## D7: `goblin-warrens` destination

A successful trip returns `rewards: { stone: 6 }` and `attack: { force: 6 }`. The force can be changed for demos with the `ATTACK_FORCE` environment variable (e.g. `ATTACK_FORCE=100 npm run dev`). The client resolves the raid (`resolveAttack`). `?fail=true` returns 503 and no attack.
