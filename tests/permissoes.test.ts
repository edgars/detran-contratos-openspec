/// <reference types="vite/client" />
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("next/headers", () => import("./helpers/next-headers-mock"));
import { readFileSync, readdirSync } from "node:fs";
import { prisma } from "@/lib/db";
import { ACOES, MATRIZ, PERFIS, RECURSOS, can, permissoesDe, type Acao, type Perfil, type Recurso } from "@/lib/auth/permissions";
import { perfisDoLegado } from "@/lib/auth/perfis-legado";
import { PDF_BYTES, idParams, jsonRequest, loginAs } from "./helpers/auth";

// bcrypt custo 12: cada usuário novo leva ~0,3 s.
vi.setConfig({ testTimeout: 120_000 });

/**
 * 023-perfis-acesso › tasks 2.1, 3.7 e 6.1: testes dirigidos pela MATRIZ. Para cada recurso servido
 * pelo kit, cada perfil isolado e cada ação, o handler responde 403 quando a ação não está na matriz
 * e outra coisa quando está. Mais: perfis somados, usuário sem perfil, e a cobertura de todas as rotas.
 */

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type RouteModule = Record<string, unknown>;

// Todas as rotas da API (eager): a cobertura percorre esta lista.
const ROTAS = import.meta.glob<RouteModule>("../src/app/api/**/route.ts", { eager: true });
const caminho = (arquivo: string) => arquivo.replace("../src/app", "").replace(/\/route\.ts$/, "");
const rota = (api: string) => {
  const m = ROTAS[`../src/app${api}/route.ts`];
  if (!m) throw new Error(`rota inexistente: ${api}`);
  return m;
};

/** Recursos do kit, com a coleção e o item (`[id]`) e se têm campo de arquivo. */
const KIT: { recurso: Recurso; api: string; item: boolean; arquivo?: string }[] = [
  { recurso: "contratos", api: "/api/contratos", item: true, arquivo: "anexo" },
  { recurso: "contrato_status", api: "/api/contrato_status", item: true },
  { recurso: "historicos", api: "/api/historicos", item: true },
  { recurso: "fiscais", api: "/api/fiscais", item: true },
  { recurso: "anexos_fiscais", api: "/api/anexos_fiscais", item: true, arquivo: "anexo" },
  { recurso: "anexos_publicacaos", api: "/api/anexos_publicacaos", item: true, arquivo: "anexo" },
  { recurso: "penalidades", api: "/api/penalidades", item: true, arquivo: "arquivo" },
  { recurso: "pagamentos", api: "/api/pagamentos", item: true },
  // Prestação de contas: registros só leitura (sem PUT nem DELETE, 021).
  { recurso: "prestacao_contas", api: "/api/prestacao_contas", item: true },
  { recurso: "cadastros", api: "/api/departamentos", item: true },
  { recurso: "cadastros", api: "/api/tipo_contratos", item: true },
  { recurso: "cadastros", api: "/api/modalidades", item: true },
  { recurso: "cadastros", api: "/api/situacao_contratuals", item: true },
  { recurso: "cadastros", api: "/api/situacao_contratual", item: true },
  { recurso: "cadastros", api: "/api/fases", item: true },
  { recurso: "cadastros", api: "/api/status", item: true },
  { recurso: "users", api: "/api/users", item: true },
];

const ID_INEXISTENTE = 987654;
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params) });
const pdf = () => new File([PDF_BYTES], "m.pdf", { type: "application/pdf" });

async function como(perfis: Perfil[]) {
  return loginAs(`matriz.${perfis.join("+").toLowerCase() || "sem-perfil"}`, perfis);
}

/** Chama a ação no handler do kit; id inexistente e corpo vazio: nada é gravado nem apagado. */
async function chamar(api: string, acao: Acao, arquivo?: string): Promise<number> {
  const col = rota(api);
  const item = rota(`${api}/[id]`);
  const id = String(ID_INEXISTENTE);
  const h = (m: RouteModule, verbo: string) => m[verbo] as Handler | undefined;
  switch (acao) {
    case "listar":
      return (await h(col, "GET")!(jsonRequest(api), ctx())).status;
    case "ver":
      return (await h(item, "GET")!(jsonRequest(`${api}/${id}`), idParams(id))).status;
    case "criar":
      return (await h(col, "POST")!(jsonRequest(api, "POST", {}), ctx())).status;
    case "editar":
      return (await h(item, "PUT")!(jsonRequest(`${api}/${id}`, "PUT", {}), idParams(id))).status;
    case "excluir":
      return (await h(item, "DELETE")!(jsonRequest(`${api}/${id}`, "DELETE"), idParams(id))).status;
    case "anexar": {
      const form = new FormData();
      form.set(arquivo!, pdf());
      return (await h(col, "POST")!(new Request(`http://localhost${api}`, { method: "POST", body: form }), ctx())).status;
    }
    default:
      throw new Error(acao);
  }
}

