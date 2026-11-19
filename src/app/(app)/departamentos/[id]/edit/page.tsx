import { EntityForm } from "@/components/crud/entity-form";
import { departamentos } from "@/lib/entities/departamentos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarDepartamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("cadastros", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "cadastros", "editar")}
      canDelete={can(user, "cadastros", "excluir")}
      canAttach={can(user, "cadastros", "anexar")}
      title="Editar departamento"
      api={departamentos.api}
      basePath={departamentos.basePath}
      fields={departamentos.fields}
      id={id}
    />
  );
}
