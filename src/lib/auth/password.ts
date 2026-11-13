import bcrypt from "bcryptjs";

/** Hash de senha bcrypt com custo 12 (001b-security-baseline › "Senha guardada como hash"). */
export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
