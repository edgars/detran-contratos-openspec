import { EntityForm } from "@/components/crud/entity-form";
import { pagamentos } from "@/lib/entities/pagamentos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function NovoPagamentoPage() {
  // 023-perfis-acesso: criação exige `criar`; campos de arquivo só com `anexar`.
  const user = await guardPage("pagamentos", "criar");
  if (!user) return <SemPermissao />;
  return (
    <EntityForm
      canAttach={can(user, "pagamentos", "anexar")}
      title="Novo pagamento"
      api={pagamentos.api}
      basePath={pagamentos.basePath}
      fields={pagamentos.fields}
    />
  );
}
