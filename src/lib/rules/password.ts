import { MSG } from "./messages";
import type { FieldErrors } from "@/lib/api/http";

export type PasswordChange = { passwordold: string; passwordnew: string; passwordconfirm: string };

/**
 * Validação compartilhada da troca de senha. O ponto de uso é a tela `/conta/senha` de
 * `005-users`; a verificação do hash vem de `001b-security-baseline` (`verify`).
 */
export async function validatePasswordChange(
  input: PasswordChange,
  currentHash: string,
  verify: (plain: string, hash: string) => Promise<boolean>,
): Promise<FieldErrors> {
  const errors: FieldErrors = {};
  // RK-9187b7b464f8 RK-304882e7bdc8 — Senha atual não confere!
  if (!(await verify(input.passwordold ?? "", currentHash))) errors.passwordold = MSG.senhaAtual;
  // RK-dcfcd941a4d6 RK-96cbe7d6e198 — A nova senha não confere!
  if (!input.passwordnew || input.passwordnew !== input.passwordconfirm) errors.passwordconfirm = MSG.novaSenha;
  return errors;
}
