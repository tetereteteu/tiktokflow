// Faixas de frete: criar.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.storeId || !b.nome)
    return NextResponse.json({ error: "Loja e nome são obrigatórios" }, { status: 400 });
  if (!(await canManageStore(session, b.storeId)))
    return NextResponse.json({ error: "Sem acesso à loja" }, { status: 403 });

  const priceCents = Math.max(0, Math.round(Number(b.priceCents) || 0));

  const rate = await prisma.shippingRate.create({
    data: {
      storeId: b.storeId,
      nome: String(b.nome).slice(0, 80),
      prazoDias: Math.max(0, Math.round(Number(b.prazoDias) || 0)),
      priceCents,
      ativo: b.ativo ?? true,
      ordem: Math.round(Number(b.ordem) || 0),
    },
  });
  return NextResponse.json({ rate });
}
