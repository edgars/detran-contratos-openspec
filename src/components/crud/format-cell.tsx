import { FileText } from "lucide-react";
import { formatCnpj, formatCpf, formatCurrency, formatDate } from "@/lib/format";
import type { ColumnDef } from "./types";

export function readPath(row: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), row);
}

/** Valor ausente: traço discreto, lido como "Não informado" por leitores de tela. */
function Empty() {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Não informado</span>
    </span>
  );
}

const isTrue = (value: unknown) => value === "S" || value === 1 || value === true || value === "1";

export function formatCell(row: Record<string, unknown>, column: ColumnDef): React.ReactNode {
  const value = readPath(row, column.path ?? column.key);
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return <Empty />;
  switch (column.format) {
    case "date": {
      const text = formatDate(value as string);
      return text ? <span className="tabular-nums">{text}</span> : <Empty />;
    }
    case "currency": {
      const text = formatCurrency(value as string);
      return text ? <span className="tabular-nums">{text}</span> : <Empty />;
    }
    case "cpf":
    case "cnpj": {
      const text = column.format === "cpf" ? formatCpf(String(value)) : formatCnpj(String(value));
      return text ? <span className="tabular-nums whitespace-nowrap">{text}</span> : <Empty />;
    }
    case "boolean":
      return isTrue(value) ? (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">Sim</span>
      ) : (
        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Não</span>
      );
    case "file":
      return (
        <a
          className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/api/arquivos/${value}`}
          target="_blank"
          rel="noreferrer"
        >
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          Ver PDF
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      );
    case "options": {
      const lista = Array.isArray(value) ? value : [value];
      return lista.map((v) => column.options?.find((o) => o.value === String(v))?.label ?? String(v)).join(", ");
    }
    default:
      return String(value);
  }
}
