import { formatCnpj, formatCpf } from "@/lib/format";
import type { LookupConfig, Option } from "./types";

/**
 * Núcleo da busca remota do kit (022-pessoas-fornecedores, design.md D6), sem React: monta as URLs,
 * os rótulos "<nome> — <documento formatado>", espera a pausa na digitação e cancela a consulta
 * anterior. `useRemoteOptions`/`useResolvedOption` (use-options.ts) e `RemoteLookup` usam isto.
 */

/** Opções por consulta (a API devolve `total` para o aviso "Mostrando 20 de N"). */
export const REMOTE_PAGE_SIZE = 20;
/** Pausa depois da última tecla antes de consultar a API. */
export const REMOTE_DEBOUNCE_MS = 300;

type Fetch = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/** `<api>?…&<parâmetros>` preservando a query fixa da config (ex.: `?comCpf=1`); espaço vira `%20`. */
export function lookupUrl(api: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return query ? `${api}${api.includes("?") ? "&" : "?"}${query}` : api;
}

/** URL da busca: `GET <api>?q=<texto>&size=20` (sem `q` ao abrir sem texto: primeira página). */
export function searchUrl(lookup: LookupConfig, query: string, size = REMOTE_PAGE_SIZE): string {
  const q = query.trim();
  return lookupUrl(lookup.api, q ? { q, size: String(size) } : { size: String(size) });
}

/** URL que resolve o rótulo do valor gravado: `GET <api>?<valueField>=<valor>&size=1`. */
export function resolveUrl(lookup: LookupConfig, value: string): string {
  return lookupUrl(lookup.api, { [lookup.valueField ?? "id"]: value, size: "1" });
}

export function formatDetail(format: LookupConfig["detailFormat"], value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (format === "cpf") return formatCpf(String(value));
  if (format === "cnpj") return formatCnpj(String(value));
  return String(value);
}

const semDocumento = (format: LookupConfig["detailFormat"]) =>
  format === "cpf" ? "sem CPF" : format === "cnpj" ? "sem CNPJ" : "sem documento";

/** Opção de um item da API: rótulo "<labelField> — <detailField formatado>". */
export function optionFromItem(lookup: LookupConfig, item: Record<string, unknown>): Option & { name: string; detail: string } {
  const value = String(item[lookup.valueField ?? "id"] ?? "");
  const name = String(item[lookup.labelField] ?? value);
  if (!lookup.detailField) return { value, label: name, name, detail: "" };
  const detail = formatDetail(lookup.detailFormat, item[lookup.detailField]) || semDocumento(lookup.detailFormat);
  return { value, label: `${name} — ${detail}`, name, detail };
}

/** Rótulo de um valor gravado que a API não encontrou: o valor formatado + "(não encontrado)". */
export function missingOption(lookup: LookupConfig, value: string): Option {
  const format = lookup.detailField && lookup.detailField === (lookup.valueField ?? "id") ? lookup.detailFormat : undefined;
  return { value, label: `${formatDetail(format, value) || value} (não encontrado)` };
}

export type RemoteState = {
  status: "idle" | "loading" | "ok" | "error";
  options: (Option & { name: string; detail: string })[];
  total: number;
};

export const IDLE: RemoteState = { status: "idle", options: [], total: 0 };

/**
 * Busca com pausa: cada `search(texto)` reinicia a espera de 300 ms; quando a espera termina,
 * cancela a requisição anterior (`AbortController`) e consulta a API. Só o último resultado é entregue.
 */
export class RemoteSearch {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private controller: AbortController | null = null;

  constructor(
    private readonly lookup: LookupConfig,
    private readonly onState: (state: RemoteState) => void,
    private readonly options: { delay?: number; size?: number; fetch?: Fetch } = {},
  ) {}

  search(query: string, { immediate = false } = {}) {
    if (this.timer) clearTimeout(this.timer);
    this.onState({ ...IDLE, status: "loading" });
    const run = () => {
      this.timer = null;
      void this.run(query);
    };
    if (immediate) run();
    else this.timer = setTimeout(run, this.options.delay ?? REMOTE_DEBOUNCE_MS);
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
  }

  private async run(query: string) {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const doFetch: Fetch = this.options.fetch ?? ((input, init) => fetch(input, init));
    try {
      const res = await doFetch(searchUrl(this.lookup, query, this.options.size), { signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { items: Record<string, unknown>[]; total: number };
      if (controller.signal.aborted) return;
      this.onState({ status: "ok", options: body.items.map((item) => optionFromItem(this.lookup, item)), total: body.total });
    } catch {
      if (controller.signal.aborted) return;
      this.onState({ status: "error", options: [], total: 0 });
    }
  }
}

/** Resolve o rótulo do valor gravado (edição, filtro vindo da URL). Não achou → "(não encontrado)". */
export async function resolveOption(lookup: LookupConfig, value: string, doFetch: Fetch = (i, init) => fetch(i, init), signal?: AbortSignal): Promise<Option> {
  const res = await doFetch(resolveUrl(lookup, value), { signal });
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as { items: Record<string, unknown>[] };
  const item = body.items.find((i) => String(i[lookup.valueField ?? "id"]) === value) ?? body.items[0];
  return item && String(item[lookup.valueField ?? "id"]) === value ? optionFromItem(lookup, item) : missingOption(lookup, value);
}

/** Aviso do rodapé quando a API tem mais resultados do que os exibidos. */
export function moreResultsMessage(shown: number, total: number): string | null {
  if (total <= shown) return null;
  const nf = new Intl.NumberFormat("pt-BR");
  return `Mostrando ${nf.format(shown)} de ${nf.format(total)} — continue digitando para refinar`;
}
