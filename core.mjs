// La Manada — lógica del juego, sin servidor. La usan server.js (Node local) y la Edge Function (Supabase).
// Cada ruta recibe (state, body) y muta state. Lanza Error con mensaje para el usuario.
export const APP = 'la-manada';
export const MISSIONS = ['move', 'veg', 'water', 'sugar'];
const COLORS = ['#2F6F5E', '#F25F5C', '#5FA8D3', '#FFB703', '#8E6BBF', '#E07A5F', '#3D9970', '#B5838D'];

export const EMPTY = () => ({
  members: {},     // id -> {id, name, emoji, color, createdAt}
  logs: {},        // 'YYYY-MM-DD' -> memberId -> { move: ts, veg: ts, water: ts, sugar: ts }
  feed: [],        // {id, ts, type, memberId, to, text, reactions: {emoji: [memberId]}}
  challenges: [],  // {id, ts, from, to, text, pts, done: {memberId: ts}}
  goal: {},        // weekKey -> {target, reward, setBy, ts}
  nudges: []       // {id, ts, from, to, mission, seen: bool}
});

const id = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('');
const now = () => Date.now();
const clean = (s, n = 80) => String(s == null ? '' : s).trim().slice(0, n);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);

function pushFeed(state, item) {
  state.feed.push(Object.assign({ id: id(), ts: now(), reactions: {} }, item));
  if (state.feed.length > 400) state.feed = state.feed.slice(-400);
}

export const routes = {
  'members': (state, b) => {
    const name = clean(b.name, 24);
    if (!name) throw new Error('Falta el nombre');
    const mid = id();
    const n = Object.keys(state.members).length;
    state.members[mid] = { id: mid, name, emoji: clean(b.emoji, 4) || '🙂', color: COLORS[n % COLORS.length], createdAt: now() };
    pushFeed(state, { type: 'join', memberId: mid, text: '' });
    return { member: state.members[mid] };
  },
  'members/update': (state, b) => {
    const m = state.members[b.id];
    if (!m) throw new Error('No existe');
    if (b.name) m.name = clean(b.name, 24);
    if (b.emoji) m.emoji = clean(b.emoji, 4);
    return { ok: true };
  },
  'log': (state, b) => {
    const m = state.members[b.memberId];
    if (!m) throw new Error('¿Quién eres? Escoge tu perfil');
    if (!MISSIONS.includes(b.mission)) throw new Error('Misión desconocida');
    if (!isDate(b.date)) throw new Error('Fecha inválida');
    const day = state.logs[b.date] = state.logs[b.date] || {};
    const mine = day[m.id] = day[m.id] || {};
    if (b.done === false) {
      delete mine[b.mission];
    } else {
      if (mine[b.mission]) return { ok: true };
      mine[b.mission] = now();
      pushFeed(state, { type: 'log', memberId: m.id, mission: b.mission, date: b.date });
      if (MISSIONS.every(k => mine[k])) pushFeed(state, { type: 'fullday', memberId: m.id, date: b.date });
      if (b.mission === 'move') {
        const movers = Object.keys(day).filter(k => day[k].move);
        if (movers.length === 2) pushFeed(state, { type: 'pack', memberId: m.id, date: b.date, with: movers });
      }
    }
    return { ok: true };
  },
  'react': (state, b) => {
    const f = state.feed.find(x => x.id === b.feedId);
    if (!f || !state.members[b.memberId]) throw new Error('No existe');
    const emoji = clean(b.emoji, 4);
    f.reactions[emoji] = f.reactions[emoji] || [];
    const i = f.reactions[emoji].indexOf(b.memberId);
    if (i >= 0) f.reactions[emoji].splice(i, 1); else f.reactions[emoji].push(b.memberId);
    if (!f.reactions[emoji].length) delete f.reactions[emoji];
    return { ok: true };
  },
  'challenge': (state, b) => {
    if (!state.members[b.from]) throw new Error('¿Quién eres?');
    if (b.to !== 'all' && !state.members[b.to]) throw new Error('Destino inválido');
    const text = clean(b.text, 80);
    if (!text) throw new Error('Escribe el reto');
    const pts = Math.max(5, Math.min(50, parseInt(b.pts, 10) || 15));
    const c = { id: id(), ts: now(), from: b.from, to: b.to, text, pts, done: {} };
    state.challenges.push(c);
    if (state.challenges.length > 300) state.challenges = state.challenges.slice(-300);
    pushFeed(state, { type: 'challenge', memberId: b.from, to: b.to, text, challengeId: c.id });
    return { challenge: c };
  },
  'challenge/done': (state, b) => {
    const c = state.challenges.find(x => x.id === b.id);
    const m = state.members[b.memberId];
    if (!c || !m) throw new Error('No existe');
    if (c.to !== 'all' && c.to !== m.id) throw new Error('Este reto no es para ti');
    if (c.done[m.id]) { delete c.done[m.id]; return { ok: true, undone: true }; }
    c.done[m.id] = now();
    pushFeed(state, { type: 'challenge_done', memberId: m.id, text: c.text, pts: c.pts, challengeId: c.id, from: c.from });
    return { ok: true };
  },
  'nudge': (state, b) => {
    if (!state.members[b.from] || !state.members[b.to]) throw new Error('No existe');
    if (b.from === b.to) throw new Error('No te empujes a ti mismo 😄');
    const recent = state.nudges.find(n => n.from === b.from && n.to === b.to && n.mission === b.mission && now() - n.ts < 3 * 3600e3);
    if (recent) throw new Error('Ya le diste un empujón hace poco. Déjalo respirar.');
    state.nudges.push({ id: id(), ts: now(), from: b.from, to: b.to, mission: b.mission || 'any', seen: false });
    if (state.nudges.length > 200) state.nudges = state.nudges.slice(-200);
    pushFeed(state, { type: 'nudge', memberId: b.from, to: b.to, mission: b.mission || 'any' });
    return { ok: true };
  },
  'nudge/seen': (state, b) => {
    state.nudges.forEach(n => { if (n.to === b.memberId) n.seen = true; });
    return { ok: true };
  },
  'goal': (state, b) => {
    if (!state.members[b.memberId]) throw new Error('¿Quién eres?');
    const week = clean(b.week, 12);
    const target = Math.max(50, Math.min(5000, parseInt(b.target, 10) || 300));
    const reward = clean(b.reward, 60);
    state.goal[week] = { target, reward, setBy: b.memberId, ts: now() };
    pushFeed(state, { type: 'goal', memberId: b.memberId, text: reward, pts: target });
    return { ok: true };
  },
  'reset': (state, b) => {
    if (clean(b.confirm) !== 'BORRAR TODO') throw new Error('Escribe BORRAR TODO');
    Object.assign(state, EMPTY());
    return { ok: true };
  }
};

export const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
