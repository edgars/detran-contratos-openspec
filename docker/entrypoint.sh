#!/bin/sh
# 026-producao: valida o ambiente ANTES de tocar no banco; depois `prisma migrate deploy` e o servidor.
set -e

# /app/data é o volume `dados` e precisa ser gravável pelo usuário do processo (node, uid 1000).
if ! touch /app/data/.gravavel 2>/dev/null; then
  echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"error\",\"evento\":\"entrypoint.dados_sem_permissao\",\"msg\":\"/app/data não é gravável pelo uid $(id -u). Volume criado pela versão anterior (root)? Rode: docker compose run --rm --user root --entrypoint chown app -R 1000:1000 /app/data\"}" >&2
  exit 1
fi
rm -f /app/data/.gravavel
mkdir -p "${UPLOAD_DIR:-/app/data/uploads}"

node check-env.js
prisma migrate deploy --schema ./prisma/schema.prisma
exec node server.js
