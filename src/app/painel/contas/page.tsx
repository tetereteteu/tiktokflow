import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import ContasClient from "./ContasClient";

export default async function ContasPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: { id: true, name: true, tiktokBusinessToken: true },
    orderBy: { name: "asc" },
  });

  // Último lote da(s) loja(s): permite reabrir a tela e continuar
  // acompanhando um lote que já estava rodando.
  const ultimo = await prisma.adAccountBatch.findFirst({
    where: { storeId: { in: lojas.map((l) => l.id) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  return (
    <PainelShell email={session.email}>
      <ContasClient
        lojas={lojas.map((l) => ({
          id: l.id,
          name: l.name,
          temToken: !!l.tiktokBusinessToken,
        }))}
        loteInicial={ultimo}
      />
    </PainelShell>
  );
}
