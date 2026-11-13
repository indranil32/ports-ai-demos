# AD Ports Group — Agentic AI Prototypes

Four working prototypes, served from one app, each calling the live Claude API:

| Demo | Route | What it shows |
|---|---|---|
| **Quaywatch** | `/#/quaywatch` | HSE incident intelligence: text/voice/photo intake, AI classification (category, actual vs potential severity, contributing factors), rule engine, TRIR/LTIFR, ISO 45001-aligned report, SENYAR CSV import, ISO-aligned JSON export |
| **Agentic Lease Auditor** | `/#/lease-auditor` | Multi-turn tool-calling loop over Maximo-shaped asset/lease data with a human approval gate before any financial or legal action |
| **Executive Digital Twin** | `/#/digital-twin` | Ten-domain scored dashboard, Daily Brief, newsletter, Ask the Chief of Staff, What-If simulator |
| **Cargo Copilot** | `/#/cargo-copilot` | Customer-facing exception management on ATLP-shaped shipments, deterministic demurrage, approve/reject with AI-vs-human values logged |

Design principles carried through all four: the model reasons and chooses what to look up; every monetary or safety-rate figure is computed in code; every consequential action waits for a human; AI-suggested and human-confirmed values are stored side by side.

All data is synthetic and illustrative.

## Run it locally

Requires Node 20+.

```bash
git clone https://github.com/indranil32/ports-ai-demos.git
cd ports-ai-demos
npm install
cp .env.example .env        # then put your key in ANTHROPIC_API_KEY
npm run dev                 # http://localhost:5173
```

`npm run dev` starts two processes: the Vite front end (port 5173) and a small Express server (port 8787) that forwards `/api/messages` to Anthropic with your key attached. The key never reaches the browser.

To run it the way it will run in production:

```bash
npm run build
npm start                   # http://localhost:8787
```

## Configuration (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Your key from console.anthropic.com |
| `ANTHROPIC_MODEL` | no | Forces every prototype onto one model (default in `.env.example`: `claude-sonnet-5`). Leave blank to use what each prototype requests. |
| `DEMO_PASSWORD` | no | Puts the whole site behind a shared password (browser login prompt, any username). **Set this before sharing a public URL** — otherwise anyone with the link spends your API credit. |
| `RATE_LIMIT_PER_MIN` | no | Per-IP request cap on the proxy (default 60) |
| `MAX_TOKENS_CAP` | no | Upper bound on `max_tokens` per request (default 4000) |

## Demoing externally

You need somewhere that runs the Node server (GitHub Pages alone can't — it can't hold the API key). Two easy options:

**Render (free tier, ~5 minutes)**
1. render.com → New + → Blueprint → select this repo (it picks up `render.yaml`).
2. Enter `ANTHROPIC_API_KEY` and `DEMO_PASSWORD` when prompted.
3. Share the `*.onrender.com` URL plus the password. Free instances sleep after inactivity; open the link a minute before you present.

**Docker (Azure App Service, any VM, etc.)**
```bash
docker build -t adports-ai-demos .
docker run -p 8787:8787 --env-file .env adports-ai-demos
```

**Presenting from a laptop on the corporate network:** run `npm run build && npm start` locally. Because the browser talks only to `localhost` and the server makes the outbound call, this avoids the TLS-inspection proxy issue that breaks direct browser-to-API calls. Keep a phone hotspot as a fallback.

## How this differs from the Claude.ai artifacts

- API calls go to `/api/messages` (the local proxy) instead of `https://api.anthropic.com/v1/messages`.
- Quaywatch's `window.storage` is replaced by a `localStorage` shim (`src/lib/storage-shim.js`), so incidents and rules persist per browser rather than being shared across users.
- Otherwise the prototype source in `src/prototypes/` is unchanged from the project files.

## Project layout

```
server/index.js            Express: API proxy + static hosting
src/App.jsx                Landing page and hash routing
src/prototypes/*.jsx       The four prototypes
src/lib/storage-shim.js    window.storage → localStorage
render.yaml, Dockerfile    Deployment
```
