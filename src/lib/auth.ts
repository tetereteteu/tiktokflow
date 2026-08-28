// ─────────────────────────────────────────────────────────────
// Autenticação do painel admin.
// Sessão = JWT assinado (jose) guardado num cookie httpOnly.
// Simples e seguro o suficiente pro MVP; sem libs pesadas.
// ─────────────────────────────────────────────────────────────

import { cookies, headers } from "next/headers";
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

// ─────────────────────────────────────────────────────────────
// O cookie só leva Secure quando a requisição REALMENTE chegou por
// HTTPS. Marcar Secure numa resposta HTTP faz o browser descartar o
// cookie em silêncio: o login responde 200 e a pessoa volta pra tela
// de login sem mensagem de erro.
//
// Não dá pra decidir por NODE_ENV (produção sem domínio ainda é HTTP)
// nem por APP_BASE_URL (aponta pro domínio final, que pode não ser o
// endereço usado no acesso). O proxy na frente — Caddy — informa o
// protocolo de origem em x-forwarded-proto. Sem proxy, o header não
// existe e tratamos como HTTP.
// ─────────────────────────────────────────────────────────────
function servidoPorHttps(): boolean {
  return headers().get("x-forwarded-proto") === "https";
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: servidoPorHttps(),
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
