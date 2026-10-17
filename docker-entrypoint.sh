#!/bin/sh
set -e

# Docker creates a missing bind-mount folder (e.g. ./data) owned by root, which the app's
# unprivileged user can't write to. Starting as root, take ownership of the data folder,
# then drop privileges before running the app.
if [ "$(id -u)" = "0" ]; then
  data_dir="$(dirname "${DB_PATH:-/data/diary.db}")"
  mkdir -p "$data_dir"
  chown -R node:node "$data_dir" 2>/dev/null || echo "warning: could not change ownership of $data_dir" >&2
  exec su-exec node "$@"
fi

exec "$@"
