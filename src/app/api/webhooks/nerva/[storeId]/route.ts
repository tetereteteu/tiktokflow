// ─────────────────────────────────────────────────────────────
// Webhook da Nerva — FONTE DA VERDADE do pagamento.
// URL: /api/webhooks/nerva/{storeId}
//
// Cada loja tem seu próprio secret, por isso o storeId vai na URL:
// assim sabemos qual secret usar pra validar a assinatura.
//
// Fluxo:
//  1. lê o corpo BRUTO (sem re-serializar — o HMAC depende do byte a byte)
//  2. valida a assinatura HMAC-SHA256 com o secret da loja
//  3. atualiza o pedido de forma idempotente
//  4. responde 200 rápido (senão a Nerva re-tenta 4x)
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNervaWebhook } from "@/lib/nerva";
import { sendPurchaseConversions } from "@/lib/capi";
import { OrderStatus } from "@prisma/client";

// Mapa evento Nerva -> status interno
function mapEventToStatus(event: string): OrderStatus | null {
  switch (event) {
    case "sale.paid":
      return OrderStatus.PAID;
    case "sale.failed":
      return OrderStatus.FAILED;
    case "sale.expired":
      return OrderStatus.EXPIRED;
    case "sale.refunded":
      return OrderStatus.REFUNDED;
    case "sale.pending":
      return OrderStatus.PENDING;
    default:
      // sale.status_changed, med.*, etc — ignorados no MVP
      return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;

  // 1) corpo BRUTO — precisa ser a string exata que a Nerva assinou
  const rawBody = await req.text();

  // 2) carrega o secret da loja
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, nervaWebhookSecret: true },
  });

  if (!store?.nervaWebhookSecret) {
    // sem secret configurado não dá pra validar — recusa
    return NextResponse.json(
      { error: "Loja sem webhook configurado" },
      { status: 404 },
    );
  }

  // 3) valida assinatura (HMAC + proteção replay)
  const ok = verifyNervaWebhook({
    rawBody,
    timestamp: req.headers.get("x-pixnerva-timestamp"),
    signature: req.headers.get("x-pixnerva-signature"),
    secret: store.nervaWebhookSecret,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Assinatura inválida" },
      { status: 401 },
    );
  }

  // 4) parse do payload já validado
  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const event = payload.event ?? "";
  const data = payload.data ?? {};
  const nervaSaleId = String(data.id ?? "");

  const newStatus = mapEventToStatus(event);

  // Evento que não muda status (ex: MED) — só confirma recebimento
  if (!newStatus || !nervaSaleId) {
    return NextResponse.json({ received: true });
  }

  // Localiza o pedido pelo id da Nerva, dentro da loja certa
  const order = await prisma.order.findFirst({
    where: { nervaSaleId, storeId: store.id },
    select: { id: true, status: true },
  });

  if (!order) {
    // pedido não encontrado — responde 200 pra Nerva parar de re-tentar
    return NextResponse.json({ received: true, matched: false });
  }

  // Idempotência: se já está pago, não reprocessa
  if (order.status === OrderStatus.PAID && newStatus === OrderStatus.PAID) {
    return NextResponse.json({ received: true, alreadyPaid: true });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: newStatus,
      ...(newStatus === OrderStatus.PAID ? { paidAt: new Date() } : {}),
      ...(typeof data.fee === "number"
        ? { feeCents: Math.round((data.fee as number) * 100) }
        : {}),
      ...(typeof data.netAmount === "number"
        ? { netCents: Math.round((data.netAmount as number) * 100) }
        : {}),
      ...(data.transactionId
        ? { nervaTxId: String(data.transactionId) }
        : {}),
    },
  });

  // Conversions API própria (Meta CAPI + TikTok Events API).
  // SEM await de propósito: o webhook precisa responder rápido, senão a
  // Nerva re-tenta 4x. O processo é um Node de vida longa (pm2), então a
  // promise termina depois da resposta. Erros ficam gravados no pedido.
  if (newStatus === OrderStatus.PAID) {
    void sendPurchaseConversions(order.id);
  }

  // Aqui, no futuro: liberar acesso, disparar e-mail, order bump, etc.

  return NextResponse.json({ received: true });
}
