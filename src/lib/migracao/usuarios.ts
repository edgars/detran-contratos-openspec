import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { GRUPO_PERFIL, perfisDoLegado } from "@/lib/auth/perfis-legado";
import type { Perfil } from "@/lib/auth/permissions";

/**
 * Usuários do legado (025-migracao-legado, design.md D7). Nenhuma senha migra: a coluna `password`
 * do legado é descartada no parser (`COLUNAS_DESCARTADAS` em `mapa.ts`) e cada usuário novo recebe o
 * hash de 32 bytes aleatórios que ninguém conhece, `inativo = 1` e `senhaRedefinir = true`; só entra
 * depois que o Administrador define a senha em `/users/[id]/senha`.
 */

/** Usuário técnico das colunas de autoria obrigatórias cujo autor sumiu do legado (D7). */
export const USUARIO_TECNICO = "legado.desconhecido";

/** Hash de uma senha aleatória descartada (a coluna `passwordHash` é obrigatória). */
export async function hashDescartado(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}

/**
 * Perfis do usuário migrado (023-perfis-acesso › Seed e migração): `perfisDoLegado()` sobre os
 * grupos, mais Administrador com `superuser = 1`, e Consulta a quem ficar sem perfil. Grupos sem
 * mapeamento voltam em `semMapeamento`.
 */
export function perfisDoUsuario(grupos: readonly string[], superuser: number | null): { perfis: Perfil[]; semMapeamento: string[] } {
  const perfis = new Set<Perfil>(perfisDoLegado(grupos));
  if (superuser === 1) perfis.add("ADMINISTRADOR");
  if (perfis.size === 0) perfis.add("CONSULTA");
  const semMapeamento = grupos.filter((g) => !Object.hasOwn(GRUPO_PERFIL, g));
  return { perfis: [...perfis], semMapeamento };
}

/** Garante o usuário técnico `legado.desconhecido` (inativo, sem senha conhecida, perfil Consulta). */
export async function garantirUsuarioTecnico(tx: Prisma.TransactionClient): Promise<{ id: number; criado: boolean }> {
  const atual = await tx.user.findUnique({ where: { username: USUARIO_TECNICO }, select: { id: true } });
  if (atual) return { id: atual.id, criado: false };
  const novo = await tx.user.create({
    data: {
      username: USUARIO_TECNICO,
      passwordHash: await hashDescartado(),
      inativo: 1,
      senhaRedefinir: true,
      perfis: { create: { perfil: "CONSULTA" } },
    },
    select: { id: true },
  });
  return { id: novo.id, criado: true };
}
