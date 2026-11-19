import { describe, expect, it } from "vitest";
import { isCnpjValido, isCpfValido, onlyDigits } from "@/lib/documento";

// 022-pessoas-fornecedores › app-shell › "Dígito verificador não bloqueia referência existente"
describe("documento (CPF/CNPJ)", () => {
  it("Conferir DV: 52998224725 true, 52998224724 false, 11111111111 false, 11222333000181 true", () => {
    expect([isCpfValido("52998224725"), isCpfValido("52998224724"), isCpfValido("11111111111"), isCnpjValido("11222333000181")]).toEqual([
      true,
      false,
      false,
      true,
    ]);
    expect(isCnpjValido("11222333000180")).toBe(false);
    expect(isCnpjValido("00000000000000")).toBe(false);
    // Aceita máscara; tamanho errado é inválido.
    expect(isCpfValido("529.982.247-25")).toBe(true);
    expect(isCnpjValido("11.222.333/0001-81")).toBe(true);
    expect(isCpfValido("5299822472")).toBe(false);
  });

  it("onlyDigits tira a pontuação", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
    expect(onlyDigits(null)).toBe("");
    expect(onlyDigits(" 11.222.333/0001-81 ")).toBe("11222333000181");
  });
});
