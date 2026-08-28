// ─────────────────────────────────────────────────────────────
// Classificação de erro e espera entre tentativas.
//
// É o que decide se a insistência ajuda ou vira desperdício: errar
// aqui faz o lote repetir rápido num rate limit (gerando mais
// negação) ou desistir de uma falha de rede que passaria.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { classificarErro, esperaMs, type TikTokResult } from "@/lib/tiktok-ads";

const erro = (code: number, message: string): TikTokResult => ({
  ok: false, code, message, data: null,
});

describe("classificarErro", () => {
  it("timeout e queda de conexão são REDE", () => {
    expect(classificarErro(erro(-1, "timeout 20000ms"))).toBe("REDE");
    expect(classificarErro(erro(-1, "erro de rede"))).toBe("REDE");
  });

  it.each([
    "Rate limit exceeded",
    "Too many requests",
    "QPS limit reached",
    "Request frequency is too high",
  ])("reconhece rate limit: %s", (msg) => {
    expect(classificarErro(erro(40100, msg))).toBe("LIMITE");
  });

  it("código 40100 é LIMITE mesmo com mensagem genérica", () => {
    expect(classificarErro(erro(40100, "erro"))).toBe("LIMITE");
  });

  it.each([
    [50000, "Internal server error"],
    [50002, "Please try again later"],
  ])("código %i é SERVIDOR", (code, msg) => {
    expect(classificarErro(erro(code, msg))).toBe("SERVIDOR");
  });

  it.each([
    "You have reached the limit of ad accounts",
    "The maximum number of ad accounts has been reached",
    "Ad account quota exceeded",
  ])("reconhece estouro de cota: %s", (msg) => {
    expect(classificarErro(erro(40002, msg))).toBe("COTA");
  });

  it("COTA vence outras regras — é a única parada definitiva do BC", () => {
    // mesmo com código de rate limit, se a mensagem diz cota, é cota
    expect(classificarErro(erro(40100, "account limit reached"))).toBe("COTA");
  });

  it("campo faltando ou permissão é NEGOCIO", () => {
    expect(classificarErro(erro(40002, "param license_no is required"))).toBe("NEGOCIO");
    expect(classificarErro(erro(40001, "Permission denied"))).toBe("NEGOCIO");
  });
});

describe("esperaMs", () => {
  it("não espera nada quando a cota estourou", () => {
    expect(esperaMs("COTA", 1)).toBe(0);
  });

  it("cresce a cada tentativa", () => {
    const t1 = esperaMs("REDE", 1);
    const t5 = esperaMs("REDE", 5);
    expect(t5).toBeGreaterThan(t1);
  });

  it("rate limit espera muito mais que falha de rede", () => {
    // rajada no rate limit gera mais negação — tem que recuar mais
    expect(esperaMs("LIMITE", 1)).toBeGreaterThan(esperaMs("REDE", 1) * 5);
  });

  it("respeita o teto por classe, mesmo em tentativa altíssima", () => {
    // sem teto, 2^50 vira espera de séculos
    expect(esperaMs("REDE", 50)).toBeLessThanOrEqual(30_000 * 1.2);
    expect(esperaMs("LIMITE", 50)).toBeLessThanOrEqual(300_000 * 1.2);
    expect(esperaMs("SERVIDOR", 50)).toBeLessThanOrEqual(120_000 * 1.2);
    expect(esperaMs("NEGOCIO", 50)).toBeLessThanOrEqual(180_000 * 1.2);
  });

  it("aplica jitter: duas chamadas iguais não dão sempre o mesmo valor", () => {
    const amostras = new Set(Array.from({ length: 40 }, () => esperaMs("SERVIDOR", 3)));
    expect(amostras.size).toBeGreaterThan(1);
  });

  it("o jitter fica dentro de ±20%", () => {
    for (let i = 0; i < 200; i++) {
      const v = esperaMs("SERVIDOR", 1);
      expect(v).toBeGreaterThanOrEqual(5_000 * 0.8);
      expect(v).toBeLessThanOrEqual(5_000 * 1.2);
    }
  });

  it("nunca devolve espera negativa", () => {
    for (const c of ["REDE", "LIMITE", "SERVIDOR", "NEGOCIO", "COTA"] as const) {
      expect(esperaMs(c, 0)).toBeGreaterThanOrEqual(0);
    }
  });
});
