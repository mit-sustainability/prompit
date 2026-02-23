#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/prompit"
IMAGE_NAME="prompit-web:latest"
CONTAINER_NAME="prompit-web"
ENV_FILE=".env.prompit"
PORT="${PORT:-3001}"
CONTAINER_PORT="${CONTAINER_PORT:-3001}"

cd "$APP_DIR"

docker build -t "$IMAGE_NAME" -f Dockerfile .

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -v "$(pwd)/$ENV_FILE:/app/.env:ro" \
  -p "$PORT:$CONTAINER_PORT" \
  "$IMAGE_NAME"

echo "Prompit deployed on port $PORT."
