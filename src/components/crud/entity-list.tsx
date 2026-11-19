"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Plus, RotateCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCell, readPath } from "./format-cell";
import { OptionSelect } from "./option-select";
import { RemoteLookup } from "./remote-lookup";
import { useLookupOptions } from "./use-options";
import { ariaSort, formatSort, nextSort, parseSort, withSortParam, type SortState } from "./sort";
import type { ColumnDef, ListFilter } from "./types";

type Page = { items: Record<string, unknown>[]; total: number; page: number; size: number };

const nf = new Intl.NumberFormat("pt-BR");
const plural = (n: number) => `${nf.format(n)} ${n === 1 ? "registro" : "registros"}`;

function FilterControl({ filter, value, onChange }: { filter: ListFilter; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const loaded = useLookupOptions(filter.kind === "lookup" ? filter.lookup : undefined);
  if (filter.kind === "number") {
    return (
      <Input
        aria-label={filter.label}
        placeholder={filter.label}
        inputMode="numeric"
        className="tabular-nums sm:w-44"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
    );
  }
  if (filter.kind === "search" && filter.lookup) {
    // Busca remota (022-pessoas-fornecedores, D6): o filtro recebe o valor gravado (CPF, id).
    return (
      <div className="min-w-0 sm:w-64">
        <label htmlFor={id} className="sr-only">
          {filter.label}
        </label>
        <RemoteLookup id={id} value={value} lookup={filter.lookup} onChange={onChange} placeholder={filter.label} allowClear />
      </div>
    );
  }
  return (
    <div className="min-w-0 sm:w-56">
      <label htmlFor={id} className="sr-only">
        {filter.label}
      </label>
      <OptionSelect
        id={id}
        value={value}
        options={filter.kind === "lookup" ? loaded : (filter.options ?? [])}
        onChange={onChange}
        placeholder={filter.label}
        allowEmpty
      />
    </div>
  );
}

/** Classes de alinhamento/visibilidade comuns ao cabeçalho e às células de uma coluna. */
function columnClass(c: ColumnDef) {
  const right = c.align === "right" || (c.align === undefined && c.format === "currency");
  return cn(right && "text-right", (c.format === "date" || c.format === "currency" || right) && "tabular-nums", c.secondary && "hidden md:table-cell");
}

/** Cabeçalho de coluna ordenável: botão ghost com o ícone da direção atual. */
function SortHeader({ column, sort, onSort }: { column: ColumnDef; sort: SortState; onSort: () => void }) {
  const state = ariaSort(sort, column.key);
  const Icon = state === "ascending" ? ArrowUp : state === "descending" ? ArrowDown : ArrowUpDown;
  const right = columnClass(column).includes("text-right");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onSort}
      className={cn(
        "-mx-2 h-7 gap-1 px-2 text-xs font-medium",
        state === "none" ? "text-muted-foreground" : "text-foreground",
        right && "flex-row-reverse",
      )}
    >
      {column.label}
      <Icon aria-hidden="true" className={cn("size-3.5", state === "none" && "opacity-50")} />
    </Button>
  );
}

