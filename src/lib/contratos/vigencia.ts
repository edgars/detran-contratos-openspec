import { formatDate } from "@/lib/format";

/**
 * Selo de vigência da página do contrato (020-contratos-complementos). Funções puras: recebem `now`.
 * Vigência só pela data do próprio contrato (diretiva do autor 13/11/2026): quem chama passa
 * `dataInicio`/`dataTermino` do registro, nunca a data de um aditivo.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Dias que faltam até `fim` contados em datas de calendário (UTC, como o formatDate). */
export function diasAte(fim: Date, now: Date = new Date()): number {
  const hoje = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const alvo = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate());
  return Math.round((alvo - hoje) / DAY);
}

export type EstadoVigencia = "a-iniciar" | "vigente" | "vencendo" | "vence-hoje" | "vencido";
export type Tom = "neutro" | "ok" | "alerta" | "erro";

export type Vigencia = { estado: EstadoVigencia; tom: Tom; texto: string };

/** Janela do aviso "Vence em N dias". */
export const JANELA_AVISO = 60;

/** A iniciar, vigente, vence em N dias (≤ 60), vence hoje ou vencido; `null` sem data de término. */
export function vigencia(inicio: Date | null, fim: Date | null, now: Date = new Date()): Vigencia | null {
  if (!fim) return null;
  if (inicio && diasAte(inicio, now) > 0) return { estado: "a-iniciar", tom: "neutro", texto: `Inicia em ${formatDate(inicio)}` };
  const dias = diasAte(fim, now);
  if (dias < 0) return { estado: "vencido", tom: "erro", texto: `Vencido em ${formatDate(fim)}` };
  if (dias === 0) return { estado: "vence-hoje", tom: "alerta", texto: "Vence hoje" };
  if (dias <= JANELA_AVISO) return { estado: "vencendo", tom: "alerta", texto: `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}` };
  return { estado: "vigente", tom: "ok", texto: "Vigente" };
}
