import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import LojasClient from "./LojasClient";

export default async function LojasPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true, orders: true } } },
  });

  // não mandamos a apiKey/secret pro client por segurança — só flags de "configurado"
  const safe = stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    domain: s.domain,
    active: s.active,
    metaPixelId: s.metaPixelId,
    tiktokPixelId: s.tiktokPixelId,
    googleAdsId: s.googleAdsId,
    hasNervaKey: !!s.nervaApiKey,
    hasWebhookSecret: !!s.nervaWebhookSecret,
    capiOwn: s.capiOwn,
    metaTestEventCode: s.metaTestEventCode,
    tiktokTestEventCode: s.tiktokTestEventCode,
    hasMetaToken: !!s.metaAccessToken,
    hasTiktokToken: !!s.tiktokAccessToken,
    products: s._count.products,
    orders: s._count.orders,
  }));

  return (
    <PainelShell email={session.email}>
      <LojasClient initialStores={safe} />
    </PainelShell>
  );
}
