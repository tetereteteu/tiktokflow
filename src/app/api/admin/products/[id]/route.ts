import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

async function loadOwned(sessionUserId: string, role: string, id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { store: { select: { id: true, ownerId: true } } },
  });
  if (!product) return null;
  if (role !== "ADMIN" && product.store.ownerId !== sessionUserId) return null;
  return product;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const product = await loadOwned(session.userId, session.role, id);
  if (!product) return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.description !== undefined ? { description: b.description || null } : {}),
      ...(b.priceCents !== undefined ? { priceCents: Math.round(Number(b.priceCents)) } : {}),
      ...(b.compareAtCents !== undefined
        ? { compareAtCents: b.compareAtCents ? Math.round(Number(b.compareAtCents)) : null }
        : {}),
      ...(b.imageUrl !== undefined ? { imageUrl: b.imageUrl || null } : {}),
      ...(b.active !== undefined ? { active: !!b.active } : {}),
    },
  });
  return NextResponse.json({ product: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const product = await loadOwned(session.userId, session.role, id);
  if (!product) return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  const orders = await prisma.order.count({ where: { productId: id } });
  if (orders > 0)
    return NextResponse.json(
      { error: "Produto tem pedidos — desative em vez de excluir" },
      { status: 400 },
    );

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
