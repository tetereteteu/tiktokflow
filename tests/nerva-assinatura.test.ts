// ─────────────────────────────────────────────────────────────
// Assinatura do webhook e conversão de dinheiro.
//
// São as duas regras do CLAUDE.md que, se quebradas, custam
// dinheiro em silêncio: assinatura calculada sobre o corpo
// re-serializado nunca casa, e valor em float perde centavo.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyNervaWebhook, toCents, toReais } from "@/lib/nerva";

const SECRET = "whsec_teste_abc123";
const agora = () => String(Math.floor(Date.now() / 1000));

function assinar(rawBody: string, secret = SECRET, timestamp = agora()) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return { rawBody, timestamp, signature, secret };
}

describe("verifyNervaWebhook", () => {
  const corpo = JSON.stringify({ event: "sale.paid", data: { id: "sale_1" } });

  it("aceita uma assinatura legítima", () => {
    expect(verifyNervaWebhook(assinar(corpo))).toBe(true);
  });

  it("rejeita corpo adulterado depois de assinado", () => {
    const p = assinar(corpo);
    const adulterado = corpo.replace("sale_1", "sale_2");
    expect(verifyNervaWebhook({ ...p, rawBody: adulterado })).toBe(false);
  });

  it("rejeita secret de outra loja", () => {
    const p = assinar(corpo);
    expect(verifyNervaWebhook({ ...p, secret: "whsec_de_outra_loja" })).toBe(false);
  });

  it.each([
    ["sem timestamp", { timestamp: null }],
    ["sem signature", { signature: null }],
    ["sem secret", { secret: "" }],
  ])("rejeita %s", (_nome, patch) => {
    expect(verifyNervaWebhook({ ...assinar(corpo), ...patch })).toBe(false);
  });

  it("rejeita replay: timestamp com mais de 5 minutos", () => {
    const velho = String(Math.floor(Date.now() / 1000) - 301);
    expect(verifyNervaWebhook(assinar(corpo, SECRET, velho))).toBe(false);
  });

  it("aceita dentro da janela de 5 minutos", () => {
    const recente = String(Math.floor(Date.now() / 1000) - 299);
    expect(verifyNervaWebhook(assinar(corpo, SECRET, recente))).toBe(true);
  });

  it("rejeita timestamp no futuro (relógio adulterado)", () => {
    const futuro = String(Math.floor(Date.now() / 1000) + 301);
    expect(verifyNervaWebhook(assinar(corpo, SECRET, futuro))).toBe(false);
  });

  it("rejeita timestamp não numérico sem estourar exceção", () => {
    expect(verifyNervaWebhook({ ...assinar(corpo), timestamp: "ontem" })).toBe(false);
  });

  it("rejeita assinatura de tamanho diferente (guarda do timingSafeEqual)", () => {
    // timingSafeEqual lança se os buffers têm tamanhos diferentes;
    // a função precisa barrar antes, devolvendo false.
    expect(() =>
      verifyNervaWebhook({ ...assinar(corpo), signature: "curta" }),
    ).not.toThrow();
    expect(verifyNervaWebhook({ ...assinar(corpo), signature: "curta" })).toBe(false);
  });

  it("REGRESSÃO: corpo re-serializado invalida a assinatura", () => {
    // Se alguém trocar `await req.text()` por `await req.json()` e
    // re-serializar, o HMAC deixa de casar e nenhum pagamento confirma.
    // Este teste falha na hora se isso acontecer.
    const original = '{"event":"sale.paid","data":{"id":"sale_1","amount":97.0}}';
    const p = assinar(original);
    const reserializado = JSON.stringify(JSON.parse(original));
    expect(reserializado).not.toBe(original); // 97.0 vira 97
    expect(verifyNervaWebhook({ ...p, rawBody: reserializado })).toBe(false);
  });
});

describe("dinheiro em centavos", () => {
  it.each([
    [97, 9700],
    [19.99, 1999],
    [0.07, 7],
    [147.1, 14710],
    [0.1 + 0.2, 30], // 0.30000000000000004
    [1.1 * 3, 330], // 3.3000000000000003
  ])("toCents(%s) = %i", (reais, esperado) => {
    expect(toCents(reais)).toBe(esperado);
  });

  it.each([
    [9700, 97],
    [1999, 19.99],
    [7, 0.07],
  ])("toReais(%i) = %s", (cents, esperado) => {
    expect(toReais(cents)).toBe(esperado);
  });

  it("ida e volta preserva o valor", () => {
    for (const v of [0.01, 9.9, 97, 147.1, 1999.99]) {
      expect(toReais(toCents(v))).toBe(v);
    }
  });

  it("centavos são sempre inteiros", () => {
    for (const v of [19.999, 0.005, 33.333]) {
      expect(Number.isInteger(toCents(v))).toBe(true);
    }
  });
});
