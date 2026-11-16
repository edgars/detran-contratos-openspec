#!/bin/sh
# 026-producao task 6.3, cenário "Retenção": 40 backups diários em 3 meses + 2 com motivo.
# Roda dentro da imagem do backup: docker compose run --rm backup /usr/local/share/backup-testes/retencao.test.sh
set -eu
export BACKUPS_DIR="$(mktemp -d)"
trap 'rm -rf "$BACKUPS_DIR"' EXIT
mkdir -p "$BACKUPS_DIR/db"
DB="$BACKUPS_DIR/db"
cria() { for e in db.gz db.gz.sha256 json; do : > "$DB/$1.$e"; done; }

# 40 dias consecutivos a partir do dia 25 de três meses atrás: sempre 3 meses diferentes, todos no passado.
INICIO="$(date -d "$(date +%Y-%m-01) -3 months +24 days" +%Y-%m-%d)"
i=0
while [ "$i" -lt 40 ]; do
  cria "app-$(date -d "$INICIO +$i days" +%Y%m%d)-020000"
  i=$((i + 1))
done
# Com motivo: um recente (fica) e um com mais de 90 dias (sai).
cria "app-$(date -d "-10 days" +%Y%m%d)-101500-pre-atualizacao-v1.1.0"
cria "pre-migracao-$(date -d "-120 days" +%Y%m%d)-090000"

BACKUP_RETENCAO_DIARIA=14 BACKUP_RETENCAO_MENSAL=6 retencao.sh

ESPERADO="$(mktemp)"
i=0
while [ "$i" -lt 40 ]; do echo "app-$(date -d "$INICIO +$i days" +%Y%m%d)-020000"; i=$((i + 1)); done | sort -r | head -n 14 > "$ESPERADO"
# primeiro de cada mês presente
for m in $(i=0; while [ "$i" -lt 40 ]; do date -d "$INICIO +$i days" +%Y%m; i=$((i + 1)); done | sort -u); do
  i=0; while [ "$i" -lt 40 ]; do echo "app-$(date -d "$INICIO +$i days" +%Y%m%d)-020000"; i=$((i + 1)); done | grep "^app-$m" | sort | head -n 1 >> "$ESPERADO"
done
echo "app-$(date -d "-10 days" +%Y%m%d)-101500-pre-atualizacao-v1.1.0" >> "$ESPERADO"
sort -u "$ESPERADO" -o "$ESPERADO"

ls -1 "$DB" | grep '\.db\.gz$' | sed 's/\.db\.gz$//' | sort > "$BACKUPS_DIR/sobrou"
MESES="$(grep -E '^app-[0-9]{8}-[0-9]{6}$' "$BACKUPS_DIR/sobrou" | cut -c5-10 | sort -u | wc -l)"
if ! diff -u "$ESPERADO" "$BACKUPS_DIR/sobrou"; then echo "FALHOU: retenção diferente do esperado"; exit 1; fi
# Os trios ficam completos: nenhum .sha256/.json órfão.
[ "$(ls -1 "$DB" | wc -l)" -eq "$(( $(wc -l < "$ESPERADO") * 3 ))" ] || { echo "FALHOU: arquivos órfãos"; ls -1 "$DB"; exit 1; }
echo "ok retenção: $(wc -l < "$ESPERADO") backups mantidos (14 recentes ∪ primeiro de cada mês, $MESES meses, + 1 com motivo recente; o de 120 dias saiu); 40+2 criados"
