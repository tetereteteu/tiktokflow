import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Preencha e-mail e senha" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).toLowerCase().trim() },
  });

  // resposta genérica pra não revelar se o e-mail existe
  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos" },
      { status: 401 },
    );
  }

  await createSession({ userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ ok: true });
}
