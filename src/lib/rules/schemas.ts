import { z } from "zod";
import { MSG } from "./messages";
import { optionalString, requiredDate, requiredInt, requiredString } from "./fields";
import { normalizeDescricao } from "./derived";

/**
 * Regras transversais (001-project-foundation › cross-cutting-rules).
 *
 * Cada campo abaixo é o ponto único onde a regra vale. O legado repetia a mesma regra no
 * `app/` e no plugin `detran`; aqui as chaves `RK-…` duplicadas apontam para o mesmo campo.
 * As changes de entidade montam o schema da sua tabela com estes campos (e `.strict()`, de
 * `001b-security-baseline`).
 */

export const diretoriaFields = {
  // RK-db6786831c50 RK-7bc5e0466e28 — DeDiretoria is required
  deDiretoria: requiredString(MSG.obrigatorio("Diretoria")),
  // RK-4b678b1a2fb6 RK-7a6417845e4d — Codigo is required
  codigo: requiredString(MSG.obrigatorio("Código")),
};

export const pessoaFisicaFields = {
  // RK-32ab70ab3174 RK-fa60f5d06b79 RK-b053f93a0c93 RK-b33fcd808e28 — IdPessoaFisica is required
  idPessoaFisica: requiredInt(MSG.obrigatorio("Identificador da pessoa física")),
  // RK-fcc74046a0bd RK-94d8b17e5a88 RK-76de6c0f44c8 RK-06d8ff662d9a — DtNascimento is required
  dtNascimento: requiredDate(MSG.obrigatorio("Data de nascimento")),
};

export const departamentoFields = {
  // RK-4e6358dbafbf RK-52fdc2d97389 RK-ecfa90099032 — DeDepartamento is required
  deDepartamento: requiredString(MSG.obrigatorio("Departamento")),
};

export const prestadorServicoFields = {
  // RK-afd830d80ecf RK-08a8c7c1e5ea RK-528cec3828cf — DeRazaoSocial is required
  deRazaoSocial: requiredString(MSG.obrigatorio("Razão social")),
};

export const pagamentoArquivoFields = {
  // RK-77287deac605 — arquivo is required
  arquivo: requiredString(MSG.obrigatorio("Arquivo")),
};

export const tipoContratoFields = {
  // RK-82de63b47e64 — Por favor,Preencher o campo NOME !
  nome: requiredString(MSG.nomeTipoContrato),
  // RK-2509b78bd0e0 RK-4564e4e322b6 — gerenciamento is required
  gerenciamento: requiredString(MSG.obrigatorio("Gerenciamento")),
};

export const contratoStatusFields = {
  // RK-f0ce91a53de9 — Descricao is derived before saving (aspas duplas viram simples)
  descricao: optionalString().transform((v) => (v === undefined || v === null ? v : normalizeDescricao(v))),
};

export const userFields = {
  // RK-d76edbb42dbe RK-39dd9b2d1419 — username is required
  username: requiredString(MSG.obrigatorio("Usuário")),
  // RK-3e9d7e57ae65 RK-38821207df73 — password is required (só na criação; vira hash em 001b)
  password: requiredString(MSG.obrigatorio("Senha")),
};

export const pagamentoFields = {
  // RK-774f44ed6df9 — competencia is required
  competencia: requiredDate(MSG.obrigatorio("Competência")),
};

export const contratoFields = {
  // RK-879233539305 RK-ee6cd831c2d4 — objeto is required
  objeto: requiredString(MSG.obrigatorio("Objeto")),
};

export const faseFields = {
  // RK-13dd23ce5afd — nome is required
  nome: requiredString(MSG.obrigatorio("Nome")),
  // RK-877afa57a9f9 — periodo is required
  periodo: requiredString(MSG.obrigatorio("Período")),
};

export const fiscalFields = {
  // RK-0f7caf172fab — suplente is required
  suplente: requiredString(MSG.obrigatorio("Suplente")),
  // RK-6b60cd49b7ed — presidente is required
  presidente: requiredString(MSG.obrigatorio("Presidente")),
};

export const anexoFiscalFields = {
  // RK-9da08201400b RK-0e70b6c81ee9 — anexo is required
  anexo: requiredString(MSG.obrigatorio("Anexo")),
};

export const groupFields = {
  // RK-3424ea0367fa RK-f6b71997ac15 — Informe o nome do grupo! / name is required
  name: requiredString(MSG.nomeGrupo),
};

/** Monta o schema de uma tabela a partir dos campos de regra. */
export const schemaOf = <T extends z.ZodRawShape>(fields: T) => z.object(fields);
