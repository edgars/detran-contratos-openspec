#!/bin/sh
# 026-producao › Retenção dos backups (design.md › Backup do banco):
#  - diários (sem motivo): os BACKUP_RETENCAO_DIARIA mais recentes (padrão 14);
#  - mensais: o primeiro backup diário de cada um dos últimos BACKUP_RETENCAO_MENSAL meses (padrão 6);
#  - com motivo (pre-atualizacao-*, pre-migracao-*, manual…): 90 dias pela data do nome, independentemente da regra.
# Cada backup é o trio <nome>.db.gz, .db.gz.sha256 e .json; apaga o trio inteiro.
# Só é chamado por backup.sh depois de um backup íntegro (backup falhou → nada é apagado).
set -u
. /usr/local/bin/lib.sh

DIARIA="${BACKUP_RETENCAO_DIARIA:-14}"
MENSAL="${BACKUP_RETENCAO_MENSAL:-6}"
DIAS_MOTIVO=90
DIR="$BACKUPS_DIR/db"
[ -d "$DIR" ] || exit 0
HOJE="$(date +%Y%m%d)"
LIMITE_MOTIVO="$(date -d "$HOJE -$DIAS_MOTIVO days" +%Y%m%d)"

MANTER="$(mktemp)"
TODOS="$(mktemp)"
trap 'rm -f "$MANTER" "$TODOS"' EXIT

ls -1 "$DIR" | grep -E '\.db\.gz$' | sed 's/\.db\.gz$//' | LC_ALL=C sort > "$TODOS"
# Diários: app-AAAAMMDD-HHMMSS (sem sufixo de motivo).
DIARIOS="$(grep -E '^app-[0-9]{8}-[0-9]{6}$' "$TODOS" || true)"
# Os N mais recentes.
printf '%s\n' "$DIARIOS" | grep . | LC_ALL=C sort -r | head -n "$DIARIA" >> "$MANTER"
# O primeiro de cada mês, nos M meses mais recentes que têm backup.
MESES="$(printf '%s\n' "$DIARIOS" | grep . | cut -c5-10 | LC_ALL=C sort -u -r | head -n "$MENSAL")"
for m in $MESES; do
  printf '%s\n' "$DIARIOS" | grep -E "^app-$m" | LC_ALL=C sort | head -n 1 >> "$MANTER"
done
# Com motivo: 90 dias pela data do nome.
grep -vE '^app-[0-9]{8}-[0-9]{6}$' "$TODOS" | while IFS= read -r n; do
  d="$(data_do_nome "$n")"
  if [ -z "$d" ] || [ "$d" -ge "$LIMITE_MOTIVO" ]; then echo "$n" >> "$MANTER"; fi
done

APAGADOS=0
while IFS= read -r n; do
  if ! grep -qxF "$n" "$MANTER"; then
    rm -f "$DIR/$n.db.gz" "$DIR/$n.db.gz.sha256" "$DIR/$n.json"
    APAGADOS=$((APAGADOS + 1))
  fi
done < "$TODOS"
# Manifestos dos anexos: mesmo prazo dos backups com motivo.
for f in "$BACKUPS_DIR"/manifestos/uploads-*.sha256; do
  [ -f "$f" ] || continue
  d="$(basename "$f" .sha256 | sed 's/^uploads-//')"
  [ "$d" -lt "$LIMITE_MOTIVO" ] && rm -f "$f"
done
logj info backup.retencao.ok "\"mantidos\":$(sort -u "$MANTER" | grep -c .),\"apagados\":$APAGADOS"
