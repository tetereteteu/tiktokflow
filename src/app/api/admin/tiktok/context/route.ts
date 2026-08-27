// GET /api/admin/tiktok/context?storeId=
// Lê da conta do lojista tudo que a tela de campanha precisa
// escolher — anunciante, regiões, identidades e catálogos.
// É também o teste de conexão: se o token estiver errado, falha aqui.

import { NextRequest, NextResponse } from "next/server";
import { guardStore, needsTiktok } from "@/lib/api-guard";
import { advertiserInfo, listRegions, listIdentities, listCatalogs } from "@/lib/tiktok-ads";

export async function GET(req: NextRequest) {
  const g = await guardStore(req);
  if (g.error) return g.error;
  const store = g.store;
  const missing = needsTiktok(store);
  if (missing) return missing;

  const token = store.tiktokBusinessToken!;
  const adv = store.tiktokAdvertiserId!;

  const [info, regions, identities, catalogs] = await Promise.all([
    advertiserInfo(token, adv),
    listRegions(token, adv, "PRODUCT_SALES"),
    listIdentities(token, adv),
    store.tiktokBcId ? listCatalogs(token, store.tiktokBcId) : Promise.resolve(null),
  ]);

  if (!info.ok) {
    return NextResponse.json(
      { error: `TikTok recusou a conexão: ${info.message}`, code: info.code },
      { status: 400 },
    );
  }

  return NextResponse.json({
    advertiser: (info.data as { list?: unknown[] } | null)?.list?.[0] ?? null,
    regions: regions.ok ? regions.data : { error: regions.message },
    identities: identities.ok ? identities.data : { error: identities.message },
    catalogs: catalogs ? (catalogs.ok ? catalogs.data : { error: catalogs.message }) : null,
    catalogId: store.tiktokCatalogId,
  });
}
