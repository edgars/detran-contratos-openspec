#!/bin/sh
# 026-producao › Restauração. Uso (com o app PARADO):
#   docker compose stop app
#   docker compose run --rm backup restaurar.sh <app-AAAAMMDD-HHMMSS[-motivo].db.gz>
#   docker compose start app
# Recusa se o app responde; confere SHA-256 e integrity_check; preserva o banco atual como
# app.db.antes-restauracao-<data>; repõe o banco (dono uid 1000) e os anexos do espelho (sem --delete).
set -u
. /usr/local/bin/lib.sh

ARQ="${1:-}"
[ -n "$ARQ" ] || { logj error restauracao.falha "\"motivo\":\"uso: restaurar.sh <arquivo.db.gz>\""; exit 1; }
case "$ARQ" in /*) ;; *) ARQ="$BACKUPS_DIR/db/$ARQ" ;; esac
NOME="$(basename "$ARQ" .db.gz)"
falha() {
  logj error restauracao.falha "\"arquivo\":$(json_str "$NOME.db.gz"),\"motivo\":$(json_str "$1")"
  exit 1
}

# App no ar → recusa sem alterar nada (qualquer resposta HTTP do healthcheck conta).
if wget -S -q -T 3 -O /dev/null "$APP_HEALTH_URL" 2>&1 | grep -q 'HTTP/'; then
  falha "o app está no ar ($APP_HEALTH_URL respondeu): pare com 'docker compose stop app' antes de restaurar"
fi

[ -f "$ARQ" ] || falha "arquivo não encontrado"
[ -f "$ARQ.sha256" ] || falha "sem $NOME.db.gz.sha256"
(cd "$(dirname "$ARQ")" && sha256sum -c --status "$NOME.db.gz.sha256") || falha "SHA-256 não confere"

TS="$(date +%Y%m%d-%H%M%S)"
NOVO="$DADOS_DIR/app.db.restaurando-$TS"
gunzip -c "$ARQ" > "$NOVO" || { rm -f "$NOVO"; falha "descompactação falhou"; }
if [ "$(sqlite3 "$NOVO" "PRAGMA integrity_check" 2>&1)" != "ok" ]; then rm -f "$NOVO"; falha "integrity_check não devolveu ok"; fi

ANTERIOR=""
if [ -f "$DADOS_DIR/app.db" ]; then
  ANTERIOR="app.db.antes-restauracao-$TS"
  mv "$DADOS_DIR/app.db" "$DADOS_DIR/$ANTERIOR"
fi
rm -f "$DADOS_DIR/app.db-journal" "$DADOS_DIR/app.db-wal" "$DADOS_DIR/app.db-shm"
mv "$NOVO" "$DADOS_DIR/app.db"
chown 1000:1000 "$DADOS_DIR/app.db"
mkdir -p "$DADOS_DIR/uploads"
rsync -a "$BACKUPS_DIR/uploads/" "$DADOS_DIR/uploads/" || falha "rsync dos anexos falhou (banco já restaurado; rode de novo)"
chown -R 1000:1000 "$DADOS_DIR/uploads"
logj info restauracao.ok "\"arquivo\":\"$NOME.db.gz\",\"anterior\":$(json_str "$ANTERIOR")"
