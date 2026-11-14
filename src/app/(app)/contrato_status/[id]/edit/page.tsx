import { EntityForm } from "@/components/crud/entity-form";
import { contratoStatus } from "@/lib/entities/contrato_status";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarContratoStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("contrato_status", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "contrato_status", "editar")}
      canDelete={can(user, "contrato_status", "excluir")}
      canAttach={can(user, "contrato_status", "anexar")}
      title="Editar status do contrato"
      api={contratoStatus.api}
      basePath={contratoStatus.basePath}
      fields={contratoStatus.fields}
      id={id}
    />
  );
}
