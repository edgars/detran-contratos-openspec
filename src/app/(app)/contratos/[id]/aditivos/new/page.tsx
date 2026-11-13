import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/crud/entity-form";
import { contratos } from "@/lib/entities/contratos";
import { getContratoDetalhe } from "@/lib/entities/contratos.server";

export const dynamic = "force-dynamic";

/** Novo aditivo: grava um contrato filho via `POST /api/contratos/:id/aditivos`. */
export default async function NovoAditivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = /^\d+$/.test(id) ? await getContratoDetalhe(Number(id)) : null;
  if (!detalhe) notFound();
  const numero = detalhe.contrato.numeroContrato ?? `#${id}`;
  const voltar = `${contratos.basePath}/${id}`;
  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        href={voltar}
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        <span className="tabular-nums">Voltar ao contrato {numero}</span>
      </Link>
      <EntityForm
        title={`Novo aditivo do contrato ${numero}`}
        api={`${contratos.api}/${id}/aditivos`}
        basePath={voltar}
        afterSavePath={voltar}
        fields={contratos.aditivoFields}
        submitLabel="Salvar aditivo"
      />
    </div>
  );
}
