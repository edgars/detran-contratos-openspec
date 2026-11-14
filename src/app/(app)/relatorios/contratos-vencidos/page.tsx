import { ReportActions } from "@/components/relatorios/report-actions";
import { CampoData, ReportFilters } from "@/components/relatorios/report-filters";
import { ReportHeader } from "@/components/relatorios/report-header";
import { AvisoVolume, ReportPage, ResultadoTitulo, contratos } from "@/components/relatorios/report-page";
import { ReportTable } from "@/components/relatorios/report-table";
import { COLUNAS_TABELA_CONTRATO } from "@/components/relatorios/colunas-contrato";
import { csvHref, lerParams, temFiltro } from "@/lib/relatorios/params";
import { consultar, params, slug } from "@/lib/relatorios/contratos-vencidos";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Contratos vencidos (019-relatorios; docs/legado/relatorios.md, tela `vencidos`). Abre sem consulta até gerar. */
export default async function ContratosVencidosPage({ searchParams }: Props) {
  const lido = lerParams(params, await searchParams);
  const gerado = temFiltro(lido.raw);
  const erros = gerado && !lido.ok ? lido.errors : {};
  const resultado = gerado && lido.ok ? await consultar(lido.data) : null;

  return (
    <ReportPage
      paisagem
      titulo="Contratos vencidos"
      descricao="Contratos originais cuja data de término está no período informado, as duas datas inclusive."
      acoes={resultado && <ReportActions csvHref={csvHref(slug, lido.raw)} />}
    >
      <ReportFilters action="/relatorios/contratos-vencidos" limparHref={gerado ? "/relatorios/contratos-vencidos" : undefined}>
        <CampoData name="inicio" label="Vencimento de" required defaultValue={lido.raw.inicio} error={erros.inicio} />
        <CampoData name="fim" label="até" required defaultValue={lido.raw.fim} error={erros.fim} />
      </ReportFilters>

      {!gerado && <p className="text-sm text-muted-foreground">Informe o período e acione Gerar.</p>}
      {resultado && (
        <section aria-label="Resultado" className="flex flex-col gap-3">
          {/* O título do legado já traz o período: nenhum outro filtro a listar. */}
          <ReportHeader titulo={resultado.titulo} />
          <ResultadoTitulo titulo={resultado.titulo} contagem={contratos(resultado.linhas.length)} />
          <AvisoVolume linhas={resultado.linhas.length} />
          <ReportTable
            caption={resultado.titulo}
            colunas={COLUNAS_TABELA_CONTRATO}
            linhas={resultado.linhas}
            chave={(l) => l.id}
            rodape={resultado.linhas.length ? [`Total: ${contratos(resultado.linhas.length)}`] : undefined}
          />
        </section>
      )}
    </ReportPage>
  );
}
