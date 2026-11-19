#!/usr/bin/env node
// Seed de DESENVOLVIMENTO das tabelas de referência (022-pessoas-fornecedores, design.md D8).
// Cria 30 pessoas físicas e 10 fornecedores FICTÍCIOS, com CPF/CNPJ de dígito verificador válido,
// por upsert pela chave (`cpf`, `cnpj`): rodar de novo não duplica linhas.
// Em produção/homologação os dados de referência entram SÓ pela carga do banco `global` (025).
//
// Uso: DATABASE_URL="file:../data/dev.db" npm run seed:referencia [-- --preencher-existentes]
//   --preencher-existentes  atribui CPF fictício válido às pessoas já existentes sem `cpf`
//                           (depois rode scripts/resolver-cpf-gestores.mjs).

if (process.env.NODE_ENV === "production") {
  console.error("seed-referencia: recusado com NODE_ENV=production — em produção os dados de referência vêm da carga do legado (025).");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");

/** DV módulo 11 (mesmo algoritmo de src/lib/documento.ts). */
function dv(digits, weights) {
  const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** CPF válido a partir de 9 dígitos. */
export function cpfDe(base9) {
  const b = String(base9).padStart(9, "0").slice(-9);
  const d1 = dv(b, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(`${b}${d1}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${b}${d1}${d2}`;
}

/** CNPJ válido a partir da raiz de 8 dígitos (filial 0001). */
export function cnpjDe(raiz8) {
  const b = `${String(raiz8).padStart(8, "0").slice(-8)}0001`;
  const d1 = dv(b, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(`${b}${d1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${b}${d1}${d2}`;
}

const NOMES = [
  "Ana Beatriz Moreira", "Bruno Cardoso Lima", "Carla Nogueira Dias", "Daniel Freitas Rocha", "Eduarda Pires Campos",
  "Felipe Araújo Costa", "Gabriela Teixeira Melo", "Henrique Barros Viana", "Isabela Duarte Ramos", "João Pedro Almeida",
  "Karina Lopes Fonseca", "Leonardo Martins Reis", "Mariana Correia Pinto", "Nicolas Batista Gomes", "Olívia Cunha Ribeiro",
  "Paulo Henrique Silva", "Quésia Monteiro Alves", "Rafael Souza Castro", "Sabrina Farias Lacerda", "Thiago Rezende Prado",
  "Úrsula Vieira Santos", "Vinícius Moura Barbosa", "Wesley Antunes Cabral", "Ximena Lacerda Pacheco", "Yasmin Coelho Brandão",
  "Zeca Tavares Medeiros", "Alice Gonçalves Silva", "Bernardo Rangel Silva", "Cecília Azevedo Silva", "Diego Fontes Silva",
];

const FORNECEDORES = [
  "Limpeza Carioca Serviços Ltda", "Guanabara Tecnologia da Informação S.A.", "Vigilância Atlântica Ltda",
  "Copa Manutenção Predial Ltda", "Niterói Transportes e Logística Ltda", "Serra Verde Alimentação Coletiva Ltda",
  "Baía Impressões Gráficas Ltda", "Maracanã Engenharia e Obras S.A.", "Tijuca Consultoria em Gestão Ltda",
  "Lagoa Telecomunicações Ltda",
];

const preencher = process.argv.includes("--preencher-existentes");
const prisma = new PrismaClient();
try {
  let pessoas = 0;
  for (const [i, nome] of NOMES.entries()) {
    const cpf = cpfDe(800000000 + (i + 1) * 1009);
    await prisma.pessoaFisica.upsert({
      where: { cpf },
      update: { deNome: nome },
      create: { cpf, deNome: nome, idPessoaFisica: 900001 + i, dtNascimento: new Date(Date.UTC(1970 + i, i % 12, 1 + i)) },
    });
    pessoas++;
  }
  let fornecedores = 0;
  for (const [i, razao] of FORNECEDORES.entries()) {
    const cnpj = cnpjDe(70000000 + (i + 1) * 137);
    await prisma.prestadorServico.upsert({ where: { cnpj }, update: { deRazaoSocial: razao }, create: { cnpj, deRazaoSocial: razao } });
    fornecedores++;
  }
  let preenchidas = 0;
  if (preencher) {
    const semCpf = await prisma.pessoaFisica.findMany({ where: { cpf: null }, orderBy: { id: "asc" } });
    for (const p of semCpf) {
      let cpf;
      let tentativa = 0;
      do cpf = cpfDe(900000000 + p.id * 101 + tentativa++);
      while (await prisma.pessoaFisica.findUnique({ where: { cpf } }));
      await prisma.pessoaFisica.update({ where: { id: p.id }, data: { cpf } });
      preenchidas++;
    }
  }
  console.log(`seed-referencia: ${pessoas} pessoas físicas e ${fornecedores} fornecedores fictícios (upsert)` + (preencher ? `; ${preenchidas} pessoas existentes receberam CPF fictício` : ""));
} finally {
  await prisma.$disconnect();
}
