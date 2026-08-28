// ─────────────────────────────────────────────────────────────
// Rota POST /api/webhooks/nerva/{storeId} — o webhook é a FONTE
// DA VERDADE do pagamento, então cada decisão dele vira teste:
// quem entra, quem é recusado, o que grava e o que dispara.
//
// Prisma e a Conversions API são simulados: o objetivo é travar a
// lógica de decisão, não o banco.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  storeFindUnique: vi.fn(),
  orderFindFirst: vi.fn(),
  orderUpdate: vi.fn(),
  sendPurchaseConversions: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findUnique: m.storeFindUnique },
    order: { findFirst: m.orderFindFirst, update: m.orderUpdate },
  },
}));

vi.mock("@/lib/capi", () => ({
  sendPurchaseConversions: m.sendPurchaseConversions,
}));

const { POST } = await import("@/app/api/webhooks/nerva/[storeId]/route");

const STORE_ID = "loja-1";
const SECRET = "whsec_loja_1";

function requisicao(corpo: string, opts: { secret?: string; timestamp?: string } = {}) {
  const timestamp = opts.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", opts.secret ?? SECRET)
    .update(`${timestamp}.${corpo}`)
    .digest("hex");

  return new NextRequest(`https://tkkplus.online/api/webhooks/nerva/${STORE_ID}`, {
    method: "POST",
    body: corpo,
    headers: {
      "content-type": "application/json",
      "x-pixnerva-timestamp": timestamp,
      "x-pixnerva-signature": signature,
    },
  });
}

const ctx = { params: Promise.resolve({ storeId: STORE_ID }) };

const chamar = (corpo: string, opts?: { secret?: string; timestamp?: string }) =>
  POST(requisicao(corpo, opts), ctx);

beforeEach(() => {
  vi.clearAllMocks();
  m.storeFindUnique.mockResolvedValue({ id: STORE_ID, nervaWebhookSecret: SECRET });
  m.orderUpdate.mockResolvedValue({});
});

describe("recusa", () => {
  it("404 quando a loja não tem webhook secret", async () => {
    m.storeFindUnique.mockResolvedValue({ id: STORE_ID, nervaWebhookSecret: null });
    const res = await chamar(JSON.stringify({ event: "sale.paid", data: { id: "s1" } }));
    expect(res.status).toBe(404);
    expect(m.orderUpdate).not.toHaveBeenCalled();
  });

  it("404 quando a loja não existe", async () => {
    m.storeFindUnique.mockResolvedValue(null);
    const res = await chamar(JSON.stringify({ event: "sale.paid", data: { id: "s1" } }));
    expect(res.status).toBe(404);
  });

  it("401 quando a assinatura veio de outro secret", async () => {
    const res = await chamar(JSON.stringify({ event: "sale.paid", data: { id: "s1" } }), {
      secret: "whsec_errado",
    });
    expect(res.status).toBe(401);
    expect(m.orderFindFirst).not.toHaveBeenCalled();
  });

  it("401 em replay antigo, mesmo com assinatura correta", async () => {
    const velho = String(Math.floor(Date.now() / 1000) - 600);
    const res = await chamar(JSON.stringify({ event: "sale.paid", data: { id: "s1" } }), {
      timestamp: velho,
    });
    expect(res.status).toBe(401);
  });

  it("400 quando o corpo assinado não é JSON válido", async () => {
    const res = await chamar("nao é json");
    expect(res.status).toBe(400);
  });
});

describe("responde 200 pra Nerva parar de re-tentar", () => {
  it("pedido não encontrado", async () => {
    m.orderFindFirst.mockResolvedValue(null);
    const res = await chamar(JSON.stringify({ event: "sale.paid", data: { id: "s_desconhecida" } }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, matched: false });
    expect(m.orderUpdate).not.toHaveBeenCalled();
  });

  it("evento que não muda status (MED) é ignorado sem tocar no pedido", async () => {
    const res = await chamar(JSON.stringify({ event: "med.opened", data: { id: "s1" } }));
    expect(res.status).toBe(200);
    expect(m.orderFindFirst).not.toHaveBeenCalled();
    expect(m.orderUpdate).not.toHaveBeenCalled();
    expect(m.sendPurchaseConversions).not.toHaveBeenCalled();
  });

  it("evento sem id de venda é ignorado", async () => {
    const res = await chamar(JSON.stringify({ event: "sale.paid", data: {} }));
    expect(res.status).toBe(200);
    expect(m.orderUpdate).not.toHaveBeenCalled();
  });
});

