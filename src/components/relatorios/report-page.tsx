import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

/**
 * Moldura de uma tela de relatório (019-relatorios): título e descrição de tela, ações à direita.
 * `data-print="relatorio"` escopa a folha de impressão compacta (9pt) de src/app/globals.css.
 * `paisagem` declara A4 paisagem para a impressão (vencendo e vencidos).
 */
export function ReportPage({
  titulo,
  descricao,
  acoes,
  paisagem = false,
  children,
}: {
  titulo: string;
  descricao: ReactNode;
  acoes?: ReactNode;
  paisagem?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-print="relatorio" className="flex min-w-0 flex-col gap-5">
      {paisagem && <style>{"@page { size: A4 landscape; margin: 10mm }"}</style>}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 print:hidden">
        <div className="max-w-3xl space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{titulo}</h1>
          <p className="text-sm text-pretty text-muted-foreground">{descricao}</p>
        </div>
        {acoes}
      </div>
      {children}
    </div>
  );
}

/** Linha de resultado na tela: título do legado e contagem (o papel usa o `ReportHeader`). */
export function ResultadoTitulo({ titulo, contagem }: { titulo: string; contagem?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 print:hidden">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {contagem && <span className="text-sm text-muted-foreground tabular-nums">{contagem}</span>}
    </div>
  );
}

/** Aviso "Nenhum tipo de contrato está marcado como Contrato." com link para `/tipo_contratos`. */
export function AvisoSemTipoContrato() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
      <p>
        <span className="font-medium">Nenhum tipo de contrato está marcado como Contrato.</span>{" "}
        <span className="text-muted-foreground">Ligue “É o tipo Contrato (relatórios)” no tipo certo em </span>
        <Link href="/tipo_contratos" className="font-medium text-primary underline underline-offset-4">
          Tipos de contrato
        </Link>
        <span className="text-muted-foreground">.</span>
      </p>
    </div>
  );
}

/** Aviso de volume (design.md › Risks): não corta o resultado, só sugere restringir o filtro. */
export function AvisoVolume({ linhas }: { linhas: number }) {
  if (linhas <= 5000) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground print:hidden">
      O relatório tem {linhas.toLocaleString("pt-BR")} linhas. Para uma impressão mais leve, restrinja o filtro.
    </p>
  );
}

/** "1 contrato" / "N contratos". */
export function contratos(n: number) {
  return n === 1 ? "1 contrato" : `${n.toLocaleString("pt-BR")} contratos`;
}
