// Shared helper: load/save one JSON state per app in Supabase table app_state.
// No dependencies (Node >= 18, uses fetch). Reads keys from ../.env.supabase.
const fs = require('fs');
const path = require('path');

function loadEnv() {
  // 1) variables de entorno (Railway, launchd); 2) archivo .env.supabase (local)
  const env = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY };
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) return env;
  for (const f of [path.join(__dirname, '..', '.env.supabase'), path.join(__dirname, '..', '..', '.env.supabase')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim();
    }
    break;
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY (env o .env.supabase)');
  return env;
}
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadEnv();
const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function loadState(app) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_state?app=eq.${app}&select=state`, { headers });
  if (!r.ok) throw new Error(`supabase load ${r.status}: ${await r.text()}`);
  const rows = await r.json();
  return rows[0] ? rows[0].state : null;
}

async function saveState(app, state) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_state?on_conflict=app`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ app, state, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`supabase save ${r.status}: ${await r.text()}`);
}

module.exports = { loadState, saveState };
