#!/bin/sh
set -eu

mkdir -p /app/data

exec node server.js
