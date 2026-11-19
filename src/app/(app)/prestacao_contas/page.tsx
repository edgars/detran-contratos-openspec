import { EntityList } from "@/components/crud/entity-list";
import { prestacaoContas } from "@/lib/entities/prestacao_contas";

export default function PrestacaoContasPage() {
  return (
    <EntityList
      title={prestacaoContas.title}
      api={prestacaoContas.api}
      basePath={prestacaoContas.basePath}
      columns={prestacaoContas.columns}
    />
  );
}
