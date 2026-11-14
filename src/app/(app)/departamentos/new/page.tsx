import { EntityForm } from "@/components/crud/entity-form";
import { departamentos } from "@/lib/entities/departamentos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoDepartamentosPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("cadastros", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "cadastros", "anexar")}
      title="Novo departamento"
      api={departamentos.api}
      basePath={departamentos.basePath}
      fields={departamentos.fields}
    />
  );
}
