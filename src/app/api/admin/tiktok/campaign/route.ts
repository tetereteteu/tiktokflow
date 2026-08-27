// POST /api/admin/tiktok/campaign?storeId=
// Sobe a campanha inteira: campanha → conjunto → anúncio.
//
// Cada etapa grava o id devolvido ANTES de seguir. Se o conjunto
// falhar, a campanha que já subiu fica registrada com o erro em vez
// de virar órfã invisível na conta de anúncio.
//
// Tudo nasce PAUSADO (operation_status DISABLE): ninguém queima
// verba por um clique errado no painel.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardStore, needsTiktok } from "@/lib/api-guard";
import { createCampaign, createAdgroup, createAd, type LaunchInput } from "@/lib/tiktok-ads";

export async function POST(req: NextRequest) {
  const g = await guardStore(req);
  if (g.error) return g.error;
  const store = g.store;
  const missing = needsTiktok(store);
  if (missing) return missing;

  const b = await req.json().catch(() => ({}));
  const name = String(b.campaignName ?? "").trim().slice(0, 100);
  const budget = Number(b.dailyBudgetReais);
  const locationIds = Array.isArray(b.locationIds) ? b.locationIds.map(String).filter(Boolean) : [];

  if (!name) return NextResponse.json({ error: "Dê um nome à campanha." }, { status: 400 });
  if (!Number.isFinite(budget) || budget < 20)
    return NextResponse.json({ error: "Orçamento diário mínimo de R$ 20." }, { status: 400 });
  if (locationIds.length === 0)
    return NextResponse.json({ error: "Escolha ao menos uma região." }, { status: 400 });

  const product = b.productId
    ? await prisma.product.findFirst({ where: { id: String(b.productId), storeId: store.id } })
    : await prisma.product.findFirst({ where: { storeId: store.id, active: true }, orderBy: { createdAt: "asc" } });
  if (!product) return NextResponse.json({ error: "Cadastre um produto antes." }, { status: 400 });

  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const input: LaunchInput = {
    token: store.tiktokBusinessToken!,
    advertiserId: store.tiktokAdvertiserId!,
    campaignName: name,
    dailyBudgetReais: budget,
    catalogId: store.tiktokCatalogId,
    identityId: b.identityId ? String(b.identityId) : null,
    identityType: b.identityType ? String(b.identityType) : null,
    pixelId: store.tiktokPixelId,
    locationIds,
    startTime: String(b.startTime ?? "").trim() || nowPlus(10),
    landingUrl: `${base}/${store.slug}/checkout/${product.slug}`,
    adText: String(b.adText ?? product.title).slice(0, 100),
  };

  const row = await prisma.adCampaign.create({
    data: {
      storeId: store.id, name, objective: "PRODUCT_SALES",
      budgetCents: Math.round(budget * 100), productId: product.id,
    },
  });

  const fail = async (msg: string, code?: number) => {
    await prisma.adCampaign.update({
      where: { id: row.id }, data: { status: "ERRO", lastError: msg.slice(0, 900) },
    });
    return NextResponse.json({ error: msg, code, campaignRowId: row.id }, { status: 400 });
  };

  const camp = await createCampaign(input);
  if (!camp.ok) return fail(`Campanha recusada: ${camp.message}`, camp.code);
  const campaignId = String((camp.data as { campaign_id?: string } | null)?.campaign_id ?? "");
  await prisma.adCampaign.update({ where: { id: row.id }, data: { externalCampaignId: campaignId } });

  const ag = await createAdgroup(input, campaignId);
  if (!ag.ok) return fail(`Conjunto recusado: ${ag.message}`, ag.code);
  const adgroupId = String((ag.data as { adgroup_id?: string } | null)?.adgroup_id ?? "");
  await prisma.adCampaign.update({ where: { id: row.id }, data: { externalAdgroupId: adgroupId } });

  const ad = await createAd(input, adgroupId);
  if (!ad.ok) return fail(`Anúncio recusado: ${ad.message}`, ad.code);
  const adIds = (ad.data as { ad_ids?: string[] } | null)?.ad_ids ?? [];

  const saved = await prisma.adCampaign.update({
    where: { id: row.id },
    data: { externalAdId: adIds[0] ?? null, status: "ATIVA", lastError: null },
  });

  return NextResponse.json({ campaign: saved, landingUrl: input.landingUrl });
}

/** "YYYY-MM-DD HH:mm:ss" daqui a N minutos — o TikTok recusa início no passado. */
function nowPlus(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
