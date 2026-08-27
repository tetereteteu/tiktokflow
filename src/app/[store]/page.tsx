// Vitrine pública da loja: /{store}
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PixelLoader } from "@/components/Pixels";
import TrackingCapture from "@/components/TrackingCapture";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: slug } = await params;

  const store = await prisma.store.findFirst({
    where: { slug, active: true },
    include: {
      products: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!store) notFound();

  return (
    <main className="wrap" style={{ paddingBottom: 60 }}>
      <PixelLoader metaPixelId={store.metaPixelId} tiktokPixelId={store.tiktokPixelId} />
      <TrackingCapture />
      <header style={{ padding: "48px 0 32px", textAlign: "center" }}>
        <div className="eyebrow">Loja oficial</div>
        <h1
          className="display"
          style={{ fontSize: "clamp(44px, 8vw, 84px)", marginTop: 10 }}
        >
          {store.name}
        </h1>
        {store.description && (
          <p
            className="muted"
            style={{ maxWidth: 520, margin: "12px auto 0", fontSize: 16 }}
          >
            {store.description}
          </p>
        )}
      </header>

      {store.products.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted">Nenhum produto disponível no momento.</p>
        </div>
      ) : (
        <section
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {store.products.map((p) => (
            <Link
              key={p.id}
              href={`/${store.slug}/checkout/${p.slug}`}
              className="card"
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                padding: 0,
                transition: "border-color 0.15s ease, transform 0.1s ease",
              }}
            >
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: "var(--bg-input)",
                  backgroundImage: p.imageUrl
                    ? `url(${p.imageUrl})`
                    : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{p.title}</h3>
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  {p.compareAtCents && p.compareAtCents > p.priceCents && (
                    <span
                      className="dim"
                      style={{
                        textDecoration: "line-through",
                        fontSize: 13,
                      }}
                    >
                      {brl(p.compareAtCents)}
                    </span>
                  )}
                  <span
                    style={{
                      color: "var(--gold)",
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    {brl(p.priceCents)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      <footer
        style={{
          marginTop: 60,
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-dim)",
        }}
      >
        Pagamento seguro via Pix · Nerva
      </footer>
    </main>
  );
}
