/**
 * Máscaras de entrada (001-project-foundation › locale-and-formats).
 * `#` = dígito, `A` = letra; qualquer outro caractere é literal.
 */
export const MASKS = {
  cpf: "###.###.###-##",
  cep: "#####-###",
} as const;

export type MaskName = keyof typeof MASKS;

const accepts = (slot: string, ch: string) => (slot === "#" ? /\d/.test(ch) : slot === "A" ? /[a-zA-Z]/.test(ch) : false);
const isSlot = (ch: string) => ch === "#" || ch === "A";

/** Aplica a máscara enquanto o usuário digita: ignora caracteres que não cabem e insere os literais. */
export function applyMask(value: string, mask: string): string {
  const raw = value.split("").filter((ch) => /[a-zA-Z0-9]/.test(ch));
  let out = "";
  let i = 0;
  for (const slot of mask) {
    if (i >= raw.length) break;
    if (!isSlot(slot)) {
      out += slot;
      continue;
    }
    while (i < raw.length && !accepts(slot, raw[i])) i++;
    if (i >= raw.length) break;
    out += raw[i++];
  }
  return out;
}

/** O valor completa a máscara (mesmo tamanho e cada posição no tipo certo)? */
export function isMaskComplete(value: string, mask: string): boolean {
  if (value.length !== mask.length) return false;
  return mask.split("").every((slot, idx) => (isSlot(slot) ? accepts(slot, value[idx]) : slot === value[idx]));
}
