import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import ProdutosClient from "./ProdutosClient";

export default async function ProdutosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const storeWhere = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where: storeWhere,
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const storeIds = stores.map((s) => s.id);

  const products = await prisma.product.findMany({
    where: { storeId: { in: storeIds } },
    include: { store: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });

  const safe = products.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    description: p.description,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    imageUrl: p.imageUrl,
    active: p.active,
    storeId: p.storeId,
    storeName: p.store.name,
    storeSlug: p.store.slug,
  }));

  return (
    <PainelShell email={session.email}>
      <ProdutosClient products={safe} stores={stores} />
    </PainelShell>
  );
}
