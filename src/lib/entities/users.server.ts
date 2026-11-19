import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ConflictError, FieldRuleError, crudHandlers, handleError, readBody, type Db } from "@/lib/crud/server";
import { validationError } from "@/lib/api/http";
import { MSG, userFields, validatePasswordChange } from "@/lib/rules";
import { requiredString } from "@/lib/rules/fields";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { UnauthorizedError, publicUser, requireUser, type SessionUser } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/guard";
import { PERFIS, type Perfil } from "@/lib/auth/permissions";

/** API de Usuários (005-users). Senha só entra como hash e nunca sai (publicUser). */
export const USERS_MSG = {
  confirmacao: "A senha e a confirmação não conferem!",
  duplicado: "Já existe um usuário com este nome",
  proprioUsuario: "Não é possível excluir o próprio usuário logado",
  // 023-perfis-acesso
  semPerfil: "Informe ao menos um perfil",
  perfilInvalido: "Perfil inválido",
  proprioAdministrador: "Não é possível remover o seu próprio perfil de Administrador",
  ultimoAdministrador: "O sistema precisa de ao menos um Administrador",
} as const;

/** Perfis do usuário (023): um ou mais do catálogo, sem repetição. */
export const perfisSchema = z
  .array(z.string({ error: USERS_MSG.perfilInvalido }), { error: USERS_MSG.semPerfil })
  .min(1, { error: USERS_MSG.semPerfil })
  // Erro no campo `perfis` (não em `perfis.0`): valor fora do catálogo → 400.
  .refine((lista) => lista.every((p) => (PERFIS as readonly string[]).includes(p)), { error: USERS_MSG.perfilInvalido })
  .transform((lista) => PERFIS.filter((p) => lista.includes(p)));

export const usersCreateSchema = z.object({
  username: userFields.username, // RK-d76edbb42dbe RK-39dd9b2d1419 (aplicada em userFields)
  password: userFields.password, // RK-3e9d7e57ae65 RK-38821207df73 (aplicada em userFields)
  passwordconfirm: requiredString(MSG.obrigatorio("Confirmar senha")),
  perfis: perfisSchema,
});

/** Edição altera `username` e `perfis`; a senha de outro usuário não é editada por esta tela. */
export const usersUpdateSchema = z.object({
  username: userFields.username, // RK-d76edbb42dbe RK-39dd9b2d1419 (aplicada em userFields)
  perfis: perfisSchema,
});

async function assertUniqueUsername(username: string, id?: number) {
  const other = await prisma.user.findUnique({ where: { username } });
  if (other && other.id !== id) throw new FieldRuleError({ username: USERS_MSG.duplicado });
}

/** Confere, dentro da transação, que continua existindo ao menos um Administrador (023). */
async function assertAdministrador(tx: Db) {
  if ((await tx.userPerfil.count({ where: { perfil: "ADMINISTRADOR" } })) === 0) {
    throw new ConflictError(USERS_MSG.ultimoAdministrador);
  }
}

type UserArgs = { data: Record<string, unknown>; include?: object };

/** Grava o usuário e troca os perfis na mesma transação (deleteMany + createMany), com a trava do último Administrador. */
async function saveUser(id: number | null, { data, include }: UserArgs) {
  const { perfis, ...user } = data as { perfis?: Perfil[] } & Record<string, unknown>;
  return prisma.$transaction(async (tx) => {
    const row =
      id === null
        ? await tx.user.create({ data: user as Prisma.UserUncheckedCreateInput })
        : await tx.user.update({ where: { id }, data: user as Prisma.UserUncheckedUpdateInput });
    if (perfis) {
      await tx.userPerfil.deleteMany({ where: { userId: row.id } });
      await tx.userPerfil.createMany({ data: perfis.map((perfil) => ({ userId: row.id, perfil })) });
      await assertAdministrador(tx);
    }
    return tx.user.findUniqueOrThrow({ where: { id: row.id }, include });
  });
}

