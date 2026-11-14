import { EntityList } from "@/components/crud/entity-list";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";

export default function SituacaoContratualsPage() {
  return <EntityList title={situacaoContratuals.title} api={situacaoContratuals.api} basePath={situacaoContratuals.basePath} columns={situacaoContratuals.columns} />;
}
