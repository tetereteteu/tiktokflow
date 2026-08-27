import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!(await canManageStore(session, id)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  return NextResponse.json({ store });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!(await canManageStore(session, id)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const store = await prisma.store.update({
    where: { id },
    data: {
      ...(b.name !== undefined ? { name: b.name } : {}),
      ...(b.description !== undefined ? { description: b.description || null } : {}),
      ...(b.domain !== undefined ? { domain: b.domain || null } : {}),
      ...(b.active !== undefined ? { active: !!b.active } : {}),
      ...(b.nervaApiKey !== undefined ? { nervaApiKey: b.nervaApiKey || null } : {}),
      ...(b.nervaWebhookSecret !== undefined ? { nervaWebhookSecret: b.nervaWebhookSecret || null } : {}),
      ...(b.metaPixelId !== undefined ? { metaPixelId: b.metaPixelId || null } : {}),
      ...(b.tiktokPixelId !== undefined ? { tiktokPixelId: b.tiktokPixelId || null } : {}),
      ...(b.googleAdsId !== undefined ? { googleAdsId: b.googleAdsId || null } : {}),
      ...(b.capiOwn !== undefined ? { capiOwn: !!b.capiOwn } : {}),
      ...(b.metaAccessToken !== undefined ? { metaAccessToken: b.metaAccessToken || null } : {}),
      ...(b.metaTestEventCode !== undefined ? { metaTestEventCode: b.metaTestEventCode || null } : {}),
      ...(b.tiktokAccessToken !== undefined ? { tiktokAccessToken: b.tiktokAccessToken || null } : {}),
      ...(b.tiktokTestEventCode !== undefined ? { tiktokTestEventCode: b.tiktokTestEventCode || null } : {}),
    },
  });
  return NextResponse.json({ store });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!(await canManageStore(session, id)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  // Só deixa excluir se não houver pedidos (proteção contra perda de histórico)
  const orders = await prisma.order.count({ where: { storeId: id } });
  if (orders > 0)
    return NextResponse.json(
      { error: "Loja tem pedidos — desative em vez de excluir" },
      { status: 400 },
    );

  await prisma.store.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
