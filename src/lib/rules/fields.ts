import { z } from "zod";
import { isMaskComplete } from "@/lib/mask";
import { parseDate } from "@/lib/format";

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

/** Campo com máscara: o valor precisa completar a máscara para ser gravado. */
export const maskedString = (mask: string, message: string) =>
  z.string({ error: message }).refine((v) => isMaskComplete(v, mask), { error: message });
