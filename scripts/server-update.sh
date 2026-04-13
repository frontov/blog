#!/bin/sh
set -eu

IMAGE="${1:-ghcr.io/frontov/blog:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-telegram-blog}"
ENV_FILE="${ENV_FILE:-/opt/blog/.env}"
DATA_VOLUME="${DATA_VOLUME:-blog_data}"
NETWORK_NAME="${NETWORK_NAME:-sporza_default}"

docker pull "$IMAGE"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -v "$DATA_VOLUME:/app/data" \
  --network "$NETWORK_NAME" \
  --network-alias "$CONTAINER_NAME" \
  "$IMAGE"
