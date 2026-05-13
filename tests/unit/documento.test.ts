import { describe, it, expect } from "vitest";
import { isCpfValido, isCnpjValido, isDocumentoValido, soDigitos } from "@/lib/security/documento";

describe("soDigitos", () => {
  it("remove tudo que não é dígito", () => {
    expect(soDigitos("123.456.789-00")).toBe("12345678900");
    expect(soDigitos("12.345.678/0001-99")).toBe("12345678000199");
    expect(soDigitos("")).toBe("");
    expect(soDigitos("abc")).toBe("");
  });
});

describe("isCpfValido", () => {
  it("aceita CPFs reais válidos", () => {
    // CPFs gerados com calculadora de dígito verificador
    expect(isCpfValido("529.982.247-25")).toBe(true);
    expect(isCpfValido("52998224725")).toBe(true);
    expect(isCpfValido("111.444.777-35")).toBe(true);
  });

  it("rejeita CPF com DV inválido", () => {
    expect(isCpfValido("529.982.247-00")).toBe(false);
    expect(isCpfValido("111.444.777-30")).toBe(false);
  });

  it("rejeita CPFs com todos dígitos iguais", () => {
    expect(isCpfValido("111.111.111-11")).toBe(false);
    expect(isCpfValido("00000000000")).toBe(false);
    expect(isCpfValido("99999999999")).toBe(false);
  });

  it("rejeita tamanho diferente de 11", () => {
    expect(isCpfValido("123")).toBe(false);
    expect(isCpfValido("123456789012")).toBe(false);
    expect(isCpfValido("")).toBe(false);
  });
});

describe("isCnpjValido", () => {
  it("aceita CNPJs reais válidos", () => {
    expect(isCnpjValido("11.222.333/0001-81")).toBe(true);
    expect(isCnpjValido("11222333000181")).toBe(true);
  });

  it("rejeita CNPJ com DV inválido", () => {
    expect(isCnpjValido("11.222.333/0001-00")).toBe(false);
  });

  it("rejeita CNPJs com todos dígitos iguais", () => {
    expect(isCnpjValido("11.111.111/1111-11")).toBe(false);
    expect(isCnpjValido("00000000000000")).toBe(false);
  });

  it("rejeita tamanho diferente de 14", () => {
    expect(isCnpjValido("11222333")).toBe(false);
    expect(isCnpjValido("112223330001811")).toBe(false);
  });
});

describe("isDocumentoValido", () => {
  it("aceita CPF válido", () => {
    expect(isDocumentoValido("529.982.247-25")).toBe(true);
  });

  it("aceita CNPJ válido", () => {
    expect(isDocumentoValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita documento inválido", () => {
    expect(isDocumentoValido("123")).toBe(false);
    expect(isDocumentoValido("xyz")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(isDocumentoValido("")).toBe(false);
  });
});
