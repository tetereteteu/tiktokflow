"use client";

import { useState } from "react";

type Store = {
  id: string; name: string; slug: string;
  hasTiktokPixel: boolean; hasMetaPixel: boolean; products: number;
};

export default function CatalogoClient({ stores }: { stores: Store[] }) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://seudominio.com";

  return (
    <div>
      <div className="eyebrow">Anúncios</div>
      <h1 className="display" style={{ fontSize: 34 }}>Catálogo & TikTok</h1>
      <p className="muted" style={{ fontSize: 14, margin: "8px 0 22px", maxWidth: 640 }}>
        Cada loja gera um feed de catálogo com todos os produtos ativos. É esse link que você
        cola no <strong>TikTok Catalog Manager</strong> (e serve também pra Meta e Google) pra
        rodar Video Shopping Ads / anúncios de catálogo.
      </p>

      {stores.length === 0 ? (
        <div className="card"><p className="muted">Crie uma loja primeiro.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {stores.map((s) => (
            <FeedCard key={s.id} store={s} feedUrl={`${base}/catalog/${s.slug}/feed.csv`} />
          ))}
        </div>
      )}

      <Guide />
    </div>
  );
}

function FeedCard({ store, feedUrl }: { store: Store; feedUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{store.name}</h3>
          <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{store.products} produtos ativos no feed</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StatusTag ok={store.hasTiktokPixel} label="TikTok Pixel" />
          <StatusTag ok={store.hasMetaPixel} label="Meta Pixel" />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <code style={{
          flex: 1, minWidth: 220, background: "var(--bg-input)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--gold)", wordBreak: "break-all",
        }}>{feedUrl}</code>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "9px 14px", fontSize: 13 }}
          onClick={() => { navigator.clipboard.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
          {copied ? "Copiado ✓" : "Copiar link"}
        </button>
        <a className="btn btn--ghost" style={{ width: "auto", padding: "9px 14px", fontSize: 13 }}
          href={feedUrl} target="_blank">Ver feed</a>
      </div>
      {!store.hasTiktokPixel && (
        <p style={{ color: "var(--amber)", fontSize: 12.5, marginTop: 10 }}>
          ⚠ Sem TikTok Pixel configurado. Adicione o Pixel ID em Lojas → editar, pra medir conversões.
        </p>
      )}
    </div>
  );
}

function StatusTag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      fontSize: 11, padding: "3px 9px", borderRadius: 6,
      background: ok ? "rgba(47,185,106,0.14)" : "var(--bg-input)",
      color: ok ? "#43d17f" : "var(--text-dim)",
      border: `1px solid ${ok ? "transparent" : "var(--border)"}`,
    }}>{ok ? "✓" : "○"} {label}</span>
  );
}

function Guide() {
  const steps = [
    ["Conecte o feed no TikTok", "No TikTok Ads Manager → Assets → Catalog → crie um catálogo e escolha “Data feed / URL agendada”. Cole o link do feed da loja e defina a frequência de atualização (ex: a cada 4h)."],
    ["Confirme o Pixel", "Em Lojas → editar, preencha o TikTok Pixel ID. O checkout já dispara PageView, InitiateCheckout e CompletePayment; o server-side (Events API) vem pela Nerva quando a venda é paga."],
    ["Crie a campanha", "No TikTok Ads Manager → Criar → objetivo Vendas → origem do produto: Catálogo. Selecione o catálogo conectado e rode Video Shopping Ads / DSA. Os criativos podem vir do próprio feed."],
    ["Meça e escale", "As vendas pagas aparecem no painel de Pedidos com o UTM/campanha de origem. Use isso pra desligar o que não converte e escalar o que dá ROAS."],
  ];
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Como promover no TikTok</div>
      <ol style={{ listStyle: "none", counterReset: "step", display: "grid", gap: 14, padding: 0 }}>
        {steps.map(([title, body], i) => (
          <li key={i} style={{ display: "flex", gap: 14 }}>
            <span style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: "var(--gold-dim)",
              color: "var(--gold)", fontWeight: 800, display: "grid", placeItems: "center", fontSize: 14,
            }}>{i + 1}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{body}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
