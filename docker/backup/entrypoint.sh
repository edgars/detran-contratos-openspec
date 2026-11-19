#!/bin/sh
# 026-producao: sem argumentos, instala o crontab (BACKUP_HORARIO) e roda o crond em primeiro plano.
# Com argumentos (ex.: `docker compose run --rm backup backup.sh --motivo manual`), executa o comando.
set -eu
if [ "$#" -gt 0 ]; then exec "$@"; fi

HORARIO="${BACKUP_HORARIO:-0 2 * * *}"
mkdir -p /etc/crontabs
sed "s|@BACKUP_HORARIO@|$HORARIO|" /etc/backup/crontab > /etc/crontabs/root
# O crond não repassa o ambiente do container às tarefas: as variáveis do backup vão para um arquivo lido por lib.sh.
export -p | grep -E "^export (BACKUP_[A-Z_]*|TZ|DADOS_DIR|BACKUPS_DIR|SEGREDOS_DIR|APP_HEALTH_URL)=" > /run/backup.env || true
. /usr/local/bin/lib.sh
logj info backup.agendado "\"horario\":$(json_str "$HORARIO"),\"teste_restauracao\":\"30 3 * * 0\""
exec crond -f -l 8 -c /etc/crontabs
