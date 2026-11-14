import { EntityForm } from "@/components/crud/entity-form";
import { pagamentos } from "@/lib/entities/pagamentos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function EditarPagamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 023-perfis-acesso: abre com `ver`; sem `editar`, em modo leitura (sem Salvar nem Excluir).
  const user = await guardPage("pagamentos", "ver");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      readOnly={!can(user, "pagamentos", "editar")}
      canDelete={can(user, "pagamentos", "excluir")}
      canAttach={can(user, "pagamentos", "anexar")}
      title="Editar pagamento"
      api={pagamentos.api}
      basePath={pagamentos.basePath}
      fields={pagamentos.fields}
      id={id}
    />
  );
}
