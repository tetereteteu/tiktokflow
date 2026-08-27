// ─────────────────────────────────────────────────────────────
// POST /api/admin/stores/{id}/capi-test
// Confere as credenciais da Conversions API SEM sujar os dados de
// anúncio da loja:
//   • Meta   — leitura do pixel (GET), não gera evento nenhum;
//   • TikTok — evento marcado com test_event_code, que a plataforma
//              isola do relatório; sem esse código, não testa.
// Aceita valores do formulário no corpo pra testar antes de salvar;
// o que não vier, usa o que já está gravado na loja.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";
import { checkMetaCredentials, checkTiktokCredentials } from "@/lib/capi";

type Check = { ok: boolean; detail: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!(await canManageStore(session, id)))
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });

  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const pick = (fromForm: unknown, stored: string | null) =>
    typeof fromForm === "string" && fromForm.trim() ? fromForm.trim() : (stored ?? "");

  const metaPixelId = pick(b.metaPixelId, store.metaPixelId);
  const metaToken = pick(b.metaAccessToken, store.metaAccessToken);
  const tiktokPixelId = pick(b.tiktokPixelId, store.tiktokPixelId);
  const tiktokToken = pick(b.tiktokAccessToken, store.tiktokAccessToken);
  const tiktokTestCode = pick(b.tiktokTestEventCode, store.tiktokTestEventCode);

  let meta: Check;
  if (!metaPixelId || !metaToken) {
    meta = { ok: false, detail: "falta o Pixel ID ou o token de acesso" };
  } else {
    const r = await checkMetaCredentials(metaPixelId, metaToken);
    meta = { ok: r.ok, detail: r.detail };
  }

  let tiktok: Check;
  if (!tiktokPixelId || !tiktokToken) {
    tiktok = { ok: false, detail: "falta o Pixel ID ou o token de acesso" };
  } else if (!tiktokTestCode) {
    tiktok = {
      ok: false,
      detail: "preencha o código de teste do TikTok — sem ele o teste sujaria os dados reais",
    };
  } else {
    const r = await checkTiktokCredentials(tiktokPixelId, tiktokToken, tiktokTestCode);
    tiktok = { ok: r.ok, detail: r.detail };
  }

  return NextResponse.json({ meta, tiktok });
}
