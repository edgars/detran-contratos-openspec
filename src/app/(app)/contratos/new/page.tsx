import { EntityForm } from "@/components/crud/entity-form";
import { contratos } from "@/lib/entities/contratos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoContratoPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("contratos", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "contratos", "anexar")}
      title="Novo contrato"
      api={contratos.api}
      basePath={contratos.basePath}
      fields={contratos.fields}
    />
  );
}
