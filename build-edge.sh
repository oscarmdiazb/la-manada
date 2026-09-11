#!/bin/bash
# Publica la API (Edge Function): copia core.mjs y despliega sin Docker.
set -e
cd "$(dirname "$0")"
cp core.mjs ../supabase/functions/la-manada/core.mjs
rm -f ../supabase/functions/la-manada/assets.mjs
cd ..
supabase functions deploy la-manada --use-api --no-verify-jwt
