/**
 * CPF e CNPJ (022-pessoas-fornecedores, design.md D1 e D9).
 *
 * Formato canônico: só dígitos (11 no CPF, 14 no CNPJ); a máscara é só de tela (`formatCpf`,
 * `formatCnpj` em `src/lib/format.ts`). O dígito verificador é conferido aqui, mas NÃO bloqueia a
 * escolha de uma pessoa ou fornecedor que existe na referência (D9): é checagem de qualidade
 * (aviso) na carga do legado (025), no seed de desenvolvimento e nos testes.
 */

/** Tira tudo que não é dígito (`"529.982.247-25"` → `"52998224725"`). */
export function onlyDigits(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D/g, "");
}

/** Dígito verificador módulo 11 com os pesos dados (resto < 2 → 0). */
function dv(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

const repeated = (digits: string) => /^(\d)\1+$/.test(digits);

/** CPF com 11 dígitos, não repetido (`11111111111`) e com os dois DV corretos. Aceita máscara. */
export function isCpfValido(value: unknown): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || repeated(cpf)) return false;
  const d1 = dv(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/** CNPJ com 14 dígitos, não repetido e com os dois DV corretos (pesos 5..2/9..2 e 6..2/9..2). Aceita máscara. */
export function isCnpjValido(value: unknown): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || repeated(cnpj)) return false;
  const d1 = dv(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}
