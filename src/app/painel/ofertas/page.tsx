import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import OfertasClient from "./OfertasClient";

export default async function OfertasPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const storeWhere = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where: storeWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const storeIds = stores.map((s) => s.id);

  const [bumps, upsells, products] = await Promise.all([
    prisma.orderBump.findMany({
      where: { storeId: { in: storeIds } },
      include: { store: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.upsell.findMany({
      where: { storeId: { in: storeIds } },
      include: { store: { select: { name: true } }, product: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { storeId: { in: storeIds }, active: true },
      select: { id: true, title: true, storeId: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const safeBumps = bumps.map((b) => ({
    id: b.id, title: b.title, description: b.description,
    priceCents: b.priceCents, active: b.active,
    storeId: b.storeId, storeName: b.store.name,
  }));
  const safeUpsells = upsells.map((u) => ({
    id: u.id, title: u.title, description: u.description,
    priceCents: u.priceCents, compareAtCents: u.compareAtCents, active: u.active,
    storeId: u.storeId, storeName: u.store.name, productTitle: u.product.title,
  }));

  return (
    <PainelShell email={session.email}>
      <OfertasClient bumps={safeBumps} upsells={safeUpsells} products={products} stores={stores} />
    </PainelShell>
  );
}
