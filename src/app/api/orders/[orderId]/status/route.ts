// GET /api/orders/{orderId}/status
// Usado pela tela de "aguardando pagamento" pra atualizar visualmente.
// O webhook é a fonte da verdade; isto é só pra UI reagir.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, paidAt: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ status: order.status, paidAt: order.paidAt });
}
