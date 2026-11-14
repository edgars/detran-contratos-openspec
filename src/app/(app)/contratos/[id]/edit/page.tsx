import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/crud/entity-form";
import { contratos } from "@/lib/entities/contratos";
import { getContratoDetalhe } from "@/lib/entities/contratos.server";

export const dynamic = "force-dynamic";

/** Texto do diálogo de exclusão (020, design.md › Exclusão de contrato). */
const EXCLUSAO =
  "O contrato e seus anexos, andamentos, históricos e fiscais serão excluídos definitivamente. Esta ação não pode ser desfeita.";

export default async function EditarContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = /^\d+$/.test(id) ? await getContratoDetalhe(Number(id)) : null;
  if (!detalhe) notFound();
  const numero = detalhe.contrato.numeroContrato ?? `#${id}`;
  const verContrato = `${contratos.basePath}/${id}`;
  return (
    <div className="space-y-4">
      <Link
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        href={verContrato}
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        <span className="tabular-nums">Voltar ao contrato {numero}</span>
      </Link>
      <EntityForm
        title={`Editar contrato ${numero}`}
        api={contratos.api}
        basePath={contratos.basePath}
        fields={contratos.fields}
        id={id}
        submitLabel="Salvar contrato"
        deleteDescription={EXCLUSAO}
      />
    </div>
  );
}
