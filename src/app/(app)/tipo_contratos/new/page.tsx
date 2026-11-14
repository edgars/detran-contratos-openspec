import { EntityForm } from "@/components/crud/entity-form";
import { tipoContratos } from "@/lib/entities/tipo_contratos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoTipoContratosPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("cadastros", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "cadastros", "anexar")}
      title="Novo tipo de contrato"
      api={tipoContratos.api}
      basePath={tipoContratos.basePath}
      fields={tipoContratos.fields}
    />
  );
}
