// ─────────────────────────────────────────────────────────────
// Montagem do feed CSV de catálogo (TikTok / Meta / Google).
//
// Fica separado da rota pra poder ser testado: é aqui que mora a
// regra de preço "de/por" — trocar as duas colunas faz o anúncio
// exibir desconto invertido, e isso não dá erro em lugar nenhum.
// ─────────────────────────────────────────────────────────────

export const CABECALHO = [
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

/** Escapa um campo pra CSV: aspas quando houver vírgula, aspas ou quebra. */
export function csv(v: string | null | undefined): string {
  const s = (v ?? "").replace(/\r?\n/g, " ").trim();
  if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reais(cents: number): string {
  return `${(cents / 100).toFixed(2)} BRL`;
}

export interface ProdutoFeed {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
}

export interface ContextoFeed {
  baseUrl: string;
  storeSlug: string;
  storeName: string;
  /** Categoria da linha — a coleção do produto, quando houver. */
  productType: string;
}

export function linhaFeed(p: ProdutoFeed, ctx: ContextoFeed): string {
  // "price" é o cheio e "sale_price" o promocional. Sem compareAt não
  // existe promoção: price recebe o preço real e sale_price fica vazio.
  const temPromocao = p.compareAtCents != null && p.compareAtCents > p.priceCents;
  const price = temPromocao ? (p.compareAtCents as number) : p.priceCents;
  const salePrice = temPromocao ? p.priceCents : null;

  return [
    csv(p.id),
    csv(p.title),
    csv(p.description || p.title),
    "in stock",
    "new",
    reais(price),
    salePrice != null ? reais(salePrice) : "",
    csv(`${ctx.baseUrl}/${ctx.storeSlug}/checkout/${p.slug}`),
    csv(p.imageUrl || ""),
    csv(ctx.storeName),
    csv(ctx.productType),
  ].join(",");
}
