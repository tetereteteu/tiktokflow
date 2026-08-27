import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function PainelNav({ email }: { email: string }) {
  const items = [
    { href: "/painel", label: "Pedidos" },
    { href: "/painel/lojas", label: "Lojas" },
    { href: "/painel/produtos", label: "Produtos" },
    { href: "/painel/ofertas", label: "Ofertas" },
    { href: "/painel/checkout", label: "Checkout" },
    { href: "/painel/catalogo", label: "Catálogo" },
    { href: "/painel/recuperacao", label: "Recuperação" },
  ];
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 0 18px",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Link href="/painel" className="display" style={{ fontSize: 30, color: "var(--gold)" }}>
          TIKTOKFLOW
        </Link>
        <nav style={{ display: "flex", gap: 6 }}>
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              style={{
                padding: "7px 13px",
                borderRadius: 8,
                fontSize: 14,
                color: "var(--text-muted)",
                fontWeight: 500,
              }}
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="dim" style={{ fontSize: 13 }}>{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
