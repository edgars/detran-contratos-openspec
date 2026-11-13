import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { FieldRuleError, crudHandlers, readBody } from "@/lib/crud/server";
import { validationError } from "@/lib/api/http";
import { MSG, userFields, validatePasswordChange } from "@/lib/rules";
import { requiredString } from "@/lib/rules/fields";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { UnauthorizedError, publicUser, requireUser } from "@/lib/auth/session";

/** API de Usuários (005-users). Senha só entra como hash e nunca sai (publicUser). */
export const USERS_MSG = {
  confirmacao: "A senha e a confirmação não conferem!",
  duplicado: "Já existe um usuário com este nome",
  proprioUsuario: "Não é possível excluir o próprio usuário logado",
} as const;

export const usersCreateSchema = z.object({
  username: userFields.username, // RK-d76edbb42dbe RK-39dd9b2d1419 (aplicada em userFields)
  password: userFields.password, // RK-3e9d7e57ae65 RK-38821207df73 (aplicada em userFields)
  passwordconfirm: requiredString(MSG.obrigatorio("Confirmar senha")),
});

/** Edição altera só `username`; a senha de outro usuário não é editada por esta tela. */
export const usersUpdateSchema = z.object({
  username: userFields.username, // RK-d76edbb42dbe RK-39dd9b2d1419 (aplicada em userFields)
});

async function assertUniqueUsername(username: string, id?: number) {
  const other = await prisma.user.findUnique({ where: { username } });
  if (other && other.id !== id) throw new FieldRuleError({ username: USERS_MSG.duplicado });
}

export const usersApi = crudHandlers({
  delegate: () => prisma.user,
  schema: usersCreateSchema,
  updateSchema: usersUpdateSchema,
  searchFields: ["username"],
  orderBy: { username: "asc" },
  // Na edição, campos de senha não fazem parte de usersUpdateSchema: o .strict() devolve 400 se vierem.
  beforeSave: async (data, { mode, id }) => {
    const username = data.username as string;
    await assertUniqueUsername(username, id);
    if (mode === "update") return { username };
    if (data.password !== data.passwordconfirm) throw new FieldRuleError({ passwordconfirm: USERS_MSG.confirmacao });
    // Só o hash é gravado; password/passwordconfirm nunca chegam ao banco.
    return { username, passwordHash: await hashPassword(data.password as string) };
  },
  serialize: (row) => publicUser(row as Record<string, unknown>),
});

/** DELETE com a trava do próprio usuário: quem está logado não exclui a si mesmo. */
export async function removeUser(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if ((await ctx.params).id === String(user.id)) {
      return NextResponse.json({ error: USERS_MSG.proprioUsuario }, { status: 409 });
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    throw error;
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
