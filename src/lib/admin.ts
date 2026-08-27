// Helper de autorização para as rotas /api/admin/*
import { getSession, Session } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Retorna a sessão ou null. Use no início de cada rota admin.
export async function requireSession(): Promise<Session | null> {
  return getSession();
}

// Confere se a sessão pode gerenciar aquela loja.
// ADMIN pode tudo; OWNER só as próprias lojas.
export async function canManageStore(
  session: Session,
  storeId: string,
): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  const store = await prisma.store.findFirst({
    where: { id: storeId, ownerId: session.userId },
    select: { id: true },
  });
  return !!store;
}

// Gera slug a partir de um texto
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
