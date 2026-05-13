import { describe, it, expect } from "vitest";
import { ajustarParaHorarioComercial } from "@/lib/services/regua-cobranca";
import { renderTemplate } from "@/lib/services/templating";

describe("ajustarParaHorarioComercial", () => {
  it("mantém horário comercial em dia útil", () => {
    // quarta-feira 11h
    const d = new Date(2026, 3, 22, 11, 30);
    const ajustado = ajustarParaHorarioComercial(d);
    expect(ajustado.getHours()).toBe(11);
    expect(ajustado.getDate()).toBe(22);
  });

  it("puxa envio matutino para 09h quando antes do comercial", () => {
    // quarta-feira 06h
    const d = new Date(2026, 3, 22, 6, 0);
    const ajustado = ajustarParaHorarioComercial(d);
    expect(ajustado.getHours()).toBe(9);
    expect(ajustado.getDate()).toBe(22); // mesmo dia
  });

  it("empurra envio noturno para próximo dia útil 09h", () => {
    // sexta-feira 22h
    const sextaNoite = new Date(2026, 3, 24, 22, 0);
    const ajustado = ajustarParaHorarioComercial(sextaNoite);
    expect(ajustado.getHours()).toBe(9);
    // Próximo dia útil depois de sexta à noite = segunda
    expect([27, 28]).toContain(ajustado.getDate());
  });

  it("move sábado para próxima segunda 09h", () => {
    // sábado 14h
    const sab = new Date(2026, 3, 25, 14, 0);
    const ajustado = ajustarParaHorarioComercial(sab);
    expect(ajustado.getDay()).toBe(1); // segunda-feira
    expect(ajustado.getHours()).toBe(9);
  });

  it("move domingo para próxima segunda 09h", () => {
    const dom = new Date(2026, 3, 26, 10, 0);
    const ajustado = ajustarParaHorarioComercial(dom);
    expect(ajustado.getDay()).toBe(1);
    expect(ajustado.getHours()).toBe(9);
  });
});

describe("renderTemplate", () => {
  const ctx = {
    cliente: {
      razaoSocial: "TechNova LTDA",
      nomeFantasia: "TechNova",
      cpfCnpj: "12.345.678/0001-00",
    },
    cobranca: {
      descricao: "Honorário 04/2026",
      valor: 1850.50,
      vencimento: new Date("2026-04-25T00:00:00-03:00"),
      linhaDigitavel: "23793.38128 60001.234567 89012.345678 1 12340000185050",
      urlBoleto: "https://boleto.test/abc",
      pixCopiaCola: "00020126580014BR.GOV.BCB.PIX",
    },
    hoje: new Date("2026-04-20T09:00:00-03:00"),
  };

  it("substitui placeholder simples", () => {
    const r = renderTemplate("Olá {cliente.razaoSocial}!", ctx);
    expect(r).toBe("Olá TechNova LTDA!");
  });

  it("aplica filtro |money em valor", () => {
    const r = renderTemplate("Valor: {cobranca.valor|money}", ctx);
    // Aceita "R$ 1.850,50" ou variações de formatação
    expect(r).toMatch(/R\$\s?1\.?850[,.]50/);
  });

  it("aplica filtro |date em Date", () => {
    const r = renderTemplate("Vence {cobranca.vencimento|date}", ctx);
    expect(r).toMatch(/25\/04\/2026/);
  });

  it("múltiplos placeholders na mesma mensagem", () => {
    const r = renderTemplate(
      "Oi {cliente.razaoSocial}, seu boleto de {cobranca.valor|money} vence em {cobranca.vencimento|date}.",
      ctx
    );
    expect(r).toContain("TechNova LTDA");
    expect(r).toMatch(/1\.?850[,.]50/);
    expect(r).toContain("25/04/2026");
  });

  it("placeholder inexistente vira string vazia (não quebra)", () => {
    const r = renderTemplate("Valor {cobranca.naoExiste}", ctx);
    expect(r).toBe("Valor ");
  });

  it("resolve caminho profundo (cliente.cpfCnpj)", () => {
    const r = renderTemplate("{cliente.cpfCnpj}", ctx);
    expect(r).toBe("12.345.678/0001-00");
  });

  it("mantém texto fora dos placeholders", () => {
    const r = renderTemplate("Bom dia!", ctx);
    expect(r).toBe("Bom dia!");
  });

  it("placeholder no início e no fim", () => {
    const r = renderTemplate("{cliente.nomeFantasia} precisa pagar {cobranca.valor|money}", ctx);
    expect(r.startsWith("TechNova ")).toBe(true);
    expect(r).toMatch(/1\.?850[,.]50/);
  });
});
