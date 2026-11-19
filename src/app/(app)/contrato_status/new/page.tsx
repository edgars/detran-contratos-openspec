import { EntityForm } from "@/components/crud/entity-form";
import { contratoStatus } from "@/lib/entities/contrato_status";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoContratoStatusPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("contrato_status", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "contrato_status", "anexar")}
      title="Novo status do contrato"
      api={contratoStatus.api}
      basePath={contratoStatus.basePath}
      fields={contratoStatus.fields}
    />
  );
}
