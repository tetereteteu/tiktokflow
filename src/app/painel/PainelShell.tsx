// ─────────────────────────────────────────────────────────────
// Shell do painel: barra lateral esquerda + área de conteúdo.
//
// A lista de módulos vive aqui, em GRUPOS, e é a fonte única da
// navegação — módulo novo entra adicionando uma linha, não
// mexendo em layout.
//
// `tag` marca o estado do módulo na lateral. Sem tag = pronto.
// "em breve" = a tela existe e especifica o que vai fazer, mas não
// tem funcionalidade. "leitura" = mostra dado real, porém só
// consulta; a edição ainda mora em outra tela. Implementou? apague
// a tag do item.
//
// É Client Component só por causa do usePathname (destaque do
// item ativo). O conteúdo continua sendo Server Component —
// chega por children, já renderizado no servidor.
// ─────────────────────────────────────────────────────────────

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import LogoutButton from "./LogoutButton";

type Item = { href: string; label: string; tag?: string };
type Grupo = { titulo: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Visão geral",
    itens: [
      { href: "/painel", label: "Pedidos" },
      { href: "/painel/bi", label: "Command Center" },
    ],
  },
  {
    titulo: "Vitrine",
    itens: [
      { href: "/painel/lojas", label: "Lojas" },
      { href: "/painel/produtos", label: "Produtos" },
      { href: "/painel/colecoes", label: "Coleções" },
      { href: "/painel/dominios", label: "Domínios", tag: "leitura" },
    ],
  },
  {
    titulo: "Checkout",
    itens: [
      { href: "/painel/checkout", label: "Construtor" },
      { href: "/painel/pagamentos", label: "Pagamentos", tag: "em breve" },
      { href: "/painel/gateways", label: "Gateways" },
      { href: "/painel/redirecionamento", label: "Redirecionamento" },
    ],
  },
  {
    titulo: "Marketing",
    itens: [
      { href: "/painel/ofertas", label: "Ofertas" },
      { href: "/painel/recuperacao", label: "Recuperação" },
      { href: "/painel/pixels", label: "Pixels", tag: "leitura" },
      { href: "/painel/recompensas", label: "Recompensas", tag: "em breve" },
      { href: "/painel/telegram", label: "Telegram", tag: "em breve" },
    ],
  },
  {
    titulo: "Logística",
    itens: [
      { href: "/painel/fretes", label: "Fretes", tag: "em breve" },
      { href: "/painel/rastreios", label: "Rastreios", tag: "em breve" },
    ],
  },
  {
    titulo: "Anúncios",
    itens: [
      { href: "/painel/anuncios", label: "TikTok Ads" },
      { href: "/painel/catalogo", label: "Catálogo" },
      { href: "/painel/contas", label: "Contas em massa" },
      { href: "/painel/meta-ads", label: "Meta Ads", tag: "em breve" },
    ],
  },
];

export default function PainelShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const path = usePathname();

  // "/painel" é prefixo de todo o resto, então casa exato;
  // os demais casam por prefixo pra sub-rota manter o item aceso.
  const estaAtivo = (href: string) =>
    href === "/painel" ? path === "/painel" : path.startsWith(href);

  return (
    <div className="painel-shell">
      <aside className="painel-side">
        <Link
          href="/painel"
          className="display"
          style={{
            display: "block",
            padding: "0 14px 4px",
            fontSize: 27,
            color: "var(--gold)",
            lineHeight: 1.1,
          }}
        >
          TIKTOKFLOW
        </Link>

        {GRUPOS.map((g) => (
          <div key={g.titulo}>
            <div className="nav-grupo">{g.titulo}</div>
            {g.itens.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={`nav-item${estaAtivo(it.href) ? " nav-item--ativo" : ""}`}
              >
                <span>{it.label}</span>
                {it.tag && <span className="nav-tag">{it.tag}</span>}
              </Link>
            ))}
          </div>
        ))}

        <div
          style={{
            margin: "24px 14px 0",
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 9,
            alignItems: "flex-start",
          }}
        >
          <span
            className="dim"
            style={{ fontSize: 12, wordBreak: "break-all", lineHeight: 1.4 }}
          >
            {email}
          </span>
          <LogoutButton />
        </div>
      </aside>

      <main className="painel-main">{children}</main>
    </div>
  );
}
