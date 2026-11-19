import { EntityList } from "@/components/crud/entity-list";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function SituacaoContratualsPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("cadastros", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "cadastros", "criar")}
      title={situacaoContratuals.title}
      api={situacaoContratuals.api}
      basePath={situacaoContratuals.basePath}
      columns={situacaoContratuals.columns}
    />
  );
}
