import { MSG } from "@/lib/rules";
import { requiredInt } from "@/lib/rules/fields";

/**
 * Regras de 011-status. A tabela `status` não tem coluna `status_id`: no legado as regras
 * "status_id is required" (modelo do `app/` e cópia do plugin `detran`) valem para quem
 * referencia um Status, isto é, `contrato_status.status_id`. O campo abaixo é o ponto único
 * onde elas valem; o schema de `contrato_status` (004) o usa. Ver 011 design.md §Decisions.
 */
export const STATUS_OBRIGATORIO = MSG.obrigatorio("Status");

// RK-a7017eb6c42d RK-067d06861847 — status_id is required (status_id IS NOT NULL)
export const statusIdField = requiredInt(STATUS_OBRIGATORIO);
