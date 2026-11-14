import { describe, expect, it } from "vitest";
import { formatCnpj, formatCpf, formatCurrency, formatDate, parseCurrency, parseDate } from "@/lib/format";

// Spec locale-and-formats › "Uma data e um valor são exibidos"
describe("locale pt-BR", () => {
  it("exibe datas como dd/MM/yyyy", () => {
    expect(formatDate(new Date(Date.UTC(2026, 10, 12)))).toBe("12/11/2026");
    expect(formatDate("2026-01-05T00:00:00.000Z")).toBe("05/01/2026");
    expect(formatDate(null)).toBe("");
  });

  it("lê datas dd/MM/yyyy e recusa datas inexistentes", () => {
    expect(parseDate("29/02/2024")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("2026-02-01")).toBeNull();
  });

  it("exibe valores com R$ e separadores do pt-BR, sem ponto flutuante", () => {
    expect(formatCurrency("1234.56")).toBe("R$ 1.234,56");
    expect(formatCurrency(1234567.5)).toBe("R$ 1.234.567,50");
    expect(formatCurrency("0.1")).toBe("R$ 0,10");
    expect(formatCurrency("-42")).toBe("-R$ 42,00");
    expect(formatCurrency({ toString: () => "99999999999999.99" })).toBe("R$ 99.999.999.999.999,99");
  });

  it("lê valores digitados no formato brasileiro", () => {
    expect(parseCurrency("1.234,56")).toBe("1234.56");
    expect(parseCurrency("R$ 10")).toBe("10.00");
    expect(parseCurrency("12,5")).toBe("12.50");
    expect(parseCurrency("1,234.56")).toBeNull();
  });

  // 022-pessoas-fornecedores › app-shell › "Exibir documentos"
  it("Exibir documentos: cpf 52998224725 → 529.982.247-25 e cnpj 11222333000181 → 11.222.333/0001-81", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    // Com ou sem máscara; vazio vira "".
    expect(formatCpf("529.982.247-25")).toBe("529.982.247-25");
    expect(formatCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(formatCpf(null)).toBe("");
    expect(formatCnpj("")).toBe("");
  });
});
