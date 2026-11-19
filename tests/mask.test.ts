import { describe, expect, it } from "vitest";
import { MASKS, applyMask, isMaskComplete } from "@/lib/mask";
import { maskedString } from "@/lib/rules/fields";

// Spec locale-and-formats › "Um CPF é digitado" e "Um CEP é digitado"
describe("máscaras de entrada", () => {
  it("formata CPF enquanto o usuário digita", () => {
    expect(applyMask("123", MASKS.cpf)).toBe("123");
    expect(applyMask("1234", MASKS.cpf)).toBe("123.4");
    expect(applyMask("12345678901", MASKS.cpf)).toBe("123.456.789-01");
    expect(applyMask("123.456.789-01999", MASKS.cpf)).toBe("123.456.789-01");
    expect(applyMask("12a3", MASKS.cpf)).toBe("123");
  });

  it("formata CEP enquanto o usuário digita", () => {
    expect(applyMask("20000000", MASKS.cep)).toBe("20000-000");
    expect(applyMask("2000", MASKS.cep)).toBe("2000");
  });

  it("rejeita ao salvar um valor que não completa a máscara", () => {
    const cpf = maskedString(MASKS.cpf, "CPF incompleto");
    expect(cpf.safeParse("123.456.789-01").success).toBe(true);
    const incompleto = cpf.safeParse("123.456.78");
    expect(incompleto.success).toBe(false);
    expect(incompleto.error?.issues[0].message).toBe("CPF incompleto");
    expect(isMaskComplete("20000-000", MASKS.cep)).toBe(true);
    expect(isMaskComplete("20000000", MASKS.cep)).toBe(false);
  });
});
