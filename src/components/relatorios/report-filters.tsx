"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { MaskedInput } from "@/components/masked-input";
import { OptionSelect } from "@/components/crud/option-select";
import type { Option } from "@/components/crud/types";
import { cn } from "@/lib/utils";

/**
 * Filtros dos relatórios (019-relatorios): formulário `method="get"` — os filtros vão para a URL e o
 * servidor gera o relatório. Erro de validação aparece inline no campo. Não sai na impressão.
 */
export function ReportFilters({ action, children, limparHref }: { action: string; children: ReactNode; limparHref?: string }) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label="Filtros do relatório"
      className="flex flex-wrap items-start gap-x-3 gap-y-3 rounded-lg border bg-muted/30 p-3 sm:p-4 print:hidden"
    >
      {children}
      <div className="flex items-center gap-2 self-start pt-6">
        <Button type="submit">Gerar</Button>
        {limparHref && (
          <a href={limparHref} className="rounded-sm px-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Limpar
          </a>
        )}
      </div>
    </form>
  );
}

const GROUP_CONTROL =
  "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent";

type Base = { name: string; label: string; defaultValue?: string; error?: string; className?: string; required?: boolean };

function Campo({ name, label, error, className, children }: Base & { children: ReactNode }) {
  return (
    <Field className={cn("w-full gap-1.5 sm:w-auto", className)} data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={`f-${name}`}>{label}</FieldLabel>
      {children}
      {error && <FieldError id={`f-${name}-erro`}>{error}</FieldError>}
    </Field>
  );
}

/** Data `dd/mm/aaaa` com máscara (fundação › locale-and-formats). */
export function CampoData(props: Base) {
  const [value, setValue] = useState(props.defaultValue ?? "");
  return (
    <Campo {...props} className={cn("sm:w-40", props.className)}>
      <InputGroup className="bg-background">
        <InputGroupAddon>
          <CalendarDays aria-hidden />
        </InputGroupAddon>
        <MaskedInput
          id={`f-${props.name}`}
          name={props.name}
          data-slot="input-group-control"
          className={GROUP_CONTROL}
          mask="##/##/####"
          placeholder="dd/mm/aaaa"
          value={value}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? `f-${props.name}-erro` : undefined}
          aria-required={props.required || undefined}
          onValueChange={setValue}
        />
      </InputGroup>
    </Campo>
  );
}

/** Número inteiro (ex.: dias). */
export function CampoNumero(props: Base & { min?: number; max?: number; sufixo?: string }) {
  return (
    <Campo {...props} className={cn("sm:w-36", props.className)}>
      <InputGroup className="bg-background">
        <Input
          id={`f-${props.name}`}
          name={props.name}
          data-slot="input-group-control"
          className={cn(GROUP_CONTROL, "tabular-nums")}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          defaultValue={props.defaultValue}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error ? `f-${props.name}-erro` : undefined}
          aria-required={props.required || undefined}
        />
        {props.sufixo && <InputGroupAddon align="inline-end">{props.sufixo}</InputGroupAddon>}
      </InputGroup>
    </Campo>
  );
}

/** Texto livre (ex.: busca por objeto). */
export function CampoTexto(props: Base & { placeholder?: string }) {
  return (
    <Campo {...props} className={cn("sm:w-72", props.className)}>
      <Input
        id={`f-${props.name}`}
        name={props.name}
        type="search"
        className="bg-background"
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        aria-invalid={props.error ? true : undefined}
      />
    </Campo>
  );
}

/** Select do shadcn/ui; o valor vai num `input` oculto para o formulário `method="get"`. */
export function CampoSelect(props: Base & { options: Option[]; placeholder?: string; vazio?: string }) {
  const [value, setValue] = useState(props.defaultValue ?? "");
  return (
    <Campo {...props} className={cn("sm:w-60", props.className)}>
      <div className="bg-background rounded-lg">
        <OptionSelect
          id={`f-${props.name}`}
          value={value}
          options={props.options}
          onChange={setValue}
          placeholder={props.vazio ?? "Todos"}
          allowEmpty
          invalid={!!props.error}
          describedBy={props.error ? `f-${props.name}-erro` : undefined}
        />
      </div>
      <input type="hidden" name={props.name} value={value} />
    </Campo>
  );
}
