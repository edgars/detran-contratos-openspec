import { EntityList } from "@/components/crud/entity-list";
import { fiscais } from "@/lib/entities/fiscais";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function FiscaisPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("fiscais", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "fiscais", "criar")}
      title={fiscais.title}
      api={fiscais.api}
      basePath={fiscais.basePath}
      columns={fiscais.columns}
      filters={fiscais.filters}
      searchPlaceholder="Buscar por CPF"
    />
  );
}
