import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import GatewaysClient from "./GatewaysClient";

export default async function GatewaysPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({
    where,
    select: { id: true, name: true, nervaApiKey: true, nervaWebhookSecret: true },
    orderBy: { name: "asc" },
  });

  return (
    <PainelShell email={session.email}>
      <GatewaysClient
        // nunca manda o segredo pro browser, só se existe
        lojas={lojas.map((l) => ({
          id: l.id,
          name: l.name,
          temChave: !!l.nervaApiKey,
          temSecret: !!l.nervaWebhookSecret,
        }))}
        baseUrl={(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}
      />
    </PainelShell>
  );
}
