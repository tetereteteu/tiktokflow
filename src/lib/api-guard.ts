// ─────────────────────────────────────────────────────────────
// Guarda comum das rotas /api/admin que operam sobre UMA loja:
// exige sessão, exige storeId e confere que a sessão pode gerir
// aquela loja. Devolve a loja já carregada pra evitar segunda query.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";
import type { Store } from "@prisma/client";

export async function guardStore(
  req: NextRequest,
): Promise<{ store: Store; error?: never } | { store?: never; error: NextResponse }> {
  const session = await requireSession();
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };

  const storeId =
    req.nextUrl.searchParams.get("storeId") ??
    (req.method !== "GET" ? ((await req.clone().json().catch(() => ({}))) as { storeId?: string }).storeId : null) ??
    "";
  if (!storeId) return { error: NextResponse.json({ error: "storeId obrigatório" }, { status: 400 }) };
  if (!(await canManageStore(session, storeId)))
    return { error: NextResponse.json({ error: "Sem acesso" }, { status: 403 }) };

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return { error: NextResponse.json({ error: "Loja não encontrada" }, { status: 404 }) };
  return { store };
}

/** Falta de credencial é erro de configuração, não de servidor: 400 com texto claro. */
export function needsTiktok(store: Store): NextResponse | null {
  if (!store.tiktokBusinessToken || !store.tiktokAdvertiserId) {
    return NextResponse.json(
      { error: "Conecte o TikTok primeiro: falta o ID do anunciante ou o token da Marketing API." },
      { status: 400 },
    );
  }
  return null;
}
