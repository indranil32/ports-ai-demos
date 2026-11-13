// Small Express server that does two jobs:
//  1. Proxies POST /api/messages to the Anthropic Messages API, attaching the API key
//     server-side so it never reaches the browser (and sidesteps corporate TLS-inspection
//     proxies that break direct browser -> api.anthropic.com calls).
//  2. Serves the built front end from ./dist.
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT) || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL_OVERRIDE = (process.env.ANTHROPIC_MODEL || '').trim();
const DEMO_PASSWORD = (process.env.DEMO_PASSWORD || '').trim();
const MAX_TOKENS_CAP = Number(process.env.MAX_TOKENS_CAP) || 4000;
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN) || 60;

if (!API_KEY) {
  console.warn('[warn] ANTHROPIC_API_KEY is not set — AI features will return an error until it is.');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

// Optional shared-password gate for external demos (HTTP Basic auth; any username).
if (DEMO_PASSWORD) {
  app.use((req, res, next) => {
    if (req.path === '/healthz') return next();
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const password = decoded.slice(decoded.indexOf(':') + 1);
      if (password === DEMO_PASSWORD) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="AD Ports AI demos"');
    return res.status(401).send('Authentication required');
  });
}

app.get('/healthz', (_req, res) => res.json({ ok: true, keyConfigured: Boolean(API_KEY), model: MODEL_OVERRIDE || '(client-specified)' }));

// Very small in-memory rate limiter so a shared demo link can't run up the bill.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const windowStart = now - 60_000;
  const list = (hits.get(key) || []).filter((t) => t > windowStart);
  if (list.length >= RATE_LIMIT_PER_MIN) {
    return res.status(429).json({ type: 'error', error: { type: 'rate_limited', message: `Demo rate limit reached (${RATE_LIMIT_PER_MIN}/min). Wait a moment and retry.` } });
  }
  list.push(now);
  hits.set(key, list);
  next();
}

app.post('/api/messages', express.json({ limit: '25mb' }), rateLimit, async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ type: 'error', error: { type: 'config_error', message: 'ANTHROPIC_API_KEY is not set on the server. Add it to .env and restart.' } });
  }
  const body = { ...(req.body || {}) };
  if (MODEL_OVERRIDE) body.model = MODEL_OVERRIDE;
  if (typeof body.max_tokens !== 'number' || body.max_tokens > MAX_TOKENS_CAP) {
    body.max_tokens = Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP);
  }
  delete body.stream; // the prototypes expect a single JSON response

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch (err) {
    console.error('[proxy] upstream error', err);
    res.status(502).json({ type: 'error', error: { type: 'proxy_error', message: `Could not reach api.anthropic.com: ${err.message}` } });
  }
});

// Static front end (after `npm run build`).
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  // Express 5 rejects app.get('*'); a trailing middleware is the SPA fallback.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => res.send('Front end not built yet. Run `npm run build`, or use `npm run dev` and open http://localhost:5173.'));
}

app.listen(PORT, () => {
  console.log(`AD Ports AI demos — server listening on http://localhost:${PORT}`);
  console.log(`  model: ${MODEL_OVERRIDE || 'as requested by each prototype'} | password gate: ${DEMO_PASSWORD ? 'on' : 'off'}`);
});