/** O que a matriz manda para (perfil, recurso, ação) no handler do kit. */
function esperado(perfis: Perfil[], recurso: Recurso, acao: Acao): boolean {
  const u = { perfis };
  // `ver` em contratos também é servido pela visão restrita (`contratos_resumo`).
  if (acao === "ver" && recurso === "contratos") return can(u, "contratos", "ver") || can(u, "contratos_resumo", "ver");
  // Arquivo no corpo: `criar` e `anexar`.
  if (acao === "anexar") return can(u, recurso, "criar") && can(u, recurso, "anexar");
  return can(u, recurso, acao);
}

describe("023 › can, permissoesDe e mapeamento do legado", () => {
  it("can: união dos perfis; lista vazia nega tudo (cenário Usuário com dois perfis)", () => {
    expect(can({ perfis: ["FISCAL"] }, "pagamentos", "criar")).toBe(false);
    expect(can({ perfis: ["FINANCEIRO"] }, "anexos_fiscais", "criar")).toBe(false);
    const ambos = { perfis: ["FISCAL", "FINANCEIRO"] as Perfil[] };
    expect(can(ambos, "pagamentos", "criar")).toBe(true);
    expect(can(ambos, "anexos_fiscais", "criar")).toBe(true);
    for (const r of RECURSOS) for (const a of ACOES) expect(can({ perfis: [] }, r, a)).toBe(false);
    expect(can(null, "contratos", "listar")).toBe(false);
  });

  it("matriz final do autor: só Administrador exclui contrato; Fiscal e Financeiro só leem contratos", () => {
    for (const p of PERFIS) expect(can({ perfis: [p] }, "contratos", "excluir"), p).toBe(p === "ADMINISTRADOR");
    for (const p of ["FISCAL", "FINANCEIRO"] as Perfil[]) {
      expect(MATRIZ.contratos[p as "FISCAL"]).toEqual(["listar", "ver"]);
    }
    expect(MATRIZ.contratos.CONSULTA).toEqual(["listar"]);
    expect(MATRIZ.acerto_valor).toEqual({ ADMINISTRADOR: ["listar", "editar"] });
  });

  it("permissoesDe: formato recurso:ação", () => {
    const fin = permissoesDe(["FINANCEIRO"]);
    expect(fin).toContain("pagamentos:criar");
    expect(fin).not.toContain("contratos:editar");
    expect(fin.every((p) => /^[a-z_]+:[a-z]+$/.test(p))).toBe(true);
    expect(permissoesDe([])).toEqual([]);
  });

  it("perfisDoLegado: ContratoCGCL, Gestor, PrestacaoConta, Pagamentos; nome desconhecido é ignorado", () => {
    expect(perfisDoLegado(["ContratoCGCL"])).toEqual(["ADMINISTRADOR"]);
    expect(perfisDoLegado(["Gestor"])).toEqual(["GESTOR_CONTRATO"]);
    expect(perfisDoLegado(["PrestacaoConta"])).toEqual(["GESTOR_CONTRATO"]);
    expect(perfisDoLegado(["Pagamentos"])).toEqual(["FINANCEIRO"]);
    expect(perfisDoLegado(["Gestor", "PrestacaoConta", "Pagamentos", "Desconhecido", "toString"])).toEqual(["GESTOR_CONTRATO", "FINANCEIRO"]);
  });
});

