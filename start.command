#!/bin/bash
# Servidor local. Usa la misma clave de familia que la versión online (.env.local).
cd "$(dirname "$0")"
[ -f .env.local ] && export $(grep -v '^#' .env.local | xargs)
node server.js
