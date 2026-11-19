import { EntityForm } from "@/components/crud/entity-form";
import { fiscais } from "@/lib/entities/fiscais";

export default function NovoFiscalPage() {
  return <EntityForm title="Novo fiscal" api={fiscais.api} basePath={fiscais.basePath} fields={fiscais.fields} />;
}
