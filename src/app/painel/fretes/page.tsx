import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import FretesClient from "./FretesClient";

export default async function FretesPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: {
      id: true, name: true, freteGratisAcimaCents: true,
      shippingRates: {
        orderBy: [{ ordem: "asc" }, { priceCents: "asc" }],
        select: { id: true, nome: true, prazoDias: true, priceCents: true, ativo: true, ordem: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <PainelShell email={session.email}>
      <FretesClient lojas={lojas} />
    </PainelShell>
  );
}
