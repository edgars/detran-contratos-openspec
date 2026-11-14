"use client";

import { useState } from "react";
import { ChevronsUpDownIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { moreResultsMessage } from "./remote-search";
import { useRemoteOptions, useResolvedOption } from "./use-options";
import type { LookupConfig, Option } from "./types";

type Rich = Option & { name?: string; detail?: string };

/** "Nome — 529.982.247-25" com o documento discreto e em algarismos tabulares (o texto lido é o rótulo inteiro). */
function OptionLabel({ option }: { option: Rich }) {
  if (!option.name || !option.detail) return <span className="min-w-0 truncate">{option.label}</span>;
  return (
    <span className="min-w-0 truncate">
      {option.name}
      <span className="text-muted-foreground tabular-nums"> — {option.detail}</span>
    </span>
  );
}

/**
 * Campo de busca remota do kit (022-pessoas-fornecedores, design.md D6): shadcn/ui `Popover` +
 * `Command` (`shouldFilter={false}`: quem filtra é a API). Consulta `GET <api>?q=<texto>&size=20`
 * 300 ms depois da última tecla, mostra "<nome> — <documento>", avisa quando há mais resultados
 * do que os exibidos e resolve o rótulo do valor já gravado ao abrir uma edição.
 */
export function RemoteLookup({
  id,
  value,
  lookup,
  onChange,
  placeholder = "Selecione",
  invalid,
  describedBy,
  required,
  allowClear,
  className,
}: {
  id?: string;
  value: string;
  lookup: LookupConfig;
  onChange: (value: string) => void;
  /** Texto do gatilho sem valor escolhido. */
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  /** Mostra a ação "Limpar" (campo não obrigatório e filtros). */
  allowClear?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Rich | null>(null);
  const state = useRemoteOptions(lookup, query, open);
  const selected = useResolvedOption(lookup, value, picked) as Rich | null;
  const searchPlaceholder = lookup.detailFormat === "cnpj" ? "Busca (CNPJ ou Razão social)" : "Busca (CPF ou Nome)";
  const more = state.status === "ok" ? moreResultsMessage(state.options.length, state.total) : null;
  const searching = state.status === "loading" && state.options.length === 0;
  const empty = state.status === "ok" && state.options.length === 0;
  const canClear = Boolean(allowClear && value);
  const hasFooter = searching || empty || state.status === "error" || Boolean(more) || canClear;

  const choose = (option: Rich | null) => {
    setPicked(option);
    onChange(option?.value ?? "");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className,
        )}
      >
        {value ? (
          selected ? (
            <OptionLabel option={selected} />
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              <span className="truncate">Carregando…</span>
            </span>
          )
        ) : (
          <span className="min-w-0 truncate text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--anchor-width) min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(32rem,calc(100vw-2rem))] gap-0 p-0">
        <Command shouldFilter={false} className="rounded-lg!">
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} aria-label={searchPlaceholder} />
          <CommandList>
            {state.options.length > 0 && (
              <CommandGroup>
                {state.options.map((option) => (
                  <CommandItem key={option.value} value={option.value} data-checked={option.value === value} onSelect={() => choose(option)}>
                    <OptionLabel option={option} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        {/* A região de aviso fica sempre montada para o leitor de tela anunciar as mudanças. */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 text-xs text-muted-foreground",
            hasFooter ? "min-h-9 border-t px-3 py-1.5" : "sr-only",
          )}
        >
          <p aria-live="polite" className="min-w-0 text-pretty">
            {searching && (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Buscando…
              </span>
            )}
            {state.status === "error" && <span className="text-destructive">Erro ao buscar</span>}
            {empty && "Nenhum resultado"}
            {more}
          </p>
          {canClear && (
            <Button type="button" variant="ghost" size="xs" className="-mr-1.5 shrink-0" onClick={() => choose(null)}>
              <X aria-hidden />
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
