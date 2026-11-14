import { EntityList } from "@/components/crud/entity-list";
import { anexosPublicacaos } from "@/lib/entities/anexos_publicacaos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function AnexosPublicacaosPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("anexos_publicacaos", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "anexos_publicacaos", "criar")}
      title={anexosPublicacaos.title}
      api={anexosPublicacaos.api}
      basePath={anexosPublicacaos.basePath}
      columns={anexosPublicacaos.columns}
    />
  );
}
