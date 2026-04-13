#!/bin/sh
set -eu

mkdir -p /app/data

if [ ! -f /app/data/posts.json ]; then
  printf '[]\n' > /app/data/posts.json
fi

exec node server.js