describe("023 › matriz × handlers do kit (perfil isolado)", () => {
  for (const perfil of PERFIS) {
    it(`${perfil}: 403 exatamente onde a matriz nega`, async () => {
      await como([perfil]);
      const divergencias: string[] = [];
      for (const { recurso, api, item, arquivo } of KIT) {
        const acoes: Acao[] = ["listar", "criar"];
        const itemMod = item ? rota(`${api}/[id]`) : undefined;
        if (itemMod?.GET) acoes.push("ver");
        if (itemMod?.PUT) acoes.push("editar");
        if (itemMod?.DELETE) acoes.push("excluir");
        if (arquivo) acoes.push("anexar");
        for (const acao of acoes) {
          const status = await chamar(api, acao, arquivo);
          const pode = esperado([perfil], recurso, acao);
          if ((status === 403) === pode) divergencias.push(`${api} ${acao}: ${status} (matriz: ${pode ? "permite" : "nega"})`);
        }
      }
      expect(divergencias).toEqual([]);
    });
  }

  it("Usuário sem perfil: 403 em toda ação de todo recurso do kit", async () => {
    await como([]);
    for (const { api, arquivo } of KIT) {
      for (const acao of ["listar", "ver", "criar", ...(arquivo ? (["anexar"] as const) : [])] as Acao[]) {
        expect(await chamar(api, acao, arquivo), `${api} ${acao}`).toBe(403);
      }
    }
  });

  it("dois perfis somados: Gestor de contrato + Financeiro cria pagamento (Financeiro) e exclui fiscal (Gestor)", async () => {
    await como(["GESTOR_CONTRATO", "FINANCEIRO"]);
    expect(await chamar("/api/pagamentos", "criar")).not.toBe(403);
    expect(await chamar("/api/fiscais", "excluir")).not.toBe(403);
    expect(await chamar("/api/contratos", "excluir")).toBe(403);
  });
});

/** Rotas só-sessão (sem recurso): login/logout/me e a troca da própria senha. */
const SO_SESSAO = ["/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/conta/senha"];
const VERBOS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
/** Total de `route.ts` em src/app/api (conferido no disco). */
const TOTAL_ROTAS = readdirSync("src/app/api", { recursive: true }).filter((f) => String(f).endsWith("route.ts")).length;

describe("023 › cobertura: toda rota da API checa permissão", () => {
  let anexo: string;
  beforeAll(async () => {
    anexo = "66666666-6666-6666-6666-666666666666.pdf";
    await prisma.contrato.create({ data: { objeto: "Cobertura 023", anexo } });
  });

  it("estática: cada route.ts usa o kit (resource obrigatório), requirePermission, ou é só-sessão", () => {
    // O glob enxerga todas as rotas (inclusive as de [id] e [nome]).
    expect(Object.keys(ROTAS)).toHaveLength(TOTAL_ROTAS);
    const sem: string[] = [];
    for (const arquivo of Object.keys(ROTAS)) {
      const api = caminho(arquivo);
      if (SO_SESSAO.includes(api)) continue;
      const fonte = readFileSync(arquivo.replace("../", ""), "utf8");
      const ok = /Api\.\w+|listFiscais|removeUser|requirePermission|referenceListHandler|rotaRelatorio/.test(fonte);
      if (!ok) sem.push(api);
    }
    expect(sem).toEqual([]);
  });

  it("dinâmica: usuário logado sem perfil recebe 403 em todo handler exportado (exceto as rotas só-sessão)", async () => {
    await como([]);
    const vazou: string[] = [];
    for (const [arquivo, mod] of Object.entries(ROTAS)) {
      const api = caminho(arquivo);
      for (const verbo of VERBOS) {
        const handler = mod[verbo] as Handler | undefined;
        if (!handler) continue;
        const req = new Request(`http://localhost${api.replace("[id]", "1").replace("[nome]", anexo)}`, {
          method: verbo,
          headers: verbo === "GET" || verbo === "DELETE" ? undefined : { "Content-Type": "application/json" },
          body: verbo === "GET" || verbo === "DELETE" ? undefined : "{}",
        });
        const status = (await handler(req, ctx({ id: "1", nome: anexo }))).status;
        if (SO_SESSAO.includes(api)) continue; // só sessão: o status depende do corpo, nunca da matriz
        if (status !== 403) vazou.push(`${verbo} ${api}: ${status}`);
      }
      // A rota de login cria sessão nova: volta para o usuário sem perfil.
      if (api === "/api/auth/login" || api === "/api/auth/logout") await como([]);
    }
    expect(vazou).toEqual([]);
  });
});