describe("pagamento aprovado", () => {
  const pago = JSON.stringify({
    event: "sale.paid",
    data: { id: "sale_abc", fee: 4.53, netAmount: 92.47, transactionId: "tx_999" },
  });

  beforeEach(() => {
    m.orderFindFirst.mockResolvedValue({ id: "pedido-1", status: "PENDING" });
  });

  it("marca PAID, carimba paidAt e grava o id do adquirente", async () => {
    const res = await chamar(pago);
    expect(res.status).toBe(200);

    const dados = m.orderUpdate.mock.calls[0][0];
    expect(dados.where).toEqual({ id: "pedido-1" });
    expect(dados.data.status).toBe("PAID");
    expect(dados.data.paidAt).toBeInstanceOf(Date);
    expect(dados.data.nervaTxId).toBe("tx_999");
  });

  it("converte taxa e líquido de reais para centavos inteiros", async () => {
    await chamar(pago);
    const { data } = m.orderUpdate.mock.calls[0][0];
    // 4.53 * 100 dá 453.00000000000006 em float — precisa arredondar
    expect(data.feeCents).toBe(453);
    expect(data.netCents).toBe(9247);
    expect(Number.isInteger(data.feeCents)).toBe(true);
    expect(Number.isInteger(data.netCents)).toBe(true);
  });

  it("dispara a Conversions API com o id do pedido", async () => {
    await chamar(pago);
    expect(m.sendPurchaseConversions).toHaveBeenCalledWith("pedido-1");
  });

  it("REGRESSÃO: valida o corpo BRUTO, não o re-serializado", async () => {
    // Espaçamento extra e `97.0` só sobrevivem se o handler assinar o texto
    // exato que chegou. Trocar req.text() por req.json() + JSON.stringify
    // muda a string, a assinatura deixa de casar e isto vira 401.
    const naoCanonico =
      '{"event":"sale.paid", "data":{"id":"sale_abc","amount":97.0,"fee":4.53}}';
    expect(JSON.stringify(JSON.parse(naoCanonico))).not.toBe(naoCanonico);

    const res = await chamar(naoCanonico);
    expect(res.status).toBe(200);
    expect(m.orderUpdate).toHaveBeenCalled();
  });

  it("busca o pedido dentro da loja certa (não vaza entre lojas)", async () => {
    await chamar(pago);
    expect(m.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nervaSaleId: "sale_abc", storeId: STORE_ID },
      }),
    );
  });
});

describe("idempotência", () => {
  it("pedido já PAID não é reprocessado nem redispara conversão", async () => {
    m.orderFindFirst.mockResolvedValue({ id: "pedido-1", status: "PAID" });
    const res = await chamar(
      JSON.stringify({ event: "sale.paid", data: { id: "sale_abc" } }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ received: true, alreadyPaid: true });
    expect(m.orderUpdate).not.toHaveBeenCalled();
    expect(m.sendPurchaseConversions).not.toHaveBeenCalled();
  });
});

describe("outros status", () => {
  it.each([
    ["sale.expired", "EXPIRED"],
    ["sale.failed", "FAILED"],
    ["sale.refunded", "REFUNDED"],
  ])("%s vira %s, sem paidAt e sem conversão", async (evento, status) => {
    m.orderFindFirst.mockResolvedValue({ id: "pedido-1", status: "PENDING" });
    await chamar(JSON.stringify({ event: evento, data: { id: "sale_abc" } }));

    const { data } = m.orderUpdate.mock.calls[0][0];
    expect(data.status).toBe(status);
    expect(data.paidAt).toBeUndefined();
    expect(m.sendPurchaseConversions).not.toHaveBeenCalled();
  });

  it("reembolso de um pedido pago é aplicado (não é bloqueado pela idempotência)", async () => {
    m.orderFindFirst.mockResolvedValue({ id: "pedido-1", status: "PAID" });
    await chamar(JSON.stringify({ event: "sale.refunded", data: { id: "sale_abc" } }));
    expect(m.orderUpdate.mock.calls[0][0].data.status).toBe("REFUNDED");
  });
});
