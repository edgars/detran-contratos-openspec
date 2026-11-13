"use client";

import { useEffect, useState } from "react";
import type { Option } from "./types";

/** Carrega opções de um lookup (`GET <api>?size=100`). */
export function useLookupOptions(lookup?: { api: string; labelField: string; valueField?: string }) {
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
