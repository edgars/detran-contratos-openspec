"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botão *Imprimir* da página do contrato (020; ação PRINT de `contratos/visualizar` do legado). */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <PrinterIcon aria-hidden data-icon="inline-start" />
      Imprimir
    </Button>
  );
}