type ExtraParams = Record<string, string | number | boolean | null | undefined>;

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
  pageSize = 20,
  extraParams,
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
  /** Itens por página (padrão 20; a API limita a 100). */
  pageSize?: number;
  /** Parâmetros fixos somados à query da lista (ex.: `{ contratoId: 3 }`). Não aparecem como filtro. */
  extraParams?: ExtraParams;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const request = useRef(0);
  const size = pageSize;
  // Chave estável: um objeto literal novo a cada render não dispara outra carga.
  const extraKey = JSON.stringify(extraParams ?? {});
  // Parâmetros fixos mudaram (ex.: aba Pendentes/Realizadas): volta para a página 1.
  const [prevExtraKey, setPrevExtraKey] = useState(extraKey);
  if (prevExtraKey !== extraKey) {
    setPrevExtraKey(extraKey);
    setPage(1);
  }

  // A ordenação escolhida fica na URL da página (`?sort=campo:asc`): lida ao abrir.
  useEffect(() => {
    const initial = parseSort(new URLSearchParams(window.location.search).get("sort"));
    if (initial && columns.some((c) => c.sortable && c.key === initial.field)) setSort(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeSort = (field: string) => {
    const next = nextSort(sort, field);
    setSort(next);
    setPage(1);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${withSortParam(window.location.search, next)}`);
  };

  const load = useCallback(async () => {
    const current = ++request.current;
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    for (const [k, v] of Object.entries(JSON.parse(extraKey) as ExtraParams)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(values)) if (v) params.set(k, v);
    if (sort) params.set("sort", formatSort(sort));
    setLoading(true);
    try {
      const res = await fetch(`${api}?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Page;
      if (current !== request.current) return;
      setData(body);
      setFailed(false);
    } catch {
      if (current !== request.current) return;
      setFailed(true);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [api, page, q, values, sort, size, extraKey]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = q !== "" || Object.values(values).some(Boolean);
  const clearFilters = () => {
    setQ("");
    setValues({});
    setPage(1);
  };

  const hrefFor = (row: Record<string, unknown>) => (rowHref ? rowHref.replace("{id}", String(row.id)) : `${basePath}/${row.id}/edit`);
  const newHref = `${basePath}/new`;

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / size));
  const first = total === 0 ? 0 : (page - 1) * size + 1;
  const last = Math.min(page * size, total);
  const showSkeleton = !failed && data === null;
  const items = data?.items ?? [];

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
          <span className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {data && data.total > 0 ? plural(data.total) : null}
          </span>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<Link href={newHref} />}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            Novo
          </Button>
        )}
      </div>

      <div role="search" className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <InputGroup className="sm:w-72">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="text"
            enterKeyHint="search"
            placeholder={searchPlaceholder}
            aria-label="Busca"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </InputGroup>
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
        {filtered && (
          <Button variant="ghost" className="justify-self-start text-muted-foreground" onClick={clearFilters}>
            <X data-icon="inline-start" aria-hidden="true" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* contain:inline-size impede que a largura da tabela alargue a página; a rolagem fica aqui dentro. */}
      <div className="overflow-hidden rounded-lg border [contain:inline-size]">
        <Table aria-busy={loading || undefined} className={cn("transition-opacity", loading && data && "opacity-60")}>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  aria-sort={c.sortable ? ariaSort(sort, c.key) : undefined}
                  className={cn("h-9 px-3 text-xs font-medium text-muted-foreground", columnClass(c))}
                >
                  {c.sortable ? <SortHeader column={c} sort={sort} onSort={() => changeSort(c.key)} /> : c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton &&
              Array.from({ length: 6 }, (_, r) => (
                <TableRow key={`sk-${r}`} className="hover:bg-transparent">
                  {columns.map((c, i) => (
                    <TableCell key={c.key} className={cn("h-11 px-3", columnClass(c))}>
                      <Skeleton className={cn("h-4", i === 0 ? "w-24" : "w-32", columnClass(c).includes("text-right") && "ml-auto")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!failed &&
              items.map((row) => {
                const href = hrefFor(row);
                return (
                  <TableRow
                    key={String(row.id)}
                    className="cursor-pointer"
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("a, button, input, [role=button]")) return;
                      if (window.getSelection()?.toString()) return;
                      if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
                      else router.push(href);
                    }}
                  >
                    {columns.map((c, i) => {
                      const raw = readPath(row, c.path ?? c.key);
                      const plain = !c.format || c.format === "text";
                      const content = formatCell(row, c);
                      const cell =
                        plain && typeof raw === "string" && raw ? (
                          <span className="block max-w-[18rem] truncate" title={raw}>
                            {content}
                          </span>
                        ) : (
                          content
                        );
                      return (
                        <TableCell key={c.key} className={cn("h-11 px-3", columnClass(c))}>
                          {i !== 0 ? (
                            cell
                          ) : c.format === "file" ? (
                            <div className="flex items-center gap-3">
                              {cell}
                              <Link
                                href={href}
                                className="sr-only rounded-sm text-sm font-medium outline-none focus-visible:not-sr-only focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                Abrir registro
                              </Link>
                            </div>
                          ) : (
                            <Link
                              className="block rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                              href={href}
                            >
                              {cell}
                            </Link>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}

            {failed && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="px-3 py-12">
                  <div className="flex flex-col items-center gap-3 text-center whitespace-normal" role="alert">
                    <p className="text-sm font-medium">Não foi possível carregar os registros.</p>
                    <p className="max-w-sm text-sm text-muted-foreground">Verifique a conexão e tente de novo. Se o problema continuar, avise o suporte.</p>
                    <Button variant="outline" onClick={() => void load()} disabled={loading}>
                      <RotateCw data-icon="inline-start" aria-hidden="true" className={cn(loading && "animate-spin")} />
                      Tentar de novo
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!failed && data && items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="px-3 py-12">
                  <div className="flex flex-col items-center gap-3 text-center whitespace-normal">
                    {filtered ? (
                      <>
                        <p className="text-sm font-medium">Nenhum registro corresponde à busca e aos filtros.</p>
                        <p className="max-w-sm text-sm text-muted-foreground">Revise o texto buscado ou remova filtros para ver mais resultados.</p>
                        <Button variant="outline" onClick={clearFilters}>
                          <X data-icon="inline-start" aria-hidden="true" />
                          Limpar filtros
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Ainda não há registros em {title}.</p>
                        {canCreate && (
                          <>
                            <p className="max-w-sm text-sm text-muted-foreground">Os registros incluídos aparecem aqui.</p>
                            <Button variant="outline" nativeButton={false} render={<Link href={newHref} />}>
                              <Plus data-icon="inline-start" aria-hidden="true" />
                              Novo
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {data && !failed && pages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {nf.format(first)}–{nf.format(last)} de {nf.format(total)}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Página {page} de {pages}
            </span>
            <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
