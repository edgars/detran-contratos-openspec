"use client";

import { Download, Printer } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Abre o diálogo de impressão do navegador (onde o operador escolhe "Salvar como PDF"). */
export function imprimir(win: Pick<Window, "print"> = window) {
  win.print();
}

/**
 * Barra de ações dos relatórios (019-relatorios): *Imprimir / PDF* (`window.print()`) e *Exportar
 * CSV* (link para a API com os mesmos parâmetros e `formato=csv`). Não sai na impressão.
 */
export function ReportActions({ imprimivel = true, csvHref }: { imprimivel?: boolean; csvHref?: string }) {
  if (!imprimivel && !csvHref) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {imprimivel && (
        <Button type="button" variant="outline" onClick={() => imprimir()}>
          <Printer data-icon="inline-start" aria-hidden />
          Imprimir / PDF
        </Button>
      )}
      {csvHref && (
        <a href={csvHref} download className={cn(buttonVariants({ variant: "outline" }))}>
          <Download data-icon="inline-start" aria-hidden />
          Exportar CSV
        </a>
      )}
    </div>
  );
}
