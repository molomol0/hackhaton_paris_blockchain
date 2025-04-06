#!/bin/bash

cd three_js_clock
rm -rf node_modules package-lock.json
npm install

# Lancer Vite en arrière-plan et capturer les logs
npx vite > vite.log 2>&1 &

# Attendre que Vite soit prêt
while ! grep -q "Local:" vite.log; do
  sleep 1
done

# Extraire et afficher les adresses
grep -E "Local:|Network:" vite.log

# Lancer docker-compose
docker-compose up --build -d