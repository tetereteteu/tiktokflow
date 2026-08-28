// Construtor de checkout — escolhe a loja, edita a aparência e vê o
// resultado num preview isolado. Server Component: sessão + dados.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import CheckoutBuilderClient from "./CheckoutBuilderClient";
import { resolveTheme } from "@/lib/checkout-theme";

export default async function ConstrutorPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const stores = await prisma.store.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      checkoutTheme: true,
      products: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { title: true, priceCents: true, slug: true },
      },
    },
  });

  const data = stores.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    theme: resolveTheme(s.checkoutTheme),
    sampleTitle: s.products[0]?.title ?? "Seu produto",
    samplePriceCents: s.products[0]?.priceCents ?? 9700,
    sampleSlug: s.products[0]?.slug ?? null,
  }));

  return (
    <PainelShell email={session.email}>
      <CheckoutBuilderClient stores={data} />
    </PainelShell>
  );
}
