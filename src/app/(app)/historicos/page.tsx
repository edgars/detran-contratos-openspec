import { EntityList } from "@/components/crud/entity-list";
import { historicos } from "@/lib/entities/historicos";
import { SemPermissao } from "@/components/sem-permissao";
import { guardPage } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";

export default async function HistoricosPage() {
  // 023-perfis-acesso: lista exige `listar`; *Novo* só com `criar`.
  const user = await guardPage("historicos", "listar");
  if (!user) return <SemPermissao />;
  return (
    <EntityList
      canCreate={can(user, "historicos", "criar")}
      title={historicos.title}
      api={historicos.api}
      basePath={historicos.basePath}
      columns={historicos.columns}
      filters={historicos.filters}
      searchPlaceholder="Buscar por contrato ou descrição"
    />
  );
}
