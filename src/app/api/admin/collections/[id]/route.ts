// Coleções: editar e remover.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore, slugify } from "@/lib/admin";

async function carregar(id: string) {
  return prisma.collection.findUnique({
    where: { id },
    select: { id: true, storeId: true },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const atual = await carregar(id);
  if (!atual) return NextResponse.json({ error: "Coleção não encontrada" }, { status: 404 });
  if (!(await canManageStore(session, atual.storeId)))
    return NextResponse.json({ error: "Sem acesso à loja" }, { status: 403 });

  const b = await req.json().catch(() => ({}));

  let slug: string | undefined;
  if (b.slug || b.title) {
    slug = slugify(b.slug || b.title);
    const dup = await prisma.collection.findFirst({
      where: { storeId: atual.storeId, slug, id: { not: id } },
    });
    if (dup)
      return NextResponse.json(
        { error: "Já existe coleção com esse slug nesta loja" },
        { status: 409 },
      );
  }

  // `set` (e não `connect`) porque a tela manda a lista final:
  // com connect, produto desmarcado continuaria na coleção.
  let products: { set: { id: string }[] } | undefined;
  if (Array.isArray(b.productIds)) {
    const daLoja = await prisma.product.findMany({
      where: { id: { in: b.productIds.map(String) }, storeId: atual.storeId },
      select: { id: true },
    });
    products = { set: daLoja.map((p) => ({ id: p.id })) };
  }

  const collection = await prisma.collection.update({
    where: { id },
    data: {
      ...(b.title ? { title: String(b.title) } : {}),
      ...(slug ? { slug } : {}),
      ...(b.description !== undefined
        ? { description: b.description ? String(b.description) : null }
        : {}),
      ...(b.active !== undefined ? { active: !!b.active } : {}),
      ...(b.ordem !== undefined && Number.isFinite(Number(b.ordem))
        ? { ordem: Math.round(Number(b.ordem)) }
        : {}),
      ...(products ? { products } : {}),
    },
    include: { products: { select: { id: true } } },
  });

  return NextResponse.json({ collection });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const atual = await carregar(id);
  if (!atual) return NextResponse.json({ error: "Coleção não encontrada" }, { status: 404 });
  if (!(await canManageStore(session, atual.storeId)))
    return NextResponse.json({ error: "Sem acesso à loja" }, { status: 403 });

  // Apaga só a coleção: a relação com Product é N:N, os produtos ficam.
  await prisma.collection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
