// ─────────────────────────────────────────────────────────────
// Feed de catálogo de produtos.
// URL pública: /catalog/{slug-da-loja}/feed.csv
//        e     /catalog/{slug-da-loja}/feed.csv?colecao={slug}
//
// Formato CSV compatível com TikTok Catalog Manager, Meta Catalog e
// Google Merchant. É isto que vai no "Data feed / URL" do catálogo.
//
// O filtro por coleção existe pra rodar campanha de uma linha de
// produto só, em vez do catálogo inteiro. A coluna product_type
// recebe o nome da coleção, que é como as plataformas agrupam o
// catálogo — antes era "Geral" fixo pra tudo.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CABECALHO, linhaFeed } from "@/lib/feed-catalogo";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> },
) {
  const { store: slug } = await params;
  const colecaoSlug = req.nextUrl.searchParams.get("colecao")?.trim() || null;

  const store = await prisma.store.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true },
  });
  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  let colecao: { id: string; title: string } | null = null;
  if (colecaoSlug) {
    colecao = await prisma.collection.findFirst({
      where: { storeId: store.id, slug: colecaoSlug, active: true },
      select: { id: true, title: true },
    });
    if (!colecao) {
      return NextResponse.json({ error: "Coleção não encontrada" }, { status: 404 });
    }
  }

  const produtos = await prisma.product.findMany({
    where: {
      storeId: store.id,
      active: true,
      ...(colecao ? { collections: { some: { id: colecao.id } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      // product_type sai da coleção; sem filtro, usa a primeira ativa
      collections: {
        where: { active: true },
        orderBy: { ordem: "asc" },
        select: { title: true },
        take: 1,
      },
    },
  });

  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;

  const linhas = produtos.map((p) =>
    linhaFeed(p, {
      baseUrl: base,
      storeSlug: store.slug,
      storeName: store.name,
      productType: colecao?.title ?? p.collections[0]?.title ?? "Geral",
    }),
  );

  const nome = colecao ? `${store.slug}-${colecaoSlug}` : store.slug;

  return new NextResponse([CABECALHO, ...linhas].join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="catalog-${nome}.csv"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
