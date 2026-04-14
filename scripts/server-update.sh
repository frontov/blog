#!/bin/sh
set -eu

REPO_DIR="${REPO_DIR:-/opt/blog}"

cd "$REPO_DIR"
git pull --ff-only
docker-compose -f docker-compose.server.yml up -d --build
