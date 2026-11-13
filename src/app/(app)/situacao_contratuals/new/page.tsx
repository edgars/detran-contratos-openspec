import { EntityForm } from "@/components/crud/entity-form";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";

export default function NovoSituacaoContratualsPage() {
  return <EntityForm title="Nova situação contratual" api={situacaoContratuals.api} basePath={situacaoContratuals.basePath} fields={situacaoContratuals.fields} />;
}
