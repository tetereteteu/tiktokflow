import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import PagamentosClient from "./PagamentosClient";

export default async function PagamentosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: {
      id: true, name: true,
      pixExpiraSegundos: true, faturaDescricao: true,
      nervaApiKey: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <PainelShell email={session.email}>
      <PagamentosClient
        lojas={lojas.map((l) => ({
          id: l.id, name: l.name,
          pixExpiraSegundos: l.pixExpiraSegundos,
          faturaDescricao: l.faturaDescricao,
          conectada: !!l.nervaApiKey,
        }))}
      />
    </PainelShell>
  );
}
