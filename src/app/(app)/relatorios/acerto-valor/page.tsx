import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AcertoValorLinha } from "@/components/relatorios/acerto-valor-linha";
import { CampoTexto, ReportFilters } from "@/components/relatorios/report-filters";
import { ReportPage, ResultadoTitulo, contratos } from "@/components/relatorios/report-page";
import { VAZIO } from "@/components/relatorios/report-table";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { lerParams } from "@/lib/relatorios/params";
import { consultar, params } from "@/lib/relatorios/acerto-valor";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const CABECALHO = ["Nº processo", "Nº contrato", "Objeto", "UN Gestora", "Contratada", "Valor inicial"];

function pagina(q: string | undefined, page: number) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return `/relatorios/acerto-valor${s ? `?${s}` : ""}`;
}

/** Acerto de valor (019-relatorios; docs/legado/relatorios.md, tela `acertoValor`). Sem impressão nem CSV. */
export default async function AcertoValorPage({ searchParams }: Props) {
  const lido = lerParams(params, await searchParams);
  const erros = lido.ok ? {} : lido.errors;
  const resultado = lido.ok ? await consultar(lido.data) : null;
  const q = lido.ok ? lido.data.q : undefined;

  return (
    <ReportPage
      titulo="Acerto de valor"
      descricao="Contratos originais sem valor inicial. Informe o valor de cada um e acione Gravar: a linha sai da lista."
    >
      <ReportFilters action="/relatorios/acerto-valor" limparHref={q ? "/relatorios/acerto-valor" : undefined}>
        <CampoTexto name="q" label="Objeto contém" placeholder="Ex.: limpeza" defaultValue={lido.raw.q} error={erros.q ?? erros.page} />
      </ReportFilters>

      {resultado && (
        <section aria-label="Resultado" className="flex flex-col gap-3">
          <ResultadoTitulo titulo="Contratos sem valor inicial" contagem={contratos(resultado.total)} />
          {resultado.linhas.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{VAZIO}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border [contain:inline-size]">
              <Table className="text-sm">
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    {CABECALHO.map((c) => (
                      <TableHead key={c} scope="col" className="h-9 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.linhas.map((l) => (
                    <AcertoValorLinha key={l.id} linha={l} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {resultado.paginas > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground tabular-nums">
                Página {resultado.page} de {resultado.paginas}
              </span>
              <div className="flex gap-2">
                <Link
                  href={pagina(q, resultado.page - 1)}
                  aria-disabled={resultado.page <= 1}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), resultado.page <= 1 && "pointer-events-none opacity-50")}
                >
                  <ChevronLeft data-icon="inline-start" aria-hidden />
                  Anterior
                </Link>
                <Link
                  href={pagina(q, resultado.page + 1)}
                  aria-disabled={resultado.page >= resultado.paginas}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    resultado.page >= resultado.paginas && "pointer-events-none opacity-50",
                  )}
                >
                  Próxima
                  <ChevronRight data-icon="inline-end" aria-hidden />
                </Link>
              </div>
            </nav>
          )}
        </section>
      )}
    </ReportPage>
  );
}
