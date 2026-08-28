// Coleções: criar. Edição e remoção ficam em [id]/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore, slugify } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.storeId || !b.title)
    return NextResponse.json({ error: "Loja e título são obrigatórios" }, { status: 400 });

  if (!(await canManageStore(session, b.storeId)))
    return NextResponse.json({ error: "Sem acesso à loja" }, { status: 403 });

  const slug = slugify(b.slug || b.title);
  if (!slug)
    return NextResponse.json({ error: "Título inválido para gerar o slug" }, { status: 400 });

  // Slug é único por loja: é ele que vai na URL do feed filtrado.
  const dup = await prisma.collection.findFirst({ where: { storeId: b.storeId, slug } });
  if (dup)
    return NextResponse.json(
      { error: "Já existe coleção com esse slug nesta loja" },
      { status: 409 },
    );

  // Só aceita produtos da própria loja: id de outra loja aqui
  // vazaria produto entre vitrines.
  const productIds: string[] = Array.isArray(b.productIds) ? b.productIds.map(String) : [];
  const daLoja = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, storeId: b.storeId },
        select: { id: true },
      })
    : [];

  const collection = await prisma.collection.create({
    data: {
      storeId: b.storeId,
      title: String(b.title),
      slug,
      description: b.description ? String(b.description) : null,
      active: b.active ?? true,
      ordem: Number.isFinite(Number(b.ordem)) ? Math.round(Number(b.ordem)) : 0,
      products: { connect: daLoja.map((p) => ({ id: p.id })) },
    },
    include: { products: { select: { id: true } } },
  });

  return NextResponse.json({ collection });
}
