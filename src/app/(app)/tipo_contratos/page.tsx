import { EntityList } from "@/components/crud/entity-list";
import { tipoContratos } from "@/lib/entities/tipo_contratos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function TipoContratosPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("cadastros", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "cadastros", "criar")}
      title={tipoContratos.title}
      api={tipoContratos.api}
      basePath={tipoContratos.basePath}
      columns={tipoContratos.columns}
    />
  );
}
