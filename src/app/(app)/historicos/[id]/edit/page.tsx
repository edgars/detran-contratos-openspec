import { EntityForm } from "@/components/crud/entity-form";
import { historicos } from "@/lib/entities/historicos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarHistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("historicos", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "historicos", "editar")}
      canDelete={can(user, "historicos", "excluir")}
      canAttach={can(user, "historicos", "anexar")}
      title="Editar histórico"
      api={historicos.api}
      basePath={historicos.basePath}
      fields={historicos.fields}
      id={id}
    />
  );
}
