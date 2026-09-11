#!/bin/bash
# Publica la pantalla (public/) en GitHub Pages: https://oscarmdiazb.github.io/la-manada/
set -e
cd "$(dirname "$0")"
git add -A && git commit -qm "Actualiza la app" || true
git push -q origin main
git push -q --force origin $(git subtree split --prefix public main):refs/heads/gh-pages
echo "Publicado. Tarda ~1 min: https://oscarmdiazb.github.io/la-manada/"
