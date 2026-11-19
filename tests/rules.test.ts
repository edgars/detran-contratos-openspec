import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ANEXO_CONTRATO,
  ANEXO_CONTRATO_MODELO,
  ANEXO_FISCAL,
  ANEXO_PUBLICACAO,
  ARQUIVO_PENALIDADE,
  MSG,
  anexoFiscalFields,
  checkAttachment,
  contratoFields,
  contratoStatusFields,
  departamentoFields,
  diretoriaFields,
  faseFields,
  fiscalFields,
  groupFields,
  pagamentoArquivoFields,
  pagamentoFields,
  pessoaFisicaFields,
  prestadorServicoFields,
  tipoContratoFields,
  userFields,
  validatePasswordChange,
} from "@/lib/rules";
import { fieldErrors } from "@/lib/api/http";

// Spec cross-cutting-rules: um caso por regra, citado pela chave RK.

/** O campo obrigatório recusa vazio, nulo e ausente, e aceita um valor válido. */
function expectRequired(fields: z.ZodRawShape, field: string, valid: unknown, message?: string) {
  const schema = z.object({ [field]: fields[field] });
  for (const blank of [undefined, null, "", "   "]) {
    const result = schema.safeParse(blank === undefined ? {} : { [field]: blank });
    expect(result.success, `${field}=${JSON.stringify(blank)}`).toBe(false);
    if (message && !result.success) expect(fieldErrors(result.error)[field]).toBe(message);
  }
  expect(schema.safeParse({ [field]: valid }).success).toBe(true);
}

const pdf = { type: "application/pdf", size: 10, name: "a.pdf" };
const png = { type: "image/png", size: 10, name: "a.png" };

const required: Array<[string[], z.ZodRawShape, string, unknown, string?]> = [
  [["RK-db6786831c50", "RK-7bc5e0466e28"], diretoriaFields, "deDiretoria", "Diretoria Geral"],
  [["RK-4b678b1a2fb6", "RK-7a6417845e4d"], diretoriaFields, "codigo", "DG"],
  [["RK-32ab70ab3174", "RK-fa60f5d06b79", "RK-b053f93a0c93", "RK-b33fcd808e28"], pessoaFisicaFields, "idPessoaFisica", "42"],
  [["RK-fcc74046a0bd", "RK-94d8b17e5a88", "RK-76de6c0f44c8", "RK-06d8ff662d9a"], pessoaFisicaFields, "dtNascimento", "10/05/1980"],
  [["RK-4e6358dbafbf", "RK-52fdc2d97389", "RK-ecfa90099032"], departamentoFields, "deDepartamento", "Compras"],
  [["RK-afd830d80ecf", "RK-08a8c7c1e5ea", "RK-528cec3828cf"], prestadorServicoFields, "deRazaoSocial", "ACME Ltda"],
  [["RK-77287deac605"], pagamentoArquivoFields, "arquivo", "nota.pdf"],
  [["RK-82de63b47e64"], tipoContratoFields, "nome", "Serviço contínuo", MSG.nomeTipoContrato],
  [["RK-2509b78bd0e0", "RK-4564e4e322b6"], tipoContratoFields, "gerenciamento", "S"],
  [["RK-d76edbb42dbe", "RK-39dd9b2d1419"], userFields, "username", "maria"],
  [["RK-3e9d7e57ae65", "RK-38821207df73"], userFields, "password", "segredo"],
  [["RK-774f44ed6df9"], pagamentoFields, "competencia", "01/11/2026"],
  [["RK-879233539305", "RK-ee6cd831c2d4"], contratoFields, "objeto", "Manutenção predial"],
  [["RK-13dd23ce5afd"], faseFields, "nome", "Abertura"],
  [["RK-877afa57a9f9"], faseFields, "periodo", "mensal"],
  [["RK-0f7caf172fab"], fiscalFields, "suplente", "N"],
  [["RK-6b60cd49b7ed"], fiscalFields, "presidente", "S"],
  [["RK-9da08201400b", "RK-0e70b6c81ee9"], anexoFiscalFields, "anexo", "relatorio.pdf"],
  [["RK-3424ea0367fa", "RK-f6b71997ac15"], groupFields, "name", "Gestores", MSG.nomeGrupo],
];

describe("campos obrigatórios", () => {
  for (const [keys, fields, field, valid, message] of required) {
    it(`${keys.join(" ")} — ${field} é obrigatório`, () => expectRequired(fields, field, valid, message));
  }

  it("RK-fcc74046a0bd — recusa data de nascimento inexistente", () => {
    const schema = z.object({ dtNascimento: pessoaFisicaFields.dtNascimento });
    expect(schema.safeParse({ dtNascimento: "31/02/1980" }).success).toBe(false);
  });
});

describe("valores derivados", () => {
  it('RK-f0ce91a53de9 — aspas duplas da descrição viram simples antes de gravar', () => {
    const schema = z.object(contratoStatusFields);
    expect(schema.parse({ descricao: 'Aditivo "2º termo"' }).descricao).toBe("Aditivo '2º termo'");
    expect(schema.parse({}).descricao).toBeUndefined();
  });
});

