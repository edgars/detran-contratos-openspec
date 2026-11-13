"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCell } from "./format-cell";
import { OptionSelect } from "./option-select";
import { useLookupOptions } from "./use-options";
import type { ColumnDef, ListFilter } from "./types";

type Page = { items: Record<string, unknown>[]; total: number; page: number; size: number };

function FilterControl({ filter, value, onChange }: { filter: ListFilter; value: string; onChange: (v: string) => void }) {
  const loaded = useLookupOptions(filter.kind === "lookup" ? filter.lookup : undefined);
  if (filter.kind === "number") {
    return (
      <Input
        aria-label={filter.label}
        placeholder={filter.label}
        inputMode="numeric"
        className="w-40"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
    );
  }
  return (
    <div className="w-56">
      <OptionSelect
        value={value}
        options={filter.kind === "lookup" ? loaded : (filter.options ?? [])}
        onChange={onChange}
        placeholder={filter.label}
        allowEmpty
      />
    </div>
  );
}

/** Lista paginada com busca, filtros e botão Novo (convenção de toda entidade gerenciada). */
export function EntityList({
  title,
  api,
  basePath,
  columns,
  filters = [],
  searchPlaceholder = "Buscar",
  canCreate = true,
  rowHref,
}: {
  title: string;
  api: string;
  basePath: string;
  columns: ColumnDef[];
  filters?: ListFilter[];
  searchPlaceholder?: string;
  canCreate?: boolean;
  /** Destino do link da 1ª coluna (padrão: `${basePath}/<id>/edit`). Use `{id}` como marcador. */
  rowHref?: string;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [data, setData] = useState<Page | null>(null);
  const size = 20;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(values)) if (v) params.set(k, v);
    const res = await fetch(`${api}?${params}`);
    setData(res.ok ? await res.json() : { items: [], total: 0, page, size });
  }, [api, page, q, values]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">{title}</h1>
        {canCreate && <Button render={<Link href={`${basePath}/new`} />}>Novo</Button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-64"
          placeholder={searchPlaceholder}
          aria-label="Busca"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        {filters.map((f) => (
          <FilterControl
            key={f.name}
            filter={f}
            value={values[f.name] ?? ""}
            onChange={(v) => {
              setValues((prev) => ({ ...prev, [f.name]: v }));
              setPage(1);
            }}
          />
        ))}
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((row) => (
              <TableRow key={String(row.id)}>
                {columns.map((c, i) => (
                  <TableCell key={c.key}>
                    {i === 0 ? (
                      <Link className="font-medium underline-offset-4 hover:underline" href={rowHref ? rowHref.replace("{id}", String(row.id)) : `${basePath}/${row.id}/edit`}>
                        {formatCell(row, c)}
                      </Link>
                    ) : (
                      formatCell(row, c)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {data && data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  Nenhum registro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data ? `${data.total} registro(s)` : "Carregando…"}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            Página {page} de {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
