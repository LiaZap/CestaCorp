import { describe, it, expect } from "vitest";
import { calcularValorAtualizadoSync, parseSnapshot, type ConfigCobranca } from "@/lib/services/valor-atualizado";

const PADRAO: ConfigCobranca = {
  jurosPctAoDia: 1.0,
  multaPct: 2.0,
  carenciaDias: 0,
  jurosCompostos: false,
};

describe("calcularValorAtualizado", () => {
  it("não cobra nada se ainda não venceu", () => {
    const venc = new Date("2026-12-25");
    const hoje = new Date("2026-12-20");
    const r = calcularValorAtualizadoSync(1000, venc, hoje, PADRAO);
    expect(r.emAtraso).toBe(false);
    expect(r.diasAtraso).toBe(0);
    expect(r.multa).toBe(0);
    expect(r.juros).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("não cobra nada se vence hoje (0 dias atraso)", () => {
    const venc = new Date("2026-12-20T00:00:00");
    const hoje = new Date("2026-12-20T15:30:00");
    const r = calcularValorAtualizadoSync(1000, venc, hoje, PADRAO);
    expect(r.diasAtraso).toBe(0);
    expect(r.emAtraso).toBe(false);
    expect(r.total).toBe(1000);
  });

  it("aplica multa + juros 1 dia de atraso (cenário Patrick)", () => {
    // R$ 1000 com 1 dia de atraso = 1000 + 20 (multa 2%) + 10 (1% × 1 dia) = 1030
    const venc = new Date("2026-12-19");
    const hoje = new Date("2026-12-20");
    const r = calcularValorAtualizadoSync(1000, venc, hoje, PADRAO);
    expect(r.diasAtraso).toBe(1);
    expect(r.emAtraso).toBe(true);
    expect(r.multa).toBe(20);
    expect(r.juros).toBe(10);
    expect(r.total).toBe(1030);
  });

  it("10 dias de atraso (cenário Patrick mencionou)", () => {
    // R$ 1000 + 20 (multa 2%) + 100 (1% × 10) = 1120
    const venc = new Date("2026-12-10");
    const hoje = new Date("2026-12-20");
    const r = calcularValorAtualizadoSync(1000, venc, hoje, PADRAO);
    expect(r.diasAtraso).toBe(10);
    expect(r.multa).toBe(20);
    expect(r.juros).toBe(100);
    expect(r.total).toBe(1120);
  });

  it("30 dias de atraso", () => {
    // R$ 850 + 17 (multa 2%) + 255 (1% × 30 × 850/100) = 1122
    const venc = new Date("2026-11-20");
    const hoje = new Date("2026-12-20");
    const r = calcularValorAtualizadoSync(850, venc, hoje, PADRAO);
    expect(r.diasAtraso).toBe(30);
    expect(r.multa).toBe(17);
    expect(r.juros).toBe(255);
    expect(r.total).toBe(1122);
  });

  it("respeita carência (5 dias sem juros)", () => {
    const cfg: ConfigCobranca = { ...PADRAO, carenciaDias: 5 };
    // 3 dias atraso, dentro da carência → sem multa nem juros
    const r = calcularValorAtualizadoSync(1000, new Date("2026-12-17"), new Date("2026-12-20"), cfg);
    expect(r.emAtraso).toBe(false);
    expect(r.total).toBe(1000);
  });

  it("aplica juros só após carência", () => {
    const cfg: ConfigCobranca = { ...PADRAO, carenciaDias: 5 };
    // 10 dias atraso, carência 5 → cobra 5 dias de juros
    const r = calcularValorAtualizadoSync(1000, new Date("2026-12-10"), new Date("2026-12-20"), cfg);
    expect(r.diasAtraso).toBe(10);
    expect(r.emAtraso).toBe(true);
    expect(r.multa).toBe(20);
    expect(r.juros).toBe(50); // 1% × 5 dias × 1000
    expect(r.total).toBe(1070);
  });

  it("juros compostos aumentam com o tempo", () => {
    const cfg: ConfigCobranca = { ...PADRAO, jurosCompostos: true };
    // (1000 + 20) × 1.01^10 ≈ 1126.65
    const r = calcularValorAtualizadoSync(1000, new Date("2026-12-10"), new Date("2026-12-20"), cfg);
    expect(r.diasAtraso).toBe(10);
    expect(r.multa).toBe(20);
    expect(r.total).toBeGreaterThan(1120); // mais que simples
    expect(r.total).toBeLessThan(1130);    // mas próximo
  });

  it("arredonda valores pra 2 casas", () => {
    const r = calcularValorAtualizadoSync(123.456, new Date("2026-12-19"), new Date("2026-12-20"), PADRAO);
    // toda saída tem no máximo 2 casas decimais
    function maxDuasCasas(v: number) {
      const s = String(v);
      const dot = s.indexOf(".");
      return dot === -1 || s.length - dot - 1 <= 2;
    }
    expect(maxDuasCasas(r.total)).toBe(true);
    expect(maxDuasCasas(r.multa)).toBe(true);
    expect(maxDuasCasas(r.juros)).toBe(true);
  });

  it("ignora hora do dia (compara por data)", () => {
    const venc = new Date("2026-12-19T23:59:59");
    const hoje = new Date("2026-12-20T00:00:01");
    const r = calcularValorAtualizadoSync(1000, venc, hoje, PADRAO);
    // 1 dia "calendário" mesmo que sejam só 2 segundos
    expect(r.diasAtraso).toBe(1);
  });

  it("vencimento futuro → 0 dias atraso", () => {
    const r = calcularValorAtualizadoSync(1000, new Date("2027-01-01"), new Date("2026-12-20"), PADRAO);
    expect(r.diasAtraso).toBe(0);
    expect(r.total).toBe(1000);
  });
});

describe("parseSnapshot (mudança prospectiva — Patrick 09/05)", () => {
  it("parseia snapshot válido", () => {
    const snap = parseSnapshot({
      jurosPctAoDia: 1.5,
      multaPct: 3,
      carenciaDias: 5,
      jurosCompostos: false,
      capturadoEm: "2026-01-01T00:00:00Z",
    });
    expect(snap).toEqual({
      jurosPctAoDia: 1.5,
      multaPct: 3,
      carenciaDias: 5,
      jurosCompostos: false,
    });
  });

  it("retorna null pra snapshot vazio (cobrança legada)", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot(undefined)).toBeNull();
    expect(parseSnapshot({})).toBeNull();
    expect(parseSnapshot("string")).toBeNull();
  });

  it("retorna null se faltar campo obrigatório", () => {
    expect(parseSnapshot({ jurosPctAoDia: 1, multaPct: 2 })).toBeNull();
  });

  it("converte string numérica pra number (Decimal Prisma)", () => {
    const snap = parseSnapshot({
      jurosPctAoDia: "1.5",
      multaPct: "3",
      carenciaDias: 5,
    });
    expect(snap?.jurosPctAoDia).toBe(1.5);
    expect(snap?.multaPct).toBe(3);
  });

  it("cobrança nasceu com regra X — recálculo usa X mesmo se config global mudou pra Y", () => {
    // Cenário Patrick: cobrança nasceu em jan/2026 com 1% juros + 2% multa.
    // Em mar/2026 ele mudou pra 1.5% + 3%. Cobrança jan ainda paga 1% + 2%.
    const regraOriginal: ConfigCobranca = { jurosPctAoDia: 1, multaPct: 2, carenciaDias: 3, jurosCompostos: false };
    const regraNova: ConfigCobranca = { jurosPctAoDia: 1.5, multaPct: 3, carenciaDias: 3, jurosCompostos: false };

    // 10 dias atraso (já passou carência)
    const venc = new Date("2026-01-01");
    const hoje = new Date("2026-01-14");

    const usandoOriginal = calcularValorAtualizadoSync(1000, venc, hoje, regraOriginal);
    const usandoNova = calcularValorAtualizadoSync(1000, venc, hoje, regraNova);

    // Original: 1000 + 20 (2%) + 100 (1% × 10) = 1120
    expect(usandoOriginal.total).toBe(1120);
    // Nova: 1000 + 30 (3%) + 150 (1.5% × 10) = 1180
    expect(usandoNova.total).toBe(1180);
    // Diferença é real e mensurável — proteção legal
    expect(usandoNova.total - usandoOriginal.total).toBe(60);
  });
});
