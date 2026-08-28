// ─────────────────────────────────────────────────────────────
// Domínio próprio -> vitrine da loja.
//
// Um domínio cadastrado em Store.domain passa a servir a vitrine
// daquela loja na raiz: minhaloja.com/ mostra o que /{slug} mostra,
// e minhaloja.com/checkout/x cai em /{slug}/checkout/x.
//
// O middleware roda no edge, onde o Prisma não existe, então a
// resolução vai por /api/dominios/resolver. O cache abaixo é o que
// evita uma chamada por requisição: como o app roda em processo
// único (next start sob pm2), o Map é compartilhado de verdade.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

const TTL_MS = 60_000;
const TTL_ERRO_MS = 5_000; // falha não fica presa por um minuto
const cache = new Map<string, { slug: string | null; ate: number }>();

// Rotas que nunca são reescritas: painel, API e o feed já carregam o
// slug da loja explicitamente na própria URL.
const IGNORAR = ["/api", "/_next", "/painel", "/catalog", "/favicon.ico"];

function hostLimpo(req: NextRequest): string {
  return (req.headers.get("host") ?? "")
    .toLowerCase()
    .split(":")[0]
    .replace(/^www\./, "");
}

function hostPrincipal(): string {
  return (process.env.APP_BASE_URL ?? "")
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^www\./, "")
    .toLowerCase();
}

async function resolver(req: NextRequest, host: string): Promise<string | null> {
  const agora = Date.now();
  const guardado = cache.get(host);
  if (guardado && guardado.ate > agora) return guardado.slug;

  try {
    const url = new URL(
      `/api/dominios/resolver?host=${encodeURIComponent(host)}`,
      req.nextUrl.origin,
    );
    const res = await fetch(url);
    const slug = res.ok ? ((await res.json()).slug as string | null) : null;
    cache.set(host, { slug, ate: agora + TTL_MS });
    return slug;
  } catch {
    cache.set(host, { slug: null, ate: agora + TTL_ERRO_MS });
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (IGNORAR.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const host = hostLimpo(req);
  if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return NextResponse.next();
  }

  const principal = hostPrincipal();
  if (principal && host === principal) return NextResponse.next();

  const slug = await resolver(req, host);
  if (!slug) return NextResponse.next();

  // A vitrine monta links absolutos com o slug (/{slug}/checkout/x).
  // Sem esta guarda, clicar num produto no domínio próprio viraria
  // /{slug}/{slug}/checkout/x e daria 404.
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
