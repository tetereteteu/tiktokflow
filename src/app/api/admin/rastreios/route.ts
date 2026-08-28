// Rastreio do pedido: criar/atualizar (upsert) e remover.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const orderId = String(b.orderId ?? "");
  const codigo = String(b.codigo ?? "").trim().toUpperCase();
  const transportadora = String(b.transportadora ?? "").trim();

  if (!orderId || !codigo || !transportadora)
    return NextResponse.json(
      { error: "Pedido, código e transportadora são obrigatórios" },
      { status: 400 },
    );

  const pedido = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, storeId: true },
  });
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (!(await canManageStore(session, pedido.storeId)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  // upsert: recadastrar o código do mesmo pedido corrige em vez de
  // estourar por causa do @unique em orderId.
  const shipment = await prisma.shipment.upsert({
    where: { orderId },
    create: {
      orderId, codigo, transportadora,
      url: b.url ? String(b.url) : null,
    },
    update: {
      codigo, transportadora,
      url: b.url ? String(b.url) : null,
    },
  });
  return NextResponse.json({ shipment });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orderId = req.nextUrl.searchParams.get("orderId") ?? "";
  const pedido = await prisma.order.findUnique({
    where: { id: orderId },
    select: { storeId: true },
  });
  if (!pedido) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (!(await canManageStore(session, pedido.storeId)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  await prisma.shipment.deleteMany({ where: { orderId } });
  return NextResponse.json({ ok: true });
}
