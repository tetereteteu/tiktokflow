// Faixas de frete: editar e remover.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

async function guarda(id: string) {
  return prisma.shippingRate.findUnique({ where: { id }, select: { id: true, storeId: true } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const atual = await guarda(id);
  if (!atual) return NextResponse.json({ error: "Faixa não encontrada" }, { status: 404 });
  if (!(await canManageStore(session, atual.storeId)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const rate = await prisma.shippingRate.update({
    where: { id },
    data: {
      ...(b.nome !== undefined ? { nome: String(b.nome).slice(0, 80) } : {}),
      ...(b.prazoDias !== undefined
        ? { prazoDias: Math.max(0, Math.round(Number(b.prazoDias) || 0)) } : {}),
      ...(b.priceCents !== undefined
        ? { priceCents: Math.max(0, Math.round(Number(b.priceCents) || 0)) } : {}),
      ...(b.ativo !== undefined ? { ativo: !!b.ativo } : {}),
      ...(b.ordem !== undefined ? { ordem: Math.round(Number(b.ordem) || 0) } : {}),
    },
  });
  return NextResponse.json({ rate });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const atual = await guarda(id);
  if (!atual) return NextResponse.json({ error: "Faixa não encontrada" }, { status: 404 });
  if (!(await canManageStore(session, atual.storeId)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  // Pedido antigo guarda shippingCents e shippingName por cópia, e a
  // FK é ON DELETE SET NULL: apagar a faixa não altera o que foi cobrado.
  await prisma.shippingRate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
