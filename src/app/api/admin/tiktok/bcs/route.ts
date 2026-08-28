// ─────────────────────────────────────────────────────────────
// Lista os Business Centers que o token da loja enxerga.
//
// Serve pra tela não depender de o dono colar id na mão e, mais
// importante, pra ele ver a moeda e o país de cada BC — a moeda da
// conta precisa bater com a do BC, e a maioria dos BCs em uso não é
// brasileira.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";
import { listBusinessCenters, normalizarBcs } from "@/lib/tiktok-ads";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const storeId = req.nextUrl.searchParams.get("storeId") ?? "";
  if (!storeId || !(await canManageStore(session, storeId)))
    return NextResponse.json({ error: "Sem acesso a esta loja" }, { status: 403 });

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { tiktokBusinessToken: true },
  });
  if (!store?.tiktokBusinessToken)
    return NextResponse.json(
      { error: "Cadastre o token de Marketing API do TikTok nesta loja antes." },
      { status: 400 },
    );

  const r = await listBusinessCenters(store.tiktokBusinessToken);
  if (!r.ok) return NextResponse.json({ error: r.message, code: r.code }, { status: 502 });

  return NextResponse.json({ bcs: normalizarBcs(r.data) });
}
