import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import CatalogoClient from "./CatalogoClient";

export default async function CatalogoPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where,
    select: {
      id: true, name: true, slug: true,
      metaPixelId: true, tiktokPixelId: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  });

  const safe = stores.map((s) => ({
    id: s.id, name: s.name, slug: s.slug,
    hasTiktokPixel: !!s.tiktokPixelId,
    hasMetaPixel: !!s.metaPixelId,
    products: s._count.products,
  }));

  return (
    <PainelShell email={session.email}>
      <CatalogoClient stores={safe} />
    </PainelShell>
  );
}
