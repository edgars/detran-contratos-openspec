"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Option } from "./types";

/** Select do shadcn/ui (base-ui) para uma lista de opções. Valor vazio = nenhum. */
export function OptionSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Selecione",
  invalid,
  describedBy,
  required,
  allowEmpty,
}: {
  id?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Ids do texto de ajuda/erro do campo (aria-describedby). */
  describedBy?: string;
  required?: boolean;
  allowEmpty?: boolean;
}) {
  const items = [...(allowEmpty ? [{ value: "", label: placeholder }] : []), ...options];
  return (
    <Select items={items} value={value || null} onValueChange={(v) => onChange(v == null ? "" : String(v))}>
      <SelectTrigger id={id} className="h-8 w-full min-w-0" aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-required={required || undefined}>
        <SelectValue placeholder={placeholder} className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent className="max-w-[min(32rem,calc(100vw-2rem))]">
        {items.map((o) =>
          o.value === "" ? (
            <SelectItem key="_vazio" value="" className="text-muted-foreground">
              {o.label}
            </SelectItem>
          ) : (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
