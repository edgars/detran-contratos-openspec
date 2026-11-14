import { prisma } from "@/lib/db";
import { ReportActions } from "@/components/relatorios/report-actions";
import { CampoSelect, ReportFilters } from "@/components/relatorios/report-filters";
import { ReportHeader, type FiltroAplicado } from "@/components/relatorios/report-header";
import { AvisoVolume, ReportPage, ResultadoTitulo, contratos } from "@/components/relatorios/report-page";
import { ReportTable, traco, type ColunaTabela } from "@/components/relatorios/report-table";
import { formatCurrency } from "@/lib/format";
import { csvHref, lerParams } from "@/lib/relatorios/params";
import { consultar, gestores, params, slug, type LinhaGestor } from "@/lib/relatorios/contratos-por-gestor";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const COLUNAS: ColunaTabela<LinhaGestor>[] = [
  { label: "Qtde", render: (l) => l.qtde, numerica: true },
  { label: "Tipo", render: (l) => traco(l.tipo) },
  { label: "Valor acumulado", render: (l) => formatCurrency(l.valorAcumulado), numerica: true },
  { label: "Gestor", render: (l) => (l.gestorCpf ? l.gestor : <span className="text-muted-foreground">{l.gestor}</span>) },
  { label: "UN Gestora", render: (l) => traco(l.unidade) },
];

/** Contratos por gestor (019-relatorios; docs/legado/relatorios.md, tela `gestores`). */
export default async function ContratosPorGestorPage({ searchParams }: Props) {
  const lido = lerParams(params, await searchParams);
  const erros = lido.ok ? {} : lido.errors;
  const [opcoesGestor, departamentos, resultado] = await Promise.all([
    gestores(),
    prisma.departamento.findMany({ select: { id: true, deDepartamento: true }, orderBy: { deDepartamento: "asc" } }),
    lido.ok ? consultar(lido.data) : null,
  ]);
  const opcoesUnidade = departamentos.map((d) => ({ value: String(d.id), label: d.deDepartamento }));

  const filtros: FiltroAplicado[] = [];
  if (lido.ok && lido.data.gestor) {
    filtros.push({ label: "Gestor", valor: opcoesGestor.find((o) => o.value === lido.data.gestor)?.label ?? lido.data.gestor });
  }
  if (lido.ok && lido.data.departamentoId) {
    filtros.push({ label: "UN Gestora", valor: opcoesUnidade.find((o) => o.value === String(lido.data.departamentoId))?.label ?? "—" });
  }
  const filtrado = filtros.length > 0;

  return (
    <ReportPage
      titulo="Contratos por gestor"
      descricao="Contratos originais agrupados por gestor, tipo de contrato e unidade gestora, com a quantidade e a soma do valor total."
      acoes={resultado && <ReportActions csvHref={csvHref(slug, lido.raw)} />}
    >
      <ReportFilters action="/relatorios/contratos-por-gestor" limparHref={filtrado ? "/relatorios/contratos-por-gestor" : undefined}>
        <CampoSelect name="gestor" label="Gestor" options={opcoesGestor} vazio="Todos os gestores" defaultValue={lido.raw.gestor} error={erros.gestor} className="sm:w-72" />
        <CampoSelect
          name="departamentoId"
          label="UN Gestora"
          options={opcoesUnidade}
          vazio="Todas as unidades"
          defaultValue={lido.raw.departamentoId}
          error={erros.departamentoId}
          className="sm:w-72"
        />
      </ReportFilters>

      {resultado && (
        <section aria-label="Resultado" className="flex flex-col gap-3">
          <ReportHeader titulo={resultado.titulo} filtros={filtros} />
          <ResultadoTitulo titulo={resultado.titulo} contagem={contratos(resultado.totais.qtde)} />
          <AvisoVolume linhas={resultado.linhas.length} />
          <ReportTable
            caption={resultado.titulo}
            colunas={COLUNAS}
            linhas={resultado.linhas}
            chave={(l, i) => `${l.gestorCpf ?? ""}|${l.tipo ?? ""}|${l.unidade ?? ""}|${i}`}
            rodape={resultado.linhas.length ? [resultado.totais.qtde, "Total", formatCurrency(resultado.totais.valorAcumulado), null, null] : undefined}
          />
        </section>
      )}
    </ReportPage>
  );
}
