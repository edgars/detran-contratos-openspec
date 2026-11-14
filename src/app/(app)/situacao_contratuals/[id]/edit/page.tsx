import { EntityForm } from "@/components/crud/entity-form";
import { situacaoContratuals } from "@/lib/entities/situacao_contratuals";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarSituacaoContratualsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("cadastros", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "cadastros", "editar")}
      canDelete={can(user, "cadastros", "excluir")}
      canAttach={can(user, "cadastros", "anexar")}
      title="Editar situação contratual"
      api={situacaoContratuals.api}
      basePath={situacaoContratuals.basePath}
      fields={situacaoContratuals.fields}
      id={id}
    />
  );
}
