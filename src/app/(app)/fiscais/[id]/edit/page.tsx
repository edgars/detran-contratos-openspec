import { EntityForm } from "@/components/crud/entity-form";
import { fiscais } from "@/lib/entities/fiscais";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarFiscalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("fiscais", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "fiscais", "editar")}
      canDelete={can(user, "fiscais", "excluir")}
      canAttach={can(user, "fiscais", "anexar")}
      title="Editar fiscal"
      api={fiscais.api}
      basePath={fiscais.basePath}
      fields={fiscais.fields}
      id={id}
    />
  );
}
