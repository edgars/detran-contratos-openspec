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
  allowEmpty,
}: {
  id?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  allowEmpty?: boolean;
}) {
  const items = [...(allowEmpty ? [{ value: "", label: placeholder }] : []), ...options];
  return (
    <Select items={items} value={value || null} onValueChange={(v) => onChange(v == null ? "" : String(v))}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((o) => (
          <SelectItem key={o.value || "_vazio"} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
