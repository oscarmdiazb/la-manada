# 🐺 La Manada

App familiar de ejercicio y buena comida. Sin dependencias (Node ≥ 18), datos en `data/state.json`.

## Cómo funciona
- Cada persona escoge su nombre y su animal (se guarda en su celular).
- **Hoy**: 4 misiones diarias, 10 pts cada una. Las 4 → +10 extra.
- **Entreno en manada**: si 2+ personas se mueven el mismo día, +10 para cada una.
- **Manada**: meta semanal de puntos de TODA la familia con un premio (ej. noche de pizza). Ranking, rachas (2+ misiones al día), empujones 👉 a quien le falte algo.
- **Retos**: retar a alguien o a todos ("20 sentadillas", +25). El que cumple gana los puntos; el que reta gana +5.
- **Muro**: todo lo que pasa, con reacciones 👏💪❤️😂.
- Idioma ES/EN con el botón del encabezado.

## Online (para toda la familia, gratis)
URL: **https://oscarmdiazb.github.io/la-manada/** (pantalla en GitHub Pages, rama `gh-pages` del repo `oscarmdiazb/la-manada`).
API: Supabase Edge Function `la-manada` (`supabase/functions/la-manada/`). Pide la clave de familia (está en `.env.local`).
En el celular: abrir la URL → "Agregar a pantalla de inicio".

Volver a publicar:
```bash
./deploy-web.sh   # cambios en public/ (pantalla)
./build-edge.sh   # cambios en core.mjs (API)
```
Cambiar la clave: editar `.env.local` y correr `supabase secrets set --env-file la-manada/.env.local` desde `~/oscar-personal-apps`.
Nota: la versión online se actualiza por sondeo cada 8 s (no SSE). Dos toques en el mismo cuarto de segundo pueden pisarse; para una familia no importa.

## Correr en casa (opcional)
```bash
./start.command          # http://localhost:3212, misma clave y mismos datos
```

## Estructura
- `core.mjs` — toda la lógica del juego (compartida).
- `server.js` — servidor local Node (con SSE).
- `../supabase/functions/la-manada/index.ts` — la Edge Function (usa core.mjs + assets.mjs generados por build-edge.sh).
- Datos: Supabase `app_state`, fila `la-manada`. Backup: `node ~/.claude/skills/supabase-apps/scripts/state.js backup la-manada`.

## Variables
- `FAMILY_PIN` (clave; vacío = sin clave). Local en `.env.local`; online como secreto de Supabase.

## Borrar todo (empezar de cero)
`POST api/reset` con `{"confirm":"BORRAR TODO"}` y la clave, o `node ~/.claude/skills/supabase-apps/scripts/state.js set la-manada vacio.json`.
