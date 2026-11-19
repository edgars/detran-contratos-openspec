import { EntityList } from "@/components/crud/entity-list";
import { pagamentos } from "@/lib/entities/pagamentos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function PagamentosPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("pagamentos", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "pagamentos", "criar")}
      title={pagamentos.title}
      api={pagamentos.api}
      basePath={pagamentos.basePath}
      columns={pagamentos.columns}
    />
  );
}
