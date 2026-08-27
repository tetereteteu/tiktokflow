// ─────────────────────────────────────────────────────────────
// POST /api/upsell/accept
// Cliente aceitou o upsell na tela pós-compra. Reusa os dados
// (CPF, nome, tracking) do pedido original, cria um NOVO pedido
// com o preço do upsell e gera um novo Pix. Sem re-digitar nada.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNervaSale, toReais, NervaError } from "@/lib/nerva";
import { makeEventId } from "@/lib/tracking";

export async function POST(req: NextRequest) {
  const { originalOrderId, upsellId } = await req.json().catch(() => ({}));
  if (!originalOrderId || !upsellId)
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

  // pedido original (fonte dos dados do cliente + tracking)
  const original = await prisma.order.findUnique({
    where: { id: originalOrderId },
    include: { store: true },
  });
  if (!original)
    return NextResponse.json({ error: "Pedido original não encontrado" }, { status: 404 });

  // upsell precisa ser da mesma loja e estar ativo
  const upsell = await prisma.upsell.findFirst({
    where: { id: upsellId, storeId: original.storeId, active: true },
    include: { product: true },
  });
  if (!upsell)
    return NextResponse.json({ error: "Oferta indisponível" }, { status: 404 });

  const store = original.store;
  if (!store.nervaApiKey)
    return NextResponse.json({ error: "Loja sem gateway" }, { status: 400 });

  // novo pedido (isUpsell), reusando cliente + tracking do original
  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      productId: upsell.productId,
      isUpsell: true,
      customerName: original.customerName,
      customerEmail: original.customerEmail,
      customerPhone: original.customerPhone,
      customerDocument: original.customerDocument,
      amountCents: upsell.priceCents,
      status: "PENDING",
      utmSource: original.utmSource,
      utmMedium: original.utmMedium,
      utmCampaign: original.utmCampaign,
      utmContent: original.utmContent,
      utmTerm: original.utmTerm,
      fbclid: original.fbclid,
      ttclid: original.ttclid,
      gclid: original.gclid,
      fbp: original.fbp,
      fbc: original.fbc,
      clientIp: original.clientIp,
      clientUa: original.clientUa,
    },
  });

  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const postbackUrl = `${base}/api/webhooks/nerva/${store.id}`;

  try {
    const sale = await createNervaSale({
      apiKey: store.nervaApiKey,
      amountReais: toReais(upsell.priceCents),
      document: original.customerDocument,
      name: original.customerName || undefined,
      email: original.customerEmail || undefined,
      description: `Upsell: ${upsell.title}`,
      externalId: order.id,
      idempotencyKey: order.id,
      postbackUrl,
      expirationInSeconds: 3600,
      tracking: {
        utmSource: original.utmSource || undefined,
        utmCampaign: original.utmCampaign || undefined,
        fbclid: original.fbclid || undefined,
        ttclid: original.ttclid || undefined,
        fbp: original.fbp || undefined,
        fbc: original.fbc || undefined,
        clientUserAgent: original.clientUa || undefined,
        clientIpAddress: original.clientIp || undefined,
        eventId: makeEventId(order.id),
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        nervaSaleId: sale.id,
        nervaTxId: sale.transactionId,
        pixCode: sale.pixCode,
        pixQrCodeUrl: sale.pixQrCode,
        feeCents: Math.round(sale.fee * 100),
        netCents: Math.round(sale.netAmount * 100),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      pixCode: sale.pixCode,
      amountCents: upsell.priceCents,
      eventId: makeEventId(order.id),
    });
  } catch (err) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    const msg = err instanceof NervaError ? err.message : "Falha ao gerar o Pix.";
    const code = err instanceof NervaError ? err.statusCode : 502;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
