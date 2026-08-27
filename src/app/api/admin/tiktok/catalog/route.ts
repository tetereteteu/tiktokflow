// POST /api/admin/tiktok/catalog?storeId=
// Cria o catálogo no TikTok e registra o feed CSV que este app já
// publica em /catalog/{slug}/feed.csv. É o "sobe o catálogo sozinho":
// o lojista não exporta planilha nem faz upload de nada.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardStore, needsTiktok } from "@/lib/api-guard";
import { createCatalog, createCatalogFeed } from "@/lib/tiktok-ads";

export async function POST(req: NextRequest) {
  const g = await guardStore(req);
  if (g.error) return g.error;
  const store = g.store;
  const missing = needsTiktok(store);
  if (missing) return missing;

  if (!store.tiktokBcId) {
    return NextResponse.json(
      { error: "Informe o ID do Business Center — o catálogo pertence a ele, não ao anunciante." },
      { status: 400 },
    );
  }

  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { error: "APP_BASE_URL não definida — sem ela o TikTok não tem como buscar o feed." },
      { status: 400 },
    );
  }
  const feedUrl = `${base}/catalog/${store.slug}/feed.csv`;
  const token = store.tiktokBusinessToken!;

  // Reaproveita o catálogo já vinculado, se houver.
  let catalogId = store.tiktokCatalogId;
  if (!catalogId) {
    const created = await createCatalog(token, store.tiktokBcId, `${store.name} — TikTokFlow`);
    if (!created.ok) {
      return NextResponse.json(
        { error: `Não deu pra criar o catálogo: ${created.message}`, code: created.code },
        { status: 400 },
      );
    }
    catalogId = String((created.data as { catalog_id?: string } | null)?.catalog_id ?? "");
    if (!catalogId) {
      return NextResponse.json({ error: "TikTok não devolveu o id do catálogo." }, { status: 502 });
    }
    await prisma.store.update({ where: { id: store.id }, data: { tiktokCatalogId: catalogId } });
  }

  const feed = await createCatalogFeed(
    token, store.tiktokBcId, catalogId, `${store.slug}-feed`, feedUrl,
  );
  if (!feed.ok) {
    return NextResponse.json(
      { error: `Catálogo criado, mas o feed falhou: ${feed.message}`, catalogId, code: feed.code },
      { status: 400 },
    );
  }

  return NextResponse.json({ catalogId, feedUrl, feed: feed.data });
}
