import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PainelShell from "../PainelShell";
import RastreiosClient from "./RastreiosClient";

export default async function RastreiosPage() {
  const session = await getSession();
  if (!session) redirect("/painel/login");

  const where = session.role === "ADMIN" ? {} : { ownerId: session.userId };
  const lojas = await prisma.store.findMany({ where, select: { id: true, slug: true } });

  // Só pedido pago entra: rastreio de pedido não pago não existe.
  const pedidos = await prisma.order.findMany({
    where: { storeId: { in: lojas.map((l) => l.id) }, status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: 100,
    select: {
      id: true, customerName: true, paidAt: true, shippingName: true,
      store: { select: { slug: true } },
      product: { select: { title: true } },
      shipment: { select: { codigo: true, transportadora: true, url: true } },
    },
  });

  return (
    <PainelShell email={session.email}>
      <RastreiosClient
        pedidos={pedidos.map((o) => ({
          id: o.id,
          cliente: o.customerName,
          produto: o.product.title,
          frete: o.shippingName,
          pagoEm: o.paidAt ? o.paidAt.toISOString() : null,
          lojaSlug: o.store.slug,
          codigo: o.shipment?.codigo ?? null,
          transportadora: o.shipment?.transportadora ?? null,
          url: o.shipment?.url ?? null,
        }))}
        baseUrl={(process.env.APP_BASE_URL ?? "").replace(/\/$/, "")}
      />
    </PainelShell>
  );
}
