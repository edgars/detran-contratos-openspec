import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS, findNavItem } from "@/lib/navigation";
import { generateStaticParams } from "@/app/(app)/[entidade]/page";

// Spec app-shell › "Abrir o app"
const SPEC_ENTITIES = [
  "Departamentos", "TipoContratos", "ContratoStatus", "Users", "Pagamentos", "Modalidades",
  "PrestacaoContas", "Fases", "Fiscais", "Status", "Historicos", "AnexosFiscais",
  "SituacaoContratuals", "AnexosPublicacaos", "Penalidades", "Contratos",
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
