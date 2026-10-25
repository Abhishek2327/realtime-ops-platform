# Real‑Time Operations Platform

## Overview
A full‑stack assignment that demonstrates a real‑time operations dashboard. It includes a Node/Express backend exposing REST APIs for devices, events, rules, incidents and an SSE endpoint (`/api/stream`). A React + Vite frontend displays live device status, recent events, incidents and statistics. A simulator generates events, supports temporary disconnections, buffers events offline and replays them on reconnection.

## Technology Stack
- **Backend**: Node 20, Express, Mongoose (MongoDB), EventEmitter for SSE.
- **Frontend**: React 19, Vite, oxlint for linting.
- **Simulator**: `server/src/simulator/cli.js`.
- **Database**: MongoDB Atlas (connection via `.env`).

## Prerequisites
- Node >= 20
- MongoDB Atlas connection string (set in `.env`).
- Docker (optional) for local MongoDB via `docker-compose.yml`.

## Installation
```bash
# Clone the repo (already done)
cd realtime-ops-platform

# Install root scripts
npm install

# Install client and server dependencies
npm run install:all   # runs `npm ci` in ./client and ./server
```

## Running the application
```bash
# Backend (watch mode)
npm run dev --workspace=server   # node --watch src/index.js

# Frontend (Vite dev server)
npm run dev --workspace=client   # vite
```
The frontend proxies API calls to `http://localhost:5000`.

## API Overview
- `GET /api/devices` – list devices.
- `GET /api/events` – list events (supports `page` & `limit`).
- `POST /api/events` – ingest a new event (validates required fields, timestamps, duplicate `eventId`). Emits SSE updates for the event and device.
- `GET /api/rules` – list rule definitions.
- `GET /api/incidents` – list incidents; `POST /api/incidents/:id/acknowledge` and `POST /api/incidents/:id/resolve` to manage them.
- `GET /api/stream` – Server‑Sent Events stream. Events are sent with `event: event`, `event: device`, `event: incident` types.
- `GET /api/health` – health check, returns `{ "status": "ok", "database": "connected|disconnected" }`.

## Testing
```bash
npm test   # runs `node --test` in the server workspace
```
All tests pass (14 assertions, exit code 0).

## Simulator usage
```bash
node src/simulator/cli.js start          # start event generation
node src/simulator/cli.js disconnect    # simulate loss of connection
node src/simulator/cli.js reconnect     # reconnect and flush buffered events
```
State is persisted in `simulator_state.json`.

## Deployment notes
- Use `docker-compose.yml` to run a local MongoDB instance.
- For production, run `npm start` (server) behind a reverse proxy and serve the built client (`npm run build`).
- Health endpoint can be used by orchestration tools.

## Known limitations
- Offline buffer is stored locally; not shared across multiple instances.
- No authentication/authorization.
- Event ordering relies on timestamps; extreme clock skew may affect deduplication.
- No TLS/HTTPS configuration in the assignment.
