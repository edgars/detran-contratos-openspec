import { EntityList } from "@/components/crud/entity-list";
import { contratos } from "@/lib/entities/contratos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function ContratosPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("contratos", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "contratos", "criar")}
      title={contratos.title}
      api={contratos.api}
      basePath={contratos.basePath}
      columns={contratos.columns}
      filters={contratos.filters}
      searchPlaceholder="Processo, contrato ou objeto"
      rowHref="/contratos/{id}"
    />
  );
}
