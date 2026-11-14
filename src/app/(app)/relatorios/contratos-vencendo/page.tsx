import { ReportActions } from "@/components/relatorios/report-actions";
import { CampoData, CampoNumero, CampoSelect, ReportFilters } from "@/components/relatorios/report-filters";
import { ReportHeader, type FiltroAplicado } from "@/components/relatorios/report-header";
import { AvisoVolume, ReportPage, ResultadoTitulo, contratos } from "@/components/relatorios/report-page";
import { ReportTable } from "@/components/relatorios/report-table";
import { COLUNAS_TABELA_CONTRATO } from "@/components/relatorios/colunas-contrato";
import { formatDate } from "@/lib/format";
import { ORDENACOES_VENCENDO, csvHref, lerParams, temFiltro } from "@/lib/relatorios/params";
import { ROTULOS_ORDENACAO, consultar, params, slug } from "@/lib/relatorios/contratos-vencendo";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ORDENACOES = ORDENACOES_VENCENDO.map((o) => ({ value: o, label: ROTULOS_ORDENACAO[o] }));
const DIRECOES = [
  { value: "asc", label: "Crescente" },
  { value: "desc", label: "Decrescente" },
];

/** Contratos vencendo (019-relatorios; docs/legado/relatorios.md, tela `vencendo`). */
export default async function ContratosVencendoPage({ searchParams }: Props) {
  const lido = lerParams(params, await searchParams);
  const gerado = temFiltro(lido.raw);
  const erros = gerado && !lido.ok ? lido.errors : {};
  const resultado = gerado && lido.ok ? await consultar(lido.data) : null;

  const filtros: FiltroAplicado[] = [];
  if (lido.ok && gerado) {
    if (lido.data.inicio && lido.data.fim) filtros.push({ label: "Período", valor: `${formatDate(lido.data.inicio)} a ${formatDate(lido.data.fim)}` });
    filtros.push({ label: "Ordenação", valor: `${ROTULOS_ORDENACAO[lido.data.sort]} (${lido.data.dir === "desc" ? "decrescente" : "crescente"})` });
  }

  return (
    <ReportPage
      paisagem
      titulo="Contratos vencendo"
      descricao="Contratos originais que vencem em mais de 0 e menos de N dias a partir de hoje. Com período, só os que vencem entre as duas datas."
      acoes={resultado && <ReportActions csvHref={csvHref(slug, lido.raw)} />}
    >
      <ReportFilters action="/relatorios/contratos-vencendo" limparHref={gerado ? "/relatorios/contratos-vencendo" : undefined}>
        <CampoNumero name="dias" label="Vencendo em" sufixo="dias" required defaultValue={lido.raw.dias} error={erros.dias} />
        <CampoData name="inicio" label="Vencimento de" defaultValue={lido.raw.inicio} error={erros.inicio} />
        <CampoData name="fim" label="até" defaultValue={lido.raw.fim} error={erros.fim} />
        <CampoSelect name="sort" label="Ordenar por" options={ORDENACOES} vazio="Vencimento" defaultValue={lido.raw.sort} error={erros.sort} />
        <CampoSelect name="dir" label="Ordem" options={DIRECOES} vazio="Crescente" defaultValue={lido.raw.dir} error={erros.dir} className="sm:w-36" />
      </ReportFilters>

      {!gerado && <p className="text-sm text-muted-foreground">Informe o número de dias e acione Gerar.</p>}
      {resultado && (
        <section aria-label="Resultado" className="flex flex-col gap-3">
          <ReportHeader titulo={resultado.titulo} filtros={filtros} />
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
