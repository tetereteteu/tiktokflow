// ─────────────────────────────────────────────────────────────
// GET/PUT /api/admin/checkout-theme?storeId=...
// Lê e grava a aparência do checkout (Construtor).
// Toda cor é validada como hex e o CSS customizado é sanitizado
// antes de encostar no banco — ele vai parar numa página pública.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, canManageStore } from "@/lib/admin";
import {
  DEFAULT_THEME, resolveTheme, hex, cleanCustomCss,
  type CheckoutThemeData,
} from "@/lib/checkout-theme";

async function guard(req: NextRequest) {
  const session = await requireSession();
  if (!session) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const storeId = req.nextUrl.searchParams.get("storeId") ?? "";
  if (!storeId) return { error: NextResponse.json({ error: "storeId obrigatório" }, { status: 400 }) };
  if (!(await canManageStore(session, storeId)))
    return { error: NextResponse.json({ error: "Sem acesso" }, { status: 403 }) };
  return { storeId };
}

export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;
  const row = await prisma.checkoutTheme.findUnique({ where: { storeId: g.storeId! } });
  return NextResponse.json({ theme: resolveTheme(row) });
}

// Limita texto livre pra não estourar a tela nem o banco.
const str = (v: unknown, max: number, fallback: string | null = null) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback;

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export async function PUT(req: NextRequest) {
  const g = await guard(req);
  if (g.error) return g.error;
  const b = await req.json().catch(() => ({}));

  const data: CheckoutThemeData = {
    brandColor: hex(b.brandColor, DEFAULT_THEME.brandColor),
    bgColor: hex(b.bgColor, DEFAULT_THEME.bgColor),
    cardColor: hex(b.cardColor, DEFAULT_THEME.cardColor),
    textColor: hex(b.textColor, DEFAULT_THEME.textColor),
    radiusPx: int(b.radiusPx, 0, 40, DEFAULT_THEME.radiusPx),
    bannerDesktopUrl: str(b.bannerDesktopUrl, 500),
    bannerMobileUrl: str(b.bannerMobileUrl, 500),
    noticeEnabled: bool(b.noticeEnabled, false),
    noticeText: str(b.noticeText, 160),
    noticeBg: hex(b.noticeBg, DEFAULT_THEME.noticeBg),
    noticeColor: hex(b.noticeColor, DEFAULT_THEME.noticeColor),
    countdownEnabled: bool(b.countdownEnabled, false),
    countdownMinutes: int(b.countdownMinutes, 1, 240, DEFAULT_THEME.countdownMinutes),
    countdownText: str(b.countdownText, 60, DEFAULT_THEME.countdownText)!,
    socialProofEnabled: bool(b.socialProofEnabled, false),
    socialProofText: str(b.socialProofText, 160),
    socialProofAvatars: bool(b.socialProofAvatars, true),
    badgesEnabled: bool(b.badgesEnabled, true),
    ctaText: str(b.ctaText, 60, DEFAULT_THEME.ctaText)!,
    footerText: str(b.footerText, 400),
    customCss: cleanCustomCss(b.customCss),
  };

  const theme = await prisma.checkoutTheme.upsert({
    where: { storeId: g.storeId! },
    create: { storeId: g.storeId!, ...data },
    update: data,
  });
  return NextResponse.json({ theme: resolveTheme(theme) });
}
