// ─────────────────────────────────────────────────────────────
// POST /api/checkout
// Cria pedido PENDENTE (produto + order bump opcional), gera cobrança
// Pix na Nerva com tracking de marketing, devolve QR + copia-e-cola.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNervaSale, toReais, NervaError } from "@/lib/nerva";
import { makeEventId } from "@/lib/tracking";

function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

interface Body {
  productId?: string;
  bumpId?: string;
  name?: string;
  email?: string;
  document?: string;
  phone?: string;
  isUpsell?: boolean;
  tracking?: Record<string, string | undefined>;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const { productId, bumpId, name, email, document, phone, tracking, isUpsell } = body;

  if (!productId || !document) {
    return NextResponse.json({ error: "Produto e CPF são obrigatórios" }, { status: 400 });
  }
  if (!isValidCpf(document)) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { store: true },
  });
  if (!product || !product.active || !product.store.active) {
    return NextResponse.json({ error: "Produto indisponível" }, { status: 404 });
  }

  const store = product.store;
  if (!store.nervaApiKey) {
    return NextResponse.json({ error: "Loja sem gateway configurado" }, { status: 400 });
  }

  let bump = null;
  if (bumpId) {
    bump = await prisma.orderBump.findFirst({
      where: { id: bumpId, storeId: store.id, active: true },
    });
  }

  const amountCents = product.priceCents + (bump?.priceCents ?? 0);

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const clientUa = req.headers.get("user-agent") || undefined;

  const t = tracking ?? {};

  const order = await prisma.order.create({
    data: {
      storeId: store.id,
      productId: product.id,
      bumpId: bump?.id ?? null,
      isUpsell: !!isUpsell,
      customerName: name || null,
      customerEmail: email || null,
      customerDocument: document.replace(/\D/g, ""),
      amountCents,
      status: "PENDING",
      utmSource: t.utmSource || null,
      utmMedium: t.utmMedium || null,
      utmCampaign: t.utmCampaign || null,
      utmContent: t.utmContent || null,
      utmTerm: t.utmTerm || null,
      fbclid: t.fbclid || null,
      ttclid: t.ttclid || null,
      gclid: t.gclid || null,
      fbp: t.fbp || null,
      fbc: t.fbc || null,
      clientIp: clientIp || null,
      clientUa: clientUa || null,
    },
  });

  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  const postbackUrl = `${baseUrl}/api/webhooks/nerva/${store.id}`;

  try {
    const sale = await createNervaSale({
      apiKey: store.nervaApiKey,
      amountReais: toReais(amountCents),
      document: document.replace(/\D/g, ""),
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
      description: bump ? `${product.title} + ${bump.title}` : product.title,
      externalId: order.id,
      idempotencyKey: order.id,
      postbackUrl,
      expirationInSeconds: 3600,
      tracking: {
        utmSource: t.utmSource,
        utmMedium: t.utmMedium,
        utmCampaign: t.utmCampaign,
        utmContent: t.utmContent,
        utmTerm: t.utmTerm,
        fbclid: t.fbclid,
        ttclid: t.ttclid,
        gclid: t.gclid,
        fbp: t.fbp,
        fbc: t.fbc,
        clientUserAgent: clientUa,
        clientIpAddress: clientIp,
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
      pixQrCodeUrl: sale.pixQrCode,
      amountCents,
      eventId: makeEventId(order.id),
    });
  } catch (err) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED" },
    });
    const msg =
      err instanceof NervaError
        ? err.message
        : "Não foi possível gerar o Pix. Tente novamente.";
    const code = err instanceof NervaError ? err.statusCode : 502;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
