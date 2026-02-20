#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-/opt/supabase-self-hosted}"

if [ -d "$TARGET_DIR" ]; then
  echo "Directory $TARGET_DIR already exists."
  exit 1
fi

git clone --depth 1 https://github.com/supabase/supabase "$TARGET_DIR"
cd "$TARGET_DIR/docker"
cp .env.example .env

echo "Now edit $TARGET_DIR/docker/.env, then run:"
echo "  cd $TARGET_DIR/docker && docker compose up -d"
