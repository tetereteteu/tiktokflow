// ─────────────────────────────────────────────────────────────
// Atributos do cookie de sessão.
//
// Existe por causa de um bug real: o cookie ia com Secure mesmo em
// HTTP, e o browser descartava sem avisar — login respondia 200 e
// caía de volta na tela de login. curl não pega isso (reenvia o
// cookie de qualquer jeito), então a regra vira teste.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.AUTH_SECRET = "segredo-de-teste-com-tamanho-suficiente-para-hs256";

const m = vi.hoisted(() => ({
  set: vi.fn(),
  proto: { valor: null as string | null },
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ set: m.set, get: vi.fn(), delete: vi.fn() }),
  headers: () => ({ get: (h: string) => (h === "x-forwarded-proto" ? m.proto.valor : null) }),
}));

const { createSession } = await import("@/lib/auth");

const sessao = { userId: "u1", email: "dono@loja.com", role: "ADMIN" };
const opcoes = () => m.set.mock.calls[0][2];

beforeEach(() => {
  vi.clearAllMocks();
  m.proto.valor = null;
});

describe("cookie de sessão", () => {
  it("NÃO marca Secure quando o acesso é por HTTP", async () => {
    m.proto.valor = "http";
    await createSession(sessao);
    expect(opcoes().secure).toBe(false);
  });

  it("NÃO marca Secure quando não há proxy informando o protocolo", async () => {
    m.proto.valor = null;
    await createSession(sessao);
    expect(opcoes().secure).toBe(false);
  });

  it("marca Secure quando o acesso é por HTTPS", async () => {
    m.proto.valor = "https";
    await createSession(sessao);
    expect(opcoes().secure).toBe(true);
  });

  it("é httpOnly, sameSite lax e vale para o site inteiro", async () => {
    await createSession(sessao);
    const o = opcoes();
    expect(o.httpOnly).toBe(true);
    expect(o.sameSite).toBe("lax");
    expect(o.path).toBe("/");
    expect(o.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it("grava no cookie de nome legado nerva_session", async () => {
    // Renomear invalida toda sessão ativa — está no CLAUDE.md.
    await createSession(sessao);
    expect(m.set.mock.calls[0][0]).toBe("nerva_session");
  });
});
