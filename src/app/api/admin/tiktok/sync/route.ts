// POST /api/admin/tiktok/sync?storeId=
// Puxa o gasto diário por campanha e grava em AdSpend — é o que
// permite o BI mostrar lucro, e não só faturamento.
//
// Upsert por (loja, plataforma, dia, campanha): rodar duas vezes no
// mesmo período corrige os números em vez de duplicá-los. Isso
// importa porque o TikTok reprocessa o gasto do dia por algumas horas.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardStore, needsTiktok } from "@/lib/api-guard";
import { campaignSpend } from "@/lib/tiktok-ads";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function POST(req: NextRequest) {
  const g = await guardStore(req);
  if (g.error) return g.error;
  const store = g.store;
  const missing = needsTiktok(store);
  if (missing) return missing;

  const b = await req.json().catch(() => ({}));
  const days = Math.max(1, Math.min(90, Math.round(Number(b.days)) || 30));
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86400000);

  const { result, rows } = await campaignSpend(
    store.tiktokBusinessToken!, store.tiktokAdvertiserId!, ymd(start), ymd(end),
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: `Relatório recusado: ${result.message}`, code: result.code },
      { status: 400 },
    );
  }

  for (const r of rows) {
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const key = {
      storeId_platform_date_externalCampaignId: {
        storeId: store.id,
        platform: "TIKTOK" as const,
        date,
        externalCampaignId: r.campaignId,
      },
    };
    const values = {
      spendCents: Math.round(r.spendReais * 100),
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
    };
    await prisma.adSpend.upsert({
      where: key,
      create: {
        storeId: store.id, platform: "TIKTOK", date,
        externalCampaignId: r.campaignId, ...values,
      },
      update: values,
    });
  }

  const totalCents = rows.reduce((a, r) => a + Math.round(r.spendReais * 100), 0);
  return NextResponse.json({
    linhas: rows.length,
    periodo: `${ymd(start)} a ${ymd(end)}`,
    gastoTotalCents: totalCents,
  });
}
