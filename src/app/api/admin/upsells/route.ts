import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.storeId || !b.productId || !b.title || b.priceCents == null)
    return NextResponse.json(
      { error: "Loja, produto, título e preço são obrigatórios" },
      { status: 400 },
    );
  if (!(await canManageStore(session, b.storeId)))
    return NextResponse.json({ error: "Sem acesso à loja" }, { status: 403 });

  // confere que o produto pertence à loja
  const product = await prisma.product.findFirst({
    where: { id: b.productId, storeId: b.storeId },
    select: { id: true },
  });
  if (!product)
    return NextResponse.json({ error: "Produto inválido pra esta loja" }, { status: 400 });

  const upsell = await prisma.upsell.create({
    data: {
      storeId: b.storeId,
      productId: b.productId,
      title: b.title,
      description: b.description || null,
      priceCents: Math.round(Number(b.priceCents)),
      compareAtCents: b.compareAtCents ? Math.round(Number(b.compareAtCents)) : null,
      imageUrl: b.imageUrl || null,
      active: b.active ?? true,
    },
  });
  return NextResponse.json({ upsell });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const upsell = await prisma.upsell.findUnique({
    where: { id },
    include: { store: { select: { ownerId: true } } },
  });
  if (!upsell) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (session.role !== "ADMIN" && upsell.store.ownerId !== session.userId)
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  await prisma.upsell.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
