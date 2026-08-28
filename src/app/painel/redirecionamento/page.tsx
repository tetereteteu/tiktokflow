import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import RedirecionamentoClient from "./RedirecionamentoClient";

export default async function RedirecionamentoPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: {
      id: true, name: true,
      redirectUrl: true, redirectSkipUpsell: true,
      products: {
        select: { id: true, title: true, redirectUrl: true },
        orderBy: { title: "asc" },
      },
      _count: { select: { upsells: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PainelShell email={session.email}>
      <RedirecionamentoClient
        lojas={lojas.map((l) => ({
          id: l.id, name: l.name,
          redirectUrl: l.redirectUrl, redirectSkipUpsell: l.redirectSkipUpsell,
          temUpsell: l._count.upsells > 0,
          produtos: l.products,
        }))}
      />
    </PainelShell>
  );
}