describe("anexos", () => {
  const cases: Array<[string, string, typeof ANEXO_FISCAL, "missing" | "notPdf"]> = [
    ["RK-23cdd0c37c3c", "anexo fiscal sem arquivo", ANEXO_FISCAL, "missing"],
    ["RK-01658245d11b", "anexo fiscal não PDF", ANEXO_FISCAL, "notPdf"],
    ["RK-e2b53b79c3c2", "anexo de publicação sem arquivo", ANEXO_PUBLICACAO, "missing"],
    ["RK-9aa2ad64672e", "anexo de publicação não PDF", ANEXO_PUBLICACAO, "notPdf"],
    ["RK-abb6ac79fad7", "arquivo de penalidade ausente", ARQUIVO_PENALIDADE, "missing"],
    ["RK-174d58601890", "arquivo de penalidade não PDF", ARQUIVO_PENALIDADE, "notPdf"],
    ["RK-ed7bc4aaba15", "anexo do contrato não PDF", ANEXO_CONTRATO, "notPdf"],
    ["RK-d2c51245ec1e", "anexo enviado pelo contrato não PDF", ANEXO_CONTRATO_MODELO, "notPdf"],
  ];
  for (const [key, title, rule, kind] of cases) {
    it(`${key} — ${title}`, () => {
      const file = kind === "missing" ? null : png;
      expect(checkAttachment(file, rule)).toBe(rule[kind]);
      expect(checkAttachment(pdf, rule)).toBeNull();
    });
  }

  it("mensagens do legado", () => {
    expect(ANEXO_FISCAL.notPdf).toBe("Erro ao incluir O arquivo anexo deve ser do tipo PDF!");
    expect(ANEXO_CONTRATO_MODELO.notPdf).toBe("Erro ao incluir O anexo deve ser do tipo PDF!");
    expect(ANEXO_FISCAL.missing).toBe("Erro ao incluir Não existe arquivo para anexar!");
    expect(checkAttachment({ type: "application/pdf", size: 0 }, ANEXO_FISCAL)).toBe(ANEXO_FISCAL.missing);
  });
});

describe("troca de senha (validação compartilhada; ponto de uso em 005-users)", () => {
  const verify = async (plain: string, hash: string) => `hash:${plain}` === hash;
  const current = "hash:atual";

  it("RK-9187b7b464f8 RK-304882e7bdc8 — Senha atual não confere!", async () => {
    const errors = await validatePasswordChange(
      { passwordold: "errada", passwordnew: "nova", passwordconfirm: "nova" },
      current,
      verify,
    );
    expect(errors).toEqual({ passwordold: "Senha atual não confere!" });
  });

  it("RK-dcfcd941a4d6 RK-96cbe7d6e198 — A nova senha não confere!", async () => {
    const errors = await validatePasswordChange(
      { passwordold: "atual", passwordnew: "nova", passwordconfirm: "outra" },
      current,
      verify,
    );
    expect(errors).toEqual({ passwordconfirm: "A nova senha não confere!" });
  });

  it("troca válida não gera erro", async () => {
    const errors = await validatePasswordChange(
      { passwordold: "atual", passwordnew: "nova", passwordconfirm: "nova" },
      current,
      verify,
    );
    expect(errors).toEqual({});
  });
});

// 022-pessoas-fornecedores (tasks 1.3): CPF de gestor/suplente/fiscal — dígitos, 11, sem DV.
describe("optionalCpf / requiredCpf", () => {
  it("aceita máscara e grava só os dígitos", async () => {
    const { optionalCpf, requiredCpf } = await import("@/lib/rules/fields");
    expect(optionalCpf("Gestor").parse("529.982.247-25")).toBe("52998224725");
    expect(requiredCpf("obrigatório", "incompleto").parse("529.982.247-25")).toBe("52998224725");
  });

  it("10 dígitos é recusado com a mensagem do campo", async () => {
    const { optionalCpf, requiredCpf } = await import("@/lib/rules/fields");
    expect(optionalCpf("Gestor").safeParse("5299822472").error?.issues[0].message).toBe("Gestor: CPF deve ter 11 dígitos");
    expect(requiredCpf("obrigatório", "incompleto").safeParse("5299822472").error?.issues[0].message).toBe("incompleto");
  });

  it("DV inválido é aceito (D9) e vazio vira null / obrigatório", async () => {
    const { optionalCpf, requiredCpf } = await import("@/lib/rules/fields");
    expect(optionalCpf("Gestor").parse("52998224724")).toBe("52998224724");
    expect(requiredCpf("obrigatório", "incompleto").parse("52998224724")).toBe("52998224724");
    expect(optionalCpf("Gestor").parse("")).toBeNull();
    expect(optionalCpf("Gestor").parse(undefined)).toBeUndefined();
    expect(requiredCpf("obrigatório", "incompleto").safeParse("").error?.issues[0].message).toBe("obrigatório");
  });
});

// 020-contratos-complementos › tasks 1.3: limites de tamanho das telas do legado (sem RK).
describe("020 › MSG.maximo", () => {
  it('MSG.maximo("Objeto", 200) = "Objeto deve ter no máximo 200 caracteres"', () => {
    expect(MSG.maximo("Objeto", 200)).toBe("Objeto deve ter no máximo 200 caracteres");
  });
});
