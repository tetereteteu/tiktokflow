// Anúncios — conecta a conta do TikTok, publica o catálogo e sobe
// campanha sem sair do painel. Server Component: sessão + dados.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import AnunciosClient from "./AnunciosClient";

export default async function AnunciosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, slug: true },
      },
      campaigns: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  // token nunca sai do servidor — só a flag de "configurado"
  const safe = stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    tiktokAdvertiserId: s.tiktokAdvertiserId ?? "",
    tiktokBcId: s.tiktokBcId ?? "",
    tiktokCatalogId: s.tiktokCatalogId ?? "",
    hasBusinessToken: !!s.tiktokBusinessToken,
    products: s.products,
    campaigns: s.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      budgetCents: c.budgetCents,
      externalCampaignId: c.externalCampaignId,
      lastError: c.lastError,
      createdAt: c.createdAt.toISOString(),
    })),
  }));

  return (
    <PainelShell email={session.email}>
      <AnunciosClient stores={safe} />
    </PainelShell>
  );
}
