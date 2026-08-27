// ─────────────────────────────────────────────────────────────
// Feed de catálogo de produtos.
// URL pública: /catalog/{slug-da-loja}/feed.csv
//
// Formato CSV compatível com TikTok Catalog Manager, Meta Catalog
// e Google Merchant (colunas padrão da indústria). É isto que você
// cola no "Data feed / URL" do catálogo do TikTok pra rodar
// Video Shopping Ads / DSA com os seus produtos.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// escapa um campo pra CSV (aspas se tiver vírgula/aspas/quebra de linha)
function csv(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function reais(cents: number): string {
  return `${(cents / 100).toFixed(2)} BRL`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> },
) {
  const { store: slug } = await params;

  const store = await prisma.store.findFirst({
    where: { slug, active: true },
    include: {
      products: { where: { active: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const base =
    process.env.APP_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;

  const header = [
    "id",
    "title",
    "description",
    "availability",
    "condition",
    "price",
    "sale_price",
    "link",
    "image_link",
    "brand",
    "product_type",
  ].join(",");

  const rows = store.products.map((p) => {
    const link = `${base}/${store.slug}/checkout/${p.slug}`;
    const price =
      p.compareAtCents && p.compareAtCents > p.priceCents
        ? p.compareAtCents
        : p.priceCents;
    const salePrice =
      p.compareAtCents && p.compareAtCents > p.priceCents
        ? p.priceCents
        : null;

    return [
      csv(p.id),
      csv(p.title),
      csv(p.description || p.title),
      "in stock",
      "new",
      reais(price),
      salePrice != null ? reais(salePrice) : "",
      csv(link),
      csv(p.imageUrl || ""),
      csv(store.name),
      csv("Geral"),
    ].join(",");
  });

  const body = [header, ...rows].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="catalog-${store.slug}.csv"`,
      // deixa o TikTok/Meta re-baixarem sem cache velho
      "Cache-Control": "public, max-age=300",
    },
  });
}
