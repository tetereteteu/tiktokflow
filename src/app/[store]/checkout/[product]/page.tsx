// Checkout: /{store}/checkout/{product}
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CheckoutClient from "./CheckoutClient";
import { resolveTheme } from "@/lib/checkout-theme";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ store: string; product: string }>;
}) {
  const { store: storeSlug, product: productSlug } = await params;

  const store = await prisma.store.findFirst({
    where: { slug: storeSlug, active: true },
    select: {
      id: true,
      name: true,
      slug: true,
      metaPixelId: true,
      tiktokPixelId: true,
      redirectUrl: true,
      redirectSkipUpsell: true,
    },
  });
  if (!store) notFound();

  const product = await prisma.product.findFirst({
    where: { storeId: store.id, slug: productSlug, active: true },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      compareAtCents: true,
      imageUrl: true,
      redirectUrl: true,
    },
  });
  if (!product) notFound();

  // order bump ativo da loja (pega o primeiro, MVP)
  const bump = await prisma.orderBump.findFirst({
    where: { storeId: store.id, active: true },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      imageUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // upsell ativo da loja (oferta pós-compra)
  const upsell = await prisma.upsell.findFirst({
    where: { storeId: store.id, active: true },
    select: {
      id: true,
      title: true,
      description: true,
      priceCents: true,
      compareAtCents: true,
      imageUrl: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // aparência definida no Construtor; sem linha no banco, usa o padrão
  const theme = resolveTheme(
    await prisma.checkoutTheme.findUnique({ where: { storeId: store.id } }),
  );

  return (
    <CheckoutClient
      theme={theme}
      storeName={store.name}
      storeSlug={store.slug}
      metaPixelId={store.metaPixelId}
      tiktokPixelId={store.tiktokPixelId}
      product={product}
      bump={bump}
      upsell={upsell}
      /* o destino do produto sobrescreve o da loja */
      redirectUrl={product.redirectUrl ?? store.redirectUrl}
      redirectSkipUpsell={store.redirectSkipUpsell}
    />
  );
}
