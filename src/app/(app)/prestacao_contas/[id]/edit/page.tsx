import { EntityForm } from "@/components/crud/entity-form";
import { prestacaoContas } from "@/lib/entities/prestacao_contas";

export default async function EditarPrestacaoContaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EntityForm
      title="Editar prestação de contas"
      api={prestacaoContas.api}
      basePath={prestacaoContas.basePath}
      fields={prestacaoContas.fields}
      id={id}
    />
  );
}
