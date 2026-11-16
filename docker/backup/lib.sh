#!/bin/sh
# 026-producao: funções comuns dos scripts do serviço `backup` (log JSON por linha, caminhos).
# Tarefas do cron: o ambiente do container foi salvo pelo entrypoint em /run/backup.env.
if [ -z "${LIB_BACKUP_CARREGADA:-}" ] && [ -f /run/backup.env ]; then . /run/backup.env; fi
LIB_BACKUP_CARREGADA=1

DADOS_DIR="${DADOS_DIR:-/data}"            # volume `dados` do app (app.db e uploads/)
BACKUPS_DIR="${BACKUPS_DIR:-/backups}"     # volume `backups`
SEGREDOS_DIR="${SEGREDOS_DIR:-/run/secrets/backup}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://app:3000/api/health}"
DB="$DADOS_DIR/app.db"

# Texto como string JSON (aspas, barra invertida e quebras de linha escapadas).
json_str() {
  printf '%s' "$1" | jq -Rs .
}

# logj <level> <evento> [campos JSON extras sem chaves externas, ex.: "\"arquivo\":\"x\""]
logj() {
  _extra=""
  [ -n "${3:-}" ] && _extra=",$3"
  printf '{"ts":"%s","level":"%s","evento":"%s","servico":"backup"%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" "$1" "$2" "$_extra"
}

# Data AAAAMMDD contida no nome de um backup (app-AAAAMMDD-HHMMSS… ou pre-migracao-AAAAMMDD-HHMMSS…).
data_do_nome() {
  echo "$1" | grep -oE '[0-9]{8}-[0-9]{6}' | head -n1 | cut -c1-8
}
