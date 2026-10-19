#!/usr/bin/env bash
#
# Deploys socifi to the production server (pw.oopz.pro).
#
#   bash deploy/deploy.sh
#
# Builds the SPA locally, uploads back/, modules/, shared/ and the built
# front/dist/spa, installs production dependencies on the server, applies the
# database migrations and (re)starts the PM2 process.
#
# Never touched on the server: the databases (back/database/*.sqlite, *.db) and
# back/.env. The latter is created once, with random JWT secrets, if missing.
#
# Connection settings come from deploy/.env (PROD_SERVER_IP, PROD_SERVER_USER,
# PROD_SERVER_KEY_PATH); everything can be overridden with the environment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Reads a single value from deploy/.env (tolerates CRLF and surrounding quotes).
read_env() {
  [[ -f "${ENV_FILE}" ]] || return 0
  grep -m1 "^$1=" "${ENV_FILE}" | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//'
}

SERVER_IP="${PROD_SERVER_IP:-$(read_env PROD_SERVER_IP)}"
SSH_USER="${PROD_SERVER_USER:-$(read_env PROD_SERVER_USER)}"
SSH_KEY="${PROD_SERVER_KEY_PATH:-$(read_env PROD_SERVER_KEY_PATH)}"
SSH_KEY="${SSH_KEY//\//}"
REMOTE_DIR="${PROD_APP_DIR:-/var/www/pw.socifi.io/app}"
PM2_APP="${PROD_PM2_APP:-socifi}"
DOMAIN="${PROD_DOMAIN:-pw.oopz.pro}"
PORT="${PROD_PORT:-3075}"
BUN_DIR="$(dirname "${PROD_BUN_BIN:-/root/.bun/bin/bun}")"

for var in SERVER_IP SSH_USER SSH_KEY; do
  [[ -n "${!var}" ]] || { echo "${var} is not set (see ${ENV_FILE})" >&2; exit 1; }
done
[[ -f "${SSH_KEY}" ]] || { echo "SSH key not found: ${SSH_KEY}" >&2; exit 1; }

SSH=(ssh -i "${SSH_KEY}" -o BatchMode=yes "${SSH_USER}@${SERVER_IP}")

echo "==> Building the SPA"
(cd "${PROJECT_DIR}/front" && bun run build)

echo "==> Uploading to ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}"
# Drop the previous build output first so stale hashed assets do not pile up.
"${SSH[@]}" "mkdir -p '${REMOTE_DIR}' && rm -rf '${REMOTE_DIR}/front/dist/spa'"
tar czf - \
  --exclude='node_modules' \
  --exclude='back/dist' \
  --exclude='back/dev-tasks' \
  --exclude='back/database/*.sqlite*' \
  --exclude='back/database/*.db*' \
  --exclude='back/database/uploads' \
  --exclude='modules/installed' \
  --exclude='.env' \
  -C "${PROJECT_DIR}" back modules shared front/dist/spa deploy/ecosystem.config.cjs \
  | "${SSH[@]}" "tar xzf - -C '${REMOTE_DIR}'"

echo "==> Installing dependencies, migrating, restarting"
"${SSH[@]}" "set -e
  export PATH='${BUN_DIR}':\$PATH
  cd '${REMOTE_DIR}'

  if [ ! -f back/.env ]; then
    echo '    creating back/.env with fresh secrets'
    umask 077
    {
      echo 'PORT=${PORT}'
      echo 'FRONTEND_URL=https://${DOMAIN}'
      echo 'COOKIE_SECURE=true'
      echo \"JWT_SECRET=\$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')\"
      echo \"JWT_REFRESH_SECRET=\$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')\"
    } > back/.env
  fi

  # The public URL is part of the server config; keep it in step with the domain.
  sed -i 's|^FRONTEND_URL=.*|FRONTEND_URL=https://${DOMAIN}|' back/.env

  (cd back && bun install --production --frozen-lockfile)
  (cd modules && bun install --production --frozen-lockfile)
  mkdir -p back/database
  (cd back && bun run db:migrate)

  # The process definition ships with the sources; startOrReload creates the
  # process on the first deploy and reloads it afterwards.
  pm2 startOrReload '${REMOTE_DIR}/deploy/ecosystem.config.cjs' --update-env
  pm2 save
  pm2 describe '${PM2_APP}' | grep -E 'status|restarts|uptime'"

echo "==> Checking the public endpoint"
sleep 2
curl -s -o /dev/null -w "https://${DOMAIN}/health -> %{http_code}\n" "https://${DOMAIN}/health"
