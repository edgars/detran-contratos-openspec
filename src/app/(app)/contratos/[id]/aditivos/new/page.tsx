import { EntityForm } from "@/components/crud/entity-form";
import { contratos } from "@/lib/entities/contratos";

/** Novo aditivo: grava um contrato filho via `POST /api/contratos/:id/aditivos`. */
export default async function NovoAditivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detalhe = `${contratos.basePath}/${id}`;
  return (
    <EntityForm
      title="Novo aditivo"
      api={`${contratos.api}/${id}/aditivos`}
      basePath={detalhe}
      afterSavePath={detalhe}
      fields={contratos.aditivoFields}
    />
  );
}
