#!/usr/bin/env node
// Resolvedor dos gestores pendentes da migração 022 (022-pessoas-fornecedores, design.md D7 passo 4).
//
// A migração 022 moveu para `migracao_pendencias` (origem '022') todo contratos.pessoaFisicaId /
// suplenteId que guardava o idPessoaFisica em vez do CPF. Depois que `pessoas_fisicas.cpf` for
// preenchido (carga 025 ou seed de desenvolvimento), este script troca cada pendência aberta pelo
// CPF da pessoa cujo idPessoaFisica é o valor antigo — só se o campo do contrato ainda estiver nulo —
// e marca a pendência com `resolvidoEm`. Também lista, sem alterar, os fiscais cujo CPF não existe
// em `pessoas_fisicas`. Idempotente.
//
// Uso: DATABASE_URL="file:../data/dev.db" node scripts/resolver-cpf-gestores.mjs [--dry-run]
//   --dry-run  só lista as trocas, sem gravar nada.

import { PrismaClient } from "@prisma/client";

const dryRun = process.argv.includes("--dry-run");
const CAMPOS = new Set(["pessoaFisicaId", "suplenteId"]);
const fmtCpf = (cpf) => (/^\d{11}$/.test(cpf) ? cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : cpf);

const prisma = new PrismaClient();
try {
  const pendencias = await prisma.migracaoPendencia.findMany({
    where: { origem: "022", resolvidoEm: null, tabela: "contratos" },
    orderBy: { id: "asc" },
  });
  let resolvidas = 0;
  let abertas = 0;
  for (const p of pendencias) {
    const idPessoa = /^\d+$/.test(p.valorAntigo ?? "") ? Number(p.valorAntigo) : null;
    const pessoa =
      idPessoa === null || !CAMPOS.has(p.campo)
        ? null
        : await prisma.pessoaFisica.findFirst({ where: { idPessoaFisica: idPessoa, cpf: { not: null } }, orderBy: { id: "desc" } });
    const contrato = await prisma.contrato.findUnique({ where: { id: p.registroId }, select: { id: true, pessoaFisicaId: true, suplenteId: true } });
    if (!pessoa?.cpf || !contrato || contrato[p.campo] !== null) {
      abertas++;
      const motivo = !contrato ? "contrato não existe" : contrato[p.campo] !== null ? "campo já preenchido" : "pessoa sem CPF";
      console.log(`aberta    contrato ${p.registroId} ${p.campo}: ${p.valorAntigo} (${motivo})`);
      continue;
    }
    console.log(`${dryRun ? "trocaria" : "resolvida"} contrato ${p.registroId} ${p.campo}: ${p.valorAntigo} -> ${pessoa.cpf} (${pessoa.deNome ?? "sem nome"})`);
    if (!dryRun) {
      await prisma.$transaction([
        prisma.contrato.update({ where: { id: p.registroId }, data: { [p.campo]: pessoa.cpf } }),
        prisma.migracaoPendencia.update({ where: { id: p.id }, data: { resolvidoEm: new Date() } }),
      ]);
    }
    resolvidas++;
  }

  // Fiscais cujo CPF não está em pessoas_fisicas: só listados (o registro não muda).
  const fiscais = await prisma.fiscal.findMany({ select: { id: true, contratoId: true, pessoaFisicaCpf: true }, orderBy: { id: "asc" } });
  const cpfs = [...new Set(fiscais.map((f) => f.pessoaFisicaCpf))];
  const existentes = new Set(
    (await prisma.pessoaFisica.findMany({ where: { cpf: { in: cpfs } }, select: { cpf: true } })).map((p) => p.cpf),
  );
  const orfaos = fiscais.filter((f) => !existentes.has(f.pessoaFisicaCpf));
  for (const f of orfaos) console.log(`CPF sem pessoa física: fiscal ${f.id} (contrato ${f.contratoId}) ${fmtCpf(f.pessoaFisicaCpf)}`);

  console.log(
    `${dryRun ? "[dry-run] " : ""}pendências ${dryRun ? "resolvíveis" : "resolvidas"}: ${resolvidas}; pendências abertas: ${abertas}; fiscais com CPF sem pessoa física: ${orfaos.length}`,
  );
} finally {
  await prisma.$disconnect();
}
