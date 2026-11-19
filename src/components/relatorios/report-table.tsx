import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColunaTabela<L> = {
  label: string;
  render: (linha: L) => ReactNode;
  /** Números e valores à direita, com algarismos tabulares. */
  numerica?: boolean;
  /** Texto longo (objeto): quebra em várias linhas em vez de esticar a tabela. */
  longa?: boolean;
  className?: string;
};

export const VAZIO = "Nenhum contrato encontrado.";

/** Célula vazia padronizada dos relatórios. */
export const traco = (v: ReactNode) => (v === null || v === undefined || v === "" ? <span className="text-muted-foreground">—</span> : v);

/**
 * Tabela dos relatórios (019-relatorios): `Table` do shadcn/ui, todas as linhas (sem paginação:
 * o impresso precisa de todas), rodapé de totais opcional. Sem linhas → "Nenhum contrato encontrado.".
 */
export function ReportTable<L>({
  colunas,
  linhas,
  chave,
  rodape,
  vazio = VAZIO,
  caption,
}: {
  colunas: ColunaTabela<L>[];
  linhas: L[];
  chave: (linha: L, index: number) => string | number;
  /** Células do rodapé (uma por coluna, `null` deixa vazia); uma célula só ocupa a linha inteira. */
  rodape?: ReactNode[];
  vazio?: string;
  caption?: string;
}) {
  if (linhas.length === 0) {
    return <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{vazio}</p>;
  }
  const alinhamento = (c: ColunaTabela<L>) => cn(c.numerica ? "text-right tabular-nums" : "text-left", c.className);
  return (
    <div className="overflow-hidden rounded-lg border [contain:inline-size] print:rounded-none print:border-0">
      <Table className="text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {colunas.map((c) => (
              <TableHead key={c.label} scope="col" className={cn("h-9 px-3 text-xs font-medium whitespace-nowrap text-muted-foreground", alinhamento(c))}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l, i) => (
            <TableRow key={chave(l, i)}>
              {colunas.map((c) => (
                <TableCell
                  key={c.label}
                  className={cn(
                    "px-3 py-2 align-top",
                    c.longa ? "max-w-[24rem] min-w-[14rem] whitespace-normal" : "whitespace-nowrap",
                    alinhamento(c),
                  )}
                >
                  {c.render(l)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {rodape && (
          <TableFooter className="bg-muted/40 font-medium">
            <TableRow className="hover:bg-transparent">
              {rodape.length === 1 ? (
                <TableCell colSpan={colunas.length} className="px-3 py-2 whitespace-nowrap">
                  {rodape[0]}
                </TableCell>
              ) : (
                colunas.map((c, i) => (
                  <TableCell key={c.label} className={cn("px-3 py-2 whitespace-nowrap", alinhamento(c))}>
                    {rodape[i] ?? null}
                  </TableCell>
                ))
              )}
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
