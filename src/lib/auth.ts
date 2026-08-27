// ─────────────────────────────────────────────────────────────
// Autenticação do painel admin.
// Sessão = JWT assinado (jose) guardado num cookie httpOnly.
// Simples e seguro o suficiente pro MVP; sem libs pesadas.
// ─────────────────────────────────────────────────────────────

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const COOKIE = "nerva_session";
const ALG = "HS256";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado");
  return new TextEncoder().encode(s);
}

export interface Session {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      role: String(payload.role),
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  cookies().delete(COOKIE);
}
