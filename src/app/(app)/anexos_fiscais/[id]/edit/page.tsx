import { EntityForm } from "@/components/crud/entity-form";
import { anexosFiscais } from "@/lib/entities/anexos_fiscais";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarAnexoFiscalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("anexos_fiscais", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "anexos_fiscais", "editar")}
      canDelete={can(user, "anexos_fiscais", "excluir")}
      canAttach={can(user, "anexos_fiscais", "anexar")}
      title="Editar anexo de fiscalização"
      api={anexosFiscais.api}
      basePath={anexosFiscais.basePath}
      fields={anexosFiscais.fields}
      id={id}
    />
  );
}
