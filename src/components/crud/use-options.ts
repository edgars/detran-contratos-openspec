"use client";

import { useEffect, useRef, useState } from "react";
import { IDLE, RemoteSearch, resolveOption, type RemoteState } from "./remote-search";
import type { LookupConfig, Option } from "./types";

/** Carrega opções de um lookup (`GET <api>?size=100`). */
export function useLookupOptions(lookup?: LookupConfig) {
  const [options, setOptions] = useState<Option[]>([]);
  useEffect(() => {
    if (!lookup) return;
    let alive = true;
    fetch(`${lookup.api}${lookup.api.includes("?") ? "&" : "?"}size=100`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((body: { items: Record<string, unknown>[] }) => {
        if (!alive) return;
        setOptions(
          body.items.map((item) => ({
            value: String(item[lookup.valueField ?? "id"]),
            label: String(item[lookup.labelField] ?? item[lookup.valueField ?? "id"]),
          })),
        );
      })
      .catch(() => alive && setOptions([]));
    return () => {
      alive = false;
    };
  }, [lookup?.api, lookup?.labelField, lookup?.valueField]); // eslint-disable-line react-hooks/exhaustive-deps
  return options;
}

/**
 * Busca remota (022-pessoas-fornecedores, D6): consulta `GET <api>?q=<texto>&size=20` 300 ms depois
 * da última tecla, cancelando a anterior. Só busca com `enabled` (popover aberto); ao abrir sem
 * texto, traz a primeira página em ordem alfabética. Devolve `options`, `total` e `status`.
 */
export function useRemoteOptions(lookup: LookupConfig | undefined, query: string, enabled: boolean): RemoteState {
  const [state, setState] = useState<RemoteState>(IDLE);
  const searchRef = useRef<RemoteSearch | null>(null);
  const firstRun = useRef(true);
  const key = lookup ? `${lookup.api}|${lookup.labelField}|${lookup.valueField}|${lookup.detailField}|${lookup.detailFormat}` : "";

  useEffect(() => {
    if (!lookup) return;
    // Enquanto a próxima consulta não chega, as opções anteriores continuam na tela.
    const search = new RemoteSearch(lookup, (next) =>
      setState((prev) => (next.status === "loading" ? { ...prev, status: "loading" } : next)),
    );
    searchRef.current = search;
    return () => {
      search.cancel();
      searchRef.current = null;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      searchRef.current?.cancel();
      firstRun.current = true;
      return;
    }
    // Abrir o popover consulta na hora; digitar espera a pausa.
    searchRef.current?.search(query, { immediate: firstRun.current });
    firstRun.current = false;
  }, [enabled, query, key]);

  return state;
}

/**
 * Rótulo do valor já gravado (edição e filtro vindo da URL): `GET <api>?<valueField>=<valor>&size=1`.
 * `known` evita a consulta quando o operador acabou de escolher a opção.
 */
export function useResolvedOption(lookup: LookupConfig | undefined, value: string, known: Option | null): Option | null {
  const [resolved, setResolved] = useState<Option | null>(null);
  const hasKnown = Boolean(known && known.value === value);
  useEffect(() => {
    if (!lookup || !value || hasKnown) return;
    const controller = new AbortController();
    resolveOption(lookup, value, undefined, controller.signal)
      .then((option) => !controller.signal.aborted && setResolved(option))
      .catch(() => !controller.signal.aborted && setResolved({ value, label: value }));
    return () => controller.abort();
  }, [lookup?.api, lookup?.valueField, value, hasKnown]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!value) return null;
  if (hasKnown) return known;
  return resolved && resolved.value === value ? resolved : null;
}
