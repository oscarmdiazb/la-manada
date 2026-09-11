// La Manada — servidor local (Node >= 22). Lógica en core.mjs. Estado en Supabase (app_state).
const { loadState, saveState } = require('./lib/supabase-state');
const { APP, EMPTY, routes, MIME } = require('./core.mjs');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3212;
const FAMILY_PIN = process.env.FAMILY_PIN || ''; // vacío = sin clave
const PUBLIC = path.join(__dirname, 'public');

let state = EMPTY();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(APP, state).catch(e => console.error('[supabase] save failed:', e.message)), 150);
}

// SSE
const clients = new Set();
function broadcast() {
  const msg = `data: ${JSON.stringify({ v: Date.now() })}\n\n`;
  for (const res of clients) { try { res.write(msg); } catch (e) { clients.delete(res); } }
}
setInterval(() => { for (const res of clients) { try { res.write(': ping\n\n'); } catch (e) { clients.delete(res); } } }, 25000);

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch (e) { reject(e); } });
  });
}

const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p.startsWith('/api/')) {
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/api/ping') return json(res, 200, { ok: true, pin: !!FAMILY_PIN });
    if (FAMILY_PIN && req.headers['x-pin'] !== FAMILY_PIN) return json(res, 401, { error: 'pin' });
    if (p === '/api/state' && req.method === 'GET') return json(res, 200, { state, serverTime: Date.now() });
    const h = req.method === 'POST' && routes[p.slice(5)];
    if (!h) return json(res, 404, { error: 'No existe' });
    try {
      const out = h(state, await readBody(req));
      save(); broadcast();
      return json(res, 200, out);
    } catch (e) { return json(res, 400, { error: e.message || 'Error' }); }
  }
  let file = p === '/' ? '/index.html' : p;
  const full = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

server.on('error', e => { console.error('No pude arrancar:', e.message); process.exit(1); });
loadState(APP).then(saved => {
  state = Object.assign(EMPTY(), saved || {});
  server.listen(PORT, () => console.log(`La Manada 🐺 → http://localhost:${PORT}  (datos en Supabase/app_state${FAMILY_PIN ? ', con PIN' : ', sin PIN'})`));
}).catch(e => { console.error('[supabase] no pude cargar el estado:', e.message); process.exit(1); });
