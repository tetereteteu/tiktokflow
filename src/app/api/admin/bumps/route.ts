import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.storeId || !b.title || b.priceCents == null)
    return NextResponse.json(
      { error: "Loja, título e preço são obrigatórios" },
      { status: 400 },
    );
  if (!(await canManageStore(session, b.storeId)))
    return NextResponse.json({ error: "Sem acesso à loja" }, { status: 403 });

  const bump = await prisma.orderBump.create({
    data: {
      storeId: b.storeId,
      title: b.title,
      description: b.description || null,
      priceCents: Math.round(Number(b.priceCents)),
      imageUrl: b.imageUrl || null,
      active: b.active ?? true,
    },
  });
  return NextResponse.json({ bump });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  const bump = await prisma.orderBump.findUnique({
    where: { id },
    include: { store: { select: { ownerId: true } } },
  });
  if (!bump) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (session.role !== "ADMIN" && bump.store.ownerId !== session.userId)
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  await prisma.orderBump.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
