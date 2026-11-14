import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import type { LinhaContrato } from "@/lib/relatorios/linha-contrato";
import { traco, type ColunaTabela } from "./report-table";

/** Colunas de Contratos vencendo e vencidos, na ordem do legado (docs/legado/relatorios.md). */
export const COLUNAS_TABELA_CONTRATO: ColunaTabela<LinhaContrato>[] = [
  { label: "Contratada", render: (l) => traco(l.contratada), className: "min-w-[10rem] max-w-[14rem] whitespace-normal!" },
  { label: "Gestor", render: (l) => traco(l.gestor) },
  { label: "UN Gestora", render: (l) => traco(l.unidade), className: "min-w-[9rem] max-w-[13rem] whitespace-normal!" },
  { label: "Tipo", render: (l) => traco(l.tipo) },
  {
    label: "Contrato",
    render: (l) => (
      <Link href={`/contratos/${l.id}`} className="font-medium tabular-nums underline-offset-4 hover:text-primary hover:underline">
        {l.contrato || `#${l.id}`}
      </Link>
    ),
  },
  { label: "Processo", render: (l) => traco(l.processo), className: "tabular-nums" },
  { label: "Objeto", render: (l) => l.objeto, longa: true },
  { label: "Valor total", render: (l) => traco(formatCurrency(l.valorTotal)), numerica: true },
  { label: "Vencimento", render: (l) => traco(formatDate(l.vencimento)), numerica: true },
];
