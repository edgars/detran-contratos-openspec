import { EntityForm } from "@/components/crud/entity-form";
import { penalidades } from "@/lib/entities/penalidades";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarPenalidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("penalidades", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "penalidades", "editar")}
      canDelete={can(user, "penalidades", "excluir")}
      canAttach={can(user, "penalidades", "anexar")}
      title="Editar penalidade"
      api={penalidades.api}
      basePath={penalidades.basePath}
      fields={penalidades.fields}
      id={id}
    />
  );
}
