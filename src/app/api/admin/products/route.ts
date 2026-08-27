import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore, slugify } from "@/lib/admin";

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

  const slug = b.slug ? slugify(b.slug) : slugify(b.title);
  const dup = await prisma.product.findFirst({
    where: { storeId: b.storeId, slug },
  });
  if (dup)
    return NextResponse.json(
      { error: "Já existe produto com esse slug nesta loja" },
      { status: 409 },
    );

  const product = await prisma.product.create({
    data: {
      storeId: b.storeId,
      title: b.title,
      slug,
      description: b.description || null,
      priceCents: Math.round(Number(b.priceCents)),
      compareAtCents: b.compareAtCents ? Math.round(Number(b.compareAtCents)) : null,
      imageUrl: b.imageUrl || null,
      active: b.active ?? true,
    },
  });
  return NextResponse.json({ product });
}
