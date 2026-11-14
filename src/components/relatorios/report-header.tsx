import { formatDate } from "@/lib/format";

export type FiltroAplicado = { label: string; valor: string };

/**
 * Cabeçalho de impressão dos relatórios (019-relatorios › Conteúdo impresso): título do legado,
 * filtros aplicados e "Emitido em dd/MM/yyyy". Só aparece no papel (`hidden print:block`).
 */
export function ReportHeader({ titulo, filtros = [], emitidoEm = new Date() }: { titulo: string; filtros?: FiltroAplicado[]; emitidoEm?: Date }) {
  const hoje = new Date(Date.UTC(emitidoEm.getFullYear(), emitidoEm.getMonth(), emitidoEm.getDate()));
  return (
    <div className="mb-3 hidden border-b border-black pb-2 print:block" data-report-header>
      <p className="text-[8pt] tracking-wide uppercase">DETRAN-RJ · Gestão de contratos</p>
      <h2 className="text-[13pt] leading-tight font-semibold">{titulo}</h2>
      <p className="mt-1 text-[8.5pt]">
        {filtros.length > 0 && (
          <>
            {filtros.map((f, i) => (
              <span key={f.label}>
                {i > 0 && " · "}
                {f.label}: {f.valor}
              </span>
            ))}
            {" · "}
          </>
        )}
        Emitido em {formatDate(hoje)}
      </p>
    </div>
  );
}
