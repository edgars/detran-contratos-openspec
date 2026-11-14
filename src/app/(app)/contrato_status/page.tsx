import { EntityList } from "@/components/crud/entity-list";
import { contratoStatus } from "@/lib/entities/contrato_status";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function ContratoStatusPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("contrato_status", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "contrato_status", "criar")}
      title={contratoStatus.title}
      api={contratoStatus.api}
      basePath={contratoStatus.basePath}
      columns={contratoStatus.columns}
      filters={contratoStatus.filters}
    />
  );
}
