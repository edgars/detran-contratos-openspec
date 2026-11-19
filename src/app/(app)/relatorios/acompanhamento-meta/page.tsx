import Link from "next/link";
import { ReportActions } from "@/components/relatorios/report-actions";
import { ReportHeader } from "@/components/relatorios/report-header";
import { AvisoSemTipoContrato, ReportPage } from "@/components/relatorios/report-page";
import { ReportTable, traco, type ColunaTabela } from "@/components/relatorios/report-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { SEM_TIPO_CONTRATO } from "@/lib/relatorios/comum";
import { JANELA_RISCO, consultar, type BlocoMeta, type LinhaMeta } from "@/lib/relatorios/acompanhamento-meta";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const COLUNAS: ColunaTabela<LinhaMeta>[] = [
  { label: "Processo", render: (l) => traco(l.processo), className: "tabular-nums" },
  {
    label: "Contrato",
    render: (l) => (
      <Link href={`/contratos/${l.id}`} className="font-medium tabular-nums underline-offset-4 hover:text-primary hover:underline">
        {l.contrato || `#${l.id}`}
      </Link>
    ),
  },
  { label: "Objeto", render: (l) => l.objeto, longa: true },
  { label: "Contratada", render: (l) => traco(l.contratada), className: "max-w-[14rem] whitespace-normal!" },
  { label: "Gestor", render: (l) => traco(l.gestor) },
  { label: "UN Gestora", render: (l) => traco(l.unidade) },
  { label: "Vencimento", render: (l) => traco(formatDate(l.vencimento)), numerica: true },
  { label: "Dias para vencer", render: (l) => traco(l.diasParaVencer), numerica: true },
  { label: "Na Presidência", render: (l) => (l.naPresidencia ? "Sim" : "Não") },
  { label: "Valor total", render: (l) => traco(formatCurrency(l.valorTotal)), numerica: true },
];

const DESCRICAO: Record<BlocoMeta["lista"], string> = {
  total: "Tipo Contrato, vigentes (término depois de hoje).",
  vencidos: "Tipo Contrato, término antes de hoje, por contratada.",
  risco: `Tipos marcados como risco da meta, vencendo em até ${JANELA_RISCO} dias.`,
};

const termos = (n: number) => (n === 1 ? "1 termo" : `${n} termos`);

/** Acompanhamento de meta (019-relatorios), igual ao legado (docs/legado/relatorios.md, tela `meta`). */
export default async function AcompanhamentoMetaPage() {
  // 023-perfis-acesso: a tela exige `relatorios:listar`; *Imprimir* e *Exportar CSV* só com `exportar`.
  const user = await guardPage("relatorios", "listar");
  if (!user) return <SemPermissao />;
  const exportar = can(user, "relatorios", "exportar");
  const resultado = await consultar();
  const semTipo = resultado.avisos?.includes(SEM_TIPO_CONTRATO);
  return (
    <ReportPage
      titulo="Acompanhamento de meta"
      descricao="Contratos originais em três listas: vigentes do tipo Contrato, vencidos do tipo Contrato e em prorrogação/risco."
      acoes={exportar && <ReportActions />}
    >
      <ReportHeader titulo={resultado.titulo} />
      {semTipo && <AvisoSemTipoContrato />}

      <section aria-labelledby="meta-resumo" className="flex flex-col gap-3">
        <h2 id="meta-resumo" className="text-base font-semibold">
          Resumo
        </h2>
        <div className="overflow-hidden rounded-lg border [contain:inline-size] print:rounded-none print:border-0">
          <Table className="text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="h-9 px-3 text-xs font-medium text-muted-foreground">
                  Lista
                </TableHead>
                <TableHead scope="col" className="h-9 px-3 text-right text-xs font-medium text-muted-foreground">
                  Valor total
                </TableHead>
                <TableHead scope="col" className="h-9 px-3 text-right text-xs font-medium text-muted-foreground">
                  Nº de termos
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.listas.map((b) => (
                <TableRow key={b.lista} data-lista={b.lista}>
                  <TableCell className="px-3 py-2">
                    <a href={`#meta-${b.lista}`} className="font-medium underline-offset-4 hover:text-primary hover:underline">
                      {b.rotulo}
                    </a>
                    <span className="block text-xs text-muted-foreground print:hidden">{DESCRICAO[b.lista]}</span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums">{formatCurrency(b.valorTotal)}</TableCell>
                  <TableCell className="px-3 py-2 text-right tabular-nums">{b.termos}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {resultado.listas.map((b) => (
        <section
          key={b.lista}
          id={`meta-${b.lista}`}
          aria-labelledby={`meta-${b.lista}-titulo`}
          className="flex scroll-mt-20 flex-col gap-3"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id={`meta-${b.lista}-titulo`} className="text-base font-semibold">
              {b.rotulo}
            </h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {termos(b.termos)} · {formatCurrency(b.valorTotal)}
            </span>
          </div>
          <ReportTable caption={b.rotulo} colunas={COLUNAS} linhas={b.linhas} chave={(l) => l.id} />
        </section>
      ))}
    </ReportPage>
  );
}
