import { EntityList } from "@/components/crud/entity-list";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function AnexosFiscaisPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("anexos_fiscais", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "anexos_fiscais", "criar")}
      title={anexosFiscais.title}
      api={anexosFiscais.api}
      basePath={anexosFiscais.basePath}
      columns={anexosFiscais.columns}
    />
  );
}
