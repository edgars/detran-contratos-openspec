import { EntityForm } from "@/components/crud/entity-form";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";

export default function NovoAnexoFiscalPage() {
  return <EntityForm title="Novo anexo de fiscalização" api={anexosFiscais.api} basePath={anexosFiscais.basePath} fields={anexosFiscais.fields} />;
}
