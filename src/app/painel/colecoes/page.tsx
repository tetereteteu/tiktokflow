import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import ColecoesClient from "./ColecoesClient";

export default async function ColecoesPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  const ids = lojas.map((l) => l.id);

  const [colecoes, produtos] = await Promise.all([
    prisma.collection.findMany({
      where: { storeId: { in: ids } },
      orderBy: [{ storeId: "asc" }, { ordem: "asc" }, { title: "asc" }],
      include: { products: { select: { id: true } } },
    }),
    prisma.product.findMany({
      where: { storeId: { in: ids } },
      select: { id: true, title: true, storeId: true, active: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <PainelShell email={session.email}>
      <ColecoesClient
        lojas={lojas}
        produtos={produtos}
        colecoes={colecoes.map((c) => ({
          id: c.id,
          storeId: c.storeId,
          title: c.title,
          slug: c.slug,
          description: c.description,
          active: c.active,
          ordem: c.ordem,
          productIds: c.products.map((p) => p.id),
        }))}
        baseUrl={(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}
      />
    </PainelShell>
  );
}
