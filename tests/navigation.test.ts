import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, findNavItem, navByGroup } from "@/lib/navigation";
import { crumbsFor } from "@/components/shell/app-breadcrumb";
import { generateStaticParams } from "@/app/(app)/[entidade]/page";

// Spec app-shell › "Abrir o app"
const SPEC_ENTITIES = [
  "Departamentos", "TipoContratos", "ContratoStatus", "Users", "Pagamentos", "Modalidades",
  "PrestacaoContas", "Fases", "Fiscais", "Status", "Historicos", "AnexosFiscais",
  "SituacaoContratuals", "AnexosPublicacaos", "Penalidades", "Contratos",
  // 019-relatorios: item Relatórios.
  "Relatorios",
];

describe("navegação principal", () => {
  it("tem um item por entidade gerenciada, na ordem da spec", () => {
    expect(NAV_ITEMS.map((i) => i.name)).toEqual(SPEC_ENTITIES);
  });

  it("cada item abre uma rota existente", () => {
    const params = generateStaticParams().map((p) => `/${p.entidade}`);
    for (const item of NAV_ITEMS) {
      const ownPage = existsSync(`src/app/(app)${item.href}/page.tsx`);
      expect(ownPage || params.includes(item.href), item.href).toBe(true);
      expect(findNavItem(item.href.slice(1))).toBe(item);
    }
  });

  it("cada item aponta para a change que entrega a lista", () => {
    for (const item of NAV_ITEMS) {
      const archived = existsSync("openspec/changes/archive") && readdirSync("openspec/changes/archive").some((d) => d.endsWith(`-${item.change}`));
      expect(existsSync(`openspec/changes/${item.change}`) || archived, item.change).toBe(true);
    }
  });
});

// 019-relatorios › specs/app-shell/spec.md
describe("019 › item Relatórios", () => {
  it("Abrir o app: 'Relatórios' no grupo Gestão de contratos, logo depois de Contratos, abre /relatorios", () => {
    const grupo = navByGroup({ perfis: ["ADMINISTRADOR"] }).find((g) => g.id === "contratos")!;
    expect(grupo.label).toBe("Gestão de contratos");
    const nomes = grupo.items.map((i) => i.name);
    expect(nomes.indexOf("Relatorios")).toBe(nomes.indexOf("Contratos") + 1);
    expect(findNavItem("relatorios")).toMatchObject({ label: "Relatórios", href: "/relatorios", change: "019-relatorios" });
  });

  it("trilha: /relatorios/contratos-vencendo = Relatórios › Contratos vencendo", () => {
    expect(crumbsFor("/relatorios/contratos-vencendo")).toEqual([
      { label: "Relatórios", href: "/relatorios" },
      { label: "Contratos vencendo", href: "/relatorios/contratos-vencendo" },
    ]);
    expect(crumbsFor("/relatorios/acerto-valor").at(-1)?.label).toBe("Acerto de valor");
  });
});

// 023-perfis-acesso › specs/perfis-acesso/spec.md › "Menu e ações conforme as permissões"
describe("023 › menu conforme as permissões", () => {
  const nomes = (perfis: Parameters<typeof navByGroup>[0]["perfis"]) => navByGroup({ perfis }).flatMap((g) => g.items.map((i) => i.name));

  it("Menu da Consulta: Contratos, Relatórios e os cadastros auxiliares; sem Usuários, Pagamentos, Históricos nem Anexos", () => {
    const menu = nomes(["CONSULTA"]);
    for (const n of ["Contratos", "Relatorios", "Departamentos", "TipoContratos", "Modalidades", "SituacaoContratuals", "Fases", "Status"]) {
      expect(menu, n).toContain(n);
    }
    for (const n of ["Users", "Pagamentos", "Historicos", "AnexosFiscais", "AnexosPublicacaos"]) expect(menu, n).not.toContain(n);
    // Grupos que ficam vazios somem.
    expect(navByGroup({ perfis: ["CONSULTA"] }).map((g) => g.id)).toEqual(["contratos", "cadastros"]);
  });

  it("cada item declara um recurso; Administrador vê todos; sem perfil, nenhum", () => {
    expect(nomes(["ADMINISTRADOR"]).sort()).toEqual(NAV_ITEMS.map((i) => i.name).sort());
    expect(navByGroup({ perfis: [] })).toEqual([]);
  });

  it("perfis somam: Fiscal + Financeiro vê Pagamentos e Anexos de fiscalização, não Usuários", () => {
    const menu = nomes(["FISCAL", "FINANCEIRO"]);
    expect(menu).toContain("Pagamentos");
    expect(menu).toContain("AnexosFiscais");
    expect(menu).not.toContain("Users");
  });
});