/** Delegate do kit: leitura e exclusão pelo cliente recebido; criação/edição por `saveUser`. */
const userDelegate = (db: Db = prisma) => ({
  findMany: (args: object) => db.user.findMany(args),
  count: (args: object) => db.user.count(args),
  findUnique: (args: object) => db.user.findUnique(args as Prisma.UserFindUniqueArgs),
  delete: (args: object) => db.user.delete(args as Prisma.UserDeleteArgs),
  create: (args: UserArgs) => saveUser(null, args),
  update: (args: UserArgs & { where: { id: number } }) => saveUser(args.where.id, args),
});

/** O Administrador logado não tira de si o perfil Administrador (023). */
async function assertProprioAdministrador(user: SessionUser, id: number | undefined, perfis: Perfil[]) {
  if (id !== user.id || perfis.includes("ADMINISTRADOR")) return;
  const atual = await prisma.userPerfil.findUnique({ where: { userId_perfil: { userId: id, perfil: "ADMINISTRADOR" } } });
  if (atual) throw new ConflictError(USERS_MSG.proprioAdministrador);
}

/** `perfis` sai como lista de códigos (`["FISCAL", "FINANCEIRO"]`), na ordem do catálogo. */
function serializeUser(row: unknown) {
  const r = row as Record<string, unknown> & { perfis?: { perfil: string }[] };
  const perfis = PERFIS.filter((p) => (r.perfis ?? []).some((x) => x.perfil === p));
  return publicUser({ ...r, perfis });
}

export const usersApi = crudHandlers({
  resource: "users", // 023-perfis-acesso (matriz em src/lib/auth/permissions.ts)
  delegate: userDelegate,
  schema: usersCreateSchema,
  updateSchema: usersUpdateSchema,
  include: { perfis: { select: { perfil: true } } },
  searchFields: ["username"],
  orderBy: { username: "asc" },
  // Na edição, campos de senha não fazem parte de usersUpdateSchema: o .strict() devolve 400 se vierem.
  beforeSave: async (data, { mode, id, user }) => {
    const username = data.username as string;
    const perfis = data.perfis as Perfil[];
    await assertUniqueUsername(username, id);
    await assertProprioAdministrador(user, id, perfis);
    if (mode === "update") return { username, perfis };
    if (data.password !== data.passwordconfirm) throw new FieldRuleError({ passwordconfirm: USERS_MSG.confirmacao });
    // Só o hash é gravado; password/passwordconfirm nunca chegam ao banco.
    return { username, perfis, passwordHash: await hashPassword(data.password as string) };
  },
  // Exclusão: os perfis saem junto (onDelete: Cascade); a trava do último Administrador roda na transação.
  beforeDelete: async (current, { tx }) => {
    const { id } = current as { id: number };
    await tx.userPerfil.deleteMany({ where: { userId: id } });
    await assertAdministrador(tx);
  },
  serialize: serializeUser,
});

/** DELETE com a trava do próprio usuário: quem está logado não exclui a si mesmo. */
export async function removeUser(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("users", "excluir"); // 023-perfis-acesso
    if ((await ctx.params).id === String(user.id)) {
      return NextResponse.json({ error: USERS_MSG.proprioUsuario }, { status: 409 });
    }
  } catch (error) {
    return handleError(error);
  }
  return usersApi.remove(request, ctx);
}

const trocaSenhaSchema = z
  .object({
    passwordold: requiredString(MSG.obrigatorio("Senha atual")),
    passwordnew: requiredString(MSG.obrigatorio("Nova senha")),
    passwordconfirm: requiredString(MSG.obrigatorio("Confirmar nova senha")),
  })
  .strict();

/** `POST /api/conta/senha` — troca a senha do usuário da sessão (nunca de outro). */
export async function trocarSenha(request: Request) {
  let sessionUser;
  try {
    sessionUser = await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    throw error;
  }
  const parsed = trocaSenhaSchema.safeParse(await readBody(request));
  if (!parsed.success) return validationError(parsed.error);
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  // RK-9187b7b464f8 RK-304882e7bdc8 — senha atual confere com o hash (validatePasswordChange)
  // RK-dcfcd941a4d6 RK-96cbe7d6e198 — nova senha igual à confirmação (validatePasswordChange)
  const errors = await validatePasswordChange(parsed.data, user.passwordHash, verifyPassword);
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.passwordnew) } });
  return NextResponse.json({ ok: true });
}
