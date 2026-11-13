import { formatCurrency, formatDate } from "@/lib/format";
import type { ColumnDef } from "./types";

export function readPath(row: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), row);
}

export function formatCell(row: Record<string, unknown>, column: ColumnDef): React.ReactNode {
  const value = readPath(row, column.path ?? column.key);
  if (value === null || value === undefined || value === "") return "—";
  switch (column.format) {
    case "date":
      return formatDate(value as string);
    case "currency":
      return formatCurrency(value as string);
    case "boolean":
      return value === "S" || value === 1 || value === true || value === "1" ? "Sim" : "Não";
    case "file":
      return (
        <a className="underline" href={`/api/arquivos/${value}`} target="_blank" rel="noreferrer">
          PDF
        </a>
      );
    default:
      return String(value);
  }
}
