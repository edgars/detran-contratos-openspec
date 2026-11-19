import { z } from "zod";
import { isMaskComplete } from "@/lib/mask";
import { parseDate } from "@/lib/format";
import { onlyDigits } from "@/lib/documento";

const blankToUndefined = (v: unknown) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

/** Texto obrigatório: ausente, nulo ou só espaços gera `message`. */
export const requiredString = (message: string) =>
  z.preprocess(blankToUndefined, z.string({ error: message }).trim().min(1, { error: message }));

const isBlank = (v: unknown) => v === null || (typeof v === "string" && v.trim() === "");

/**
 * Texto opcional apagável (024-kit-robustez): vazio, só espaços ou `null` viram `null` (a coluna é
 * limpa na gravação); ausente continua `undefined` (o valor gravado não muda).
 */
export const optionalString = () =>
  z.preprocess((v) => (v === undefined ? undefined : isBlank(v) ? null : v), z.string().trim().nullish());

/** Inteiro obrigatório (ids de lookup chegam como string do formulário). */
export const requiredInt = (message: string) =>
  z.preprocess(blankToUndefined, z.coerce.number({ error: message }).int({ error: message }));

/** Data obrigatória: aceita `dd/MM/yyyy`, ISO ou `Date`. */
export const requiredDate = (message: string) =>
  z.preprocess(
    (v) => {
      const blank = blankToUndefined(v);
      if (typeof blank === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(blank.trim())) return parseDate(blank) ?? "invalid";
      return blank;
    },
    z.coerce.date({ error: message }),
  );

/**
 * CPF opcional (022-pessoas-fornecedores, D5): vazio vira `null`; aceita com ou sem máscara e grava
 * só os dígitos; diferente de 11 dígitos → "<label>: CPF deve ter 11 dígitos". Não confere DV (D9).
 */
export const optionalCpf = (label: string) =>
  z.preprocess(
    (v) => (v === undefined ? undefined : isBlank(v) ? null : typeof v === "string" || typeof v === "number" ? onlyDigits(v) : v),
    z
      .string({ error: `${label}: CPF deve ter 11 dígitos` })
      .regex(/^\d{11}$/, { error: `${label}: CPF deve ter 11 dígitos` })
      .nullish(),
  );

/**
 * CPF obrigatório (022-pessoas-fornecedores, D5): vazio → `message`; com ou sem máscara, gravado só
 * com dígitos; diferente de 11 dígitos → `incompleteMessage`. Não confere DV (D9).
 */
export const requiredCpf = (message: string, incompleteMessage: string) =>
  requiredString(message).pipe(
    z
      .string()
      .transform((v) => onlyDigits(v))
      .pipe(z.string().regex(/^\d{11}$/, { error: incompleteMessage })),
  );

/** Campo com máscara: o valor precisa completar a máscara para ser gravado. */
export const maskedString = (mask: string, message: string) =>
  z.string({ error: message }).refine((v) => isMaskComplete(v, mask), { error: message });
