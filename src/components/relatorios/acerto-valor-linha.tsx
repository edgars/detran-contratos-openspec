"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { TableCell, TableRow } from "@/components/ui/table";

export type AcertoLinha = {
  id: number;
  processo: string | null;
  contrato: string | null;
  objeto: string;
  unidade: string | null;
  contratada: string | null;
};

const MSG_VALOR = "Informe o valor no formato 1.234,56";

/** Valor no formato da máscara de moeda (`1.234,56`)? Conferido também no servidor. */
export function valorValido(texto: string) {
  return /^(\d{1,3}(\.\d{3})*|\d+)(,\d{1,2})?$/.test(texto.trim());
}

function Vazio() {
  return <span className="text-muted-foreground">—</span>;
}

/**
 * Linha de Acerto de valor (019-relatorios): input moeda e *Gravar* (`PUT /api/relatorios/acerto-valor/:id`).
 * Sucesso → toast e a linha sai da lista; erro → mensagem na própria linha.
 */
export function AcertoValorLinha({ linha }: { linha: AcertoLinha }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gravado, setGravado] = useState(false);
  if (gravado) return null;

  const inputId = `valor-${linha.id}`;
  const erroId = `${inputId}-erro`;
  const nome = linha.contrato ? `contrato ${linha.contrato}` : `contrato #${linha.id}`;

  async function gravar(event: React.FormEvent) {
    event.preventDefault();
    if (!valorValido(valor)) {
      setErro(MSG_VALOR);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/relatorios/acerto-valor/${linha.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorInicial: valor }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setGravado(true);
        toast.success(`Valor inicial do ${nome} gravado.`);
        router.refresh();
        return;
      }
      setErro(body?.errors?.valorInicial ?? body?.error ?? "Não foi possível gravar. Tente de novo.");
      if (res.status === 404 || res.status === 409) router.refresh();
    } catch {
      setErro("Não foi possível gravar. Verifique a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="px-3 py-2 align-top whitespace-nowrap tabular-nums">{linha.processo ?? <Vazio />}</TableCell>
      <TableCell className="px-3 py-2 align-top font-medium whitespace-nowrap tabular-nums">{linha.contrato ?? <Vazio />}</TableCell>
      <TableCell className="max-w-[24rem] min-w-[14rem] px-3 py-2 align-top whitespace-normal">{linha.objeto}</TableCell>
      <TableCell className="px-3 py-2 align-top whitespace-nowrap">{linha.unidade ?? <Vazio />}</TableCell>
      <TableCell className="max-w-[16rem] px-3 py-2 align-top whitespace-normal">{linha.contratada ?? <Vazio />}</TableCell>
      <TableCell className="px-3 py-2 align-top">
        <form onSubmit={gravar} className="flex min-w-[15rem] flex-col gap-1" noValidate>
          <div className="flex items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              Valor inicial do {nome}
            </label>
            <InputGroup className="w-36">
              <InputGroupAddon className="tabular-nums">R$</InputGroupAddon>
              <InputGroupInput
                id={inputId}
                inputMode="decimal"
                placeholder="0,00"
                autoComplete="off"
                className="text-right tabular-nums"
                value={valor}
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? erroId : undefined}
                onChange={(e) => {
                  setValor(e.target.value.replace(/[^\d.,]/g, ""));
                  if (erro) setErro(null);
                }}
              />
            </InputGroup>
            <Button type="submit" variant="outline" disabled={salvando || valor.trim() === ""}>
              {salvando && <Loader2 className="animate-spin" data-icon="inline-start" aria-hidden />}
              Gravar
            </Button>
          </div>
          {erro && (
            <p id={erroId} role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </form>
      </TableCell>
    </TableRow>
  );
}
