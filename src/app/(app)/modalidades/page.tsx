import { EntityList } from "@/components/crud/entity-list";
import { modalidades } from "@/lib/entities/modalidades";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function ModalidadesPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("cadastros", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "cadastros", "criar")}
      title={modalidades.title}
      api={modalidades.api}
      basePath={modalidades.basePath}
      columns={modalidades.columns}
    />
  );
}
