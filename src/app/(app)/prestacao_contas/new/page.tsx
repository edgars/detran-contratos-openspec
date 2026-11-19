import { EntityForm } from "@/components/crud/entity-form";
import { prestacaoContas } from "@/lib/entities/prestacao_contas";

export default function NovaPrestacaoContaPage() {
  return (
    <EntityForm
      title="Nova prestação de contas"
      api={prestacaoContas.api}
      basePath={prestacaoContas.basePath}
      fields={prestacaoContas.fields}
    />
  );
}
