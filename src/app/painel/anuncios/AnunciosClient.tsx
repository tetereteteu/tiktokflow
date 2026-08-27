"use client";

// ─────────────────────────────────────────────────────────────
// Anúncios: conexão → catálogo → campanha → sincronia de gasto.
// A ordem na tela é a ordem real de dependência, e cada passo só
// libera quando o anterior deu certo — assim o erro aparece onde
// ele nasce, não três telas depois.
// ─────────────────────────────────────────────────────────────

import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = { id: string; title: string; slug: string };
type Campaign = {
  id: string; name: string; status: string; budgetCents: number;
  externalCampaignId: string | null; lastError: string | null; createdAt: string;
};
type StoreOpt = {
  id: string; name: string; slug: string;
  tiktokAdvertiserId: string; tiktokBcId: string; tiktokCatalogId: string;
  hasBusinessToken: boolean; products: Product[]; campaigns: Campaign[];
};
type Region = { location_id?: string | number; name?: string };
type Identity = { identity_id?: string; identity_type?: string; display_name?: string };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AnunciosClient({ stores }: { stores: StoreOpt[] }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const store = stores.find((s) => s.id === storeId) ?? stores[0];

  // conexão
  const [adv, setAdv] = useState(store?.tiktokAdvertiserId ?? "");
  const [bc, setBc] = useState(store?.tiktokBcId ?? "");
  const [token, setToken] = useState("");
  const [conn, setConn] = useState<{ ok: boolean; text: string } | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);

  // campanha
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("50");
  const [productId, setProductId] = useState(store?.products[0]?.id ?? "");
  const [locs, setLocs] = useState<string[]>([]);
  const [identityId, setIdentityId] = useState("");
  const [adText, setAdText] = useState("");

  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function switchStore(id: string) {
    const s = stores.find((x) => x.id === id);
    setStoreId(id);
    setAdv(s?.tiktokAdvertiserId ?? ""); setBc(s?.tiktokBcId ?? "");
    setToken(""); setConn(null); setRegions([]); setIdentities([]);
    setProductId(s?.products[0]?.id ?? ""); setMsg(null);
  }

  const say = (ok: boolean, text: string) => setMsg({ ok, text });

  async function saveConnection() {
    setBusy("save"); setMsg(null);
    try {
      const payload: Record<string, unknown> = { tiktokAdvertiserId: adv, tiktokBcId: bc };
      if (token) payload.tiktokBusinessToken = token;
      const res = await fetch(`/api/admin/stores/${storeId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) { say(true, "Credenciais salvas."); setToken(""); router.refresh(); }
      else say(false, d.error || "Erro ao salvar");
    } catch { say(false, "Erro de conexão"); }
    setBusy("");
  }

  async function testConnection() {
    setBusy("test"); setConn(null); setMsg(null);
    try {
      const res = await fetch(`/api/admin/tiktok/context?storeId=${storeId}`);
      const d = await res.json();
      if (!res.ok) { setConn({ ok: false, text: d.error || "Falhou" }); setBusy(""); return; }
      const a = d.advertiser as { name?: string; currency?: string } | null;
      setConn({ ok: true, text: `Conectado a "${a?.name ?? "conta"}" (${a?.currency ?? "—"})` });
      setRegions((d.regions?.region_info ?? d.regions?.list ?? []) as Region[]);
      setIdentities((d.identities?.identity_list ?? d.identities?.list ?? []) as Identity[]);
    } catch { setConn({ ok: false, text: "Erro de conexão" }); }
    setBusy("");
  }

  async function publishCatalog() {
    setBusy("catalog"); setMsg(null);
    try {
      const res = await fetch(`/api/admin/tiktok/catalog?storeId=${storeId}`, { method: "POST" });
      const d = await res.json();
      if (res.ok) { say(true, `Catálogo publicado e feed registrado: ${d.feedUrl}`); router.refresh(); }
      else say(false, d.error || "Falhou");
    } catch { say(false, "Erro de conexão"); }
    setBusy("");
  }

  async function launch() {
    setBusy("launch"); setMsg(null);
    try {
      const res = await fetch(`/api/admin/tiktok/campaign?storeId=${storeId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: name, dailyBudgetReais: Number(budget), productId,
          locationIds: locs, identityId: identityId || undefined,
          identityType: identityId ? identities.find((i) => i.identity_id === identityId)?.identity_type : undefined,
          adText,
        }),
      });
      const d = await res.json();
      if (res.ok) { say(true, "Campanha criada — nasceu PAUSADA. Ative no Ads Manager quando quiser."); setName(""); router.refresh(); }
      else say(false, d.error || "Falhou");
    } catch { say(false, "Erro de conexão"); }
    setBusy("");
  }

  async function syncSpend() {
    setBusy("sync"); setMsg(null);
    try {
      const res = await fetch(`/api/admin/tiktok/sync?storeId=${storeId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const d = await res.json();
      if (res.ok) say(true, `${d.linhas} dia(s) importados — ${brl(d.gastoTotalCents)} em ${d.periodo}.`);
      else say(false, d.error || "Falhou");
    } catch { say(false, "Erro de conexão"); }
    setBusy("");
  }

  if (!store) return <div className="card"><p className="muted">Crie uma loja primeiro.</p></div>;

  const conectado = store.hasBusinessToken && !!store.tiktokAdvertiserId;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Tráfego pago</div>
          <h1 className="display" style={{ fontSize: 34 }}>Anúncios · TikTok</h1>
        </div>
        {stores.length > 1 && (
          <select className="input" style={{ width: "auto" }} value={storeId} onChange={(e) => switchStore(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {msg && (
        <div className="card" style={{ padding: 12, marginBottom: 14, borderColor: msg.ok ? "#2fb96a" : "var(--red)" }}>
          <p style={{ fontSize: 13, color: msg.ok ? "#43d17f" : "var(--red)" }}>{msg.text}</p>
        </div>
      )}

      {/* 1 — conexão */}
      <Step n={1} title="Conectar a conta de anúncios" done={conectado}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="ID do anunciante"><input className="input" value={adv} onChange={(e) => setAdv(e.target.value)} placeholder="7xxxxxxxxxxxxxxxxx" /></F>
          <F label="ID do Business Center (pro catálogo)"><input className="input" value={bc} onChange={(e) => setBc(e.target.value)} placeholder="7xxxxxxxxxxxxxxxxx" /></F>
        </div>
        <F label={store.hasBusinessToken ? "Token da Marketing API (salvo — deixe em branco pra manter)" : "Token da Marketing API"}>
          <input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder={store.hasBusinessToken ? "••••••••" : "token com escopo de Ads Management"} />
        </F>
        <p className="dim" style={{ fontSize: 11, marginBottom: 12 }}>
          Este token é <b>outro</b>, diferente do da Events API que fica em Lojas — os escopos são distintos.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn--gold" style={{ width: "auto", padding: "10px 20px" }} onClick={saveConnection} disabled={busy === "save"}>
            {busy === "save" ? "Salvando..." : "Salvar credenciais"}
          </button>
          <button className="btn btn--ghost" style={{ width: "auto", padding: "10px 20px" }} onClick={testConnection} disabled={busy === "test" || !conectado}>
            {busy === "test" ? "Testando..." : "Testar conexão"}
          </button>
        </div>
        {conn && (
          <p style={{ marginTop: 10, fontSize: 13, color: conn.ok ? "#43d17f" : "var(--red)" }}>
            {conn.ok ? "✓" : "✕"} {conn.text}
          </p>
        )}
      </Step>

      {/* 2 — catálogo */}
      <Step n={2} title="Publicar o catálogo" done={!!store.tiktokCatalogId}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Cria o catálogo no TikTok e registra o feed que este app já publica em{" "}
          <code style={{ color: "var(--gold)" }}>/catalog/{store.slug}/feed.csv</code>. Sem exportar
          planilha nem subir vídeo: o TikTok busca sozinho, todo dia.
        </p>
        {store.tiktokCatalogId && (
          <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>Catálogo vinculado: {store.tiktokCatalogId}</p>
        )}
        <button className="btn btn--ghost" style={{ width: "auto", padding: "10px 20px" }} onClick={publishCatalog} disabled={busy === "catalog" || !conectado || !bc}>
          {busy === "catalog" ? "Publicando..." : store.tiktokCatalogId ? "Reenviar o feed" : "Criar catálogo e registrar feed"}
        </button>
      </Step>

      {/* 3 — campanha */}
      <Step n={3} title="Criar campanha" done={store.campaigns.some((c) => c.status === "ATIVA")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label="Nome da campanha"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Produto A — frio" /></F>
          <F label="Orçamento diário (R$)"><input className="input" value={budget} inputMode="decimal" onChange={(e) => setBudget(e.target.value)} /></F>
        </div>
        <F label="Produto (define a URL de destino)">
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {store.products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </F>
        <F label="Texto do anúncio">
          <input className="input" value={adText} onChange={(e) => setAdText(e.target.value)} placeholder="deixe em branco pra usar o título do produto" />
        </F>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <F label={`Regiões ${regions.length ? "" : "— teste a conexão pra carregar"}`}>
            <select className="input" multiple size={5} value={locs}
              onChange={(e) => setLocs(Array.from(e.target.selectedOptions).map((o) => o.value))}>
              {regions.map((r) => (
                <option key={String(r.location_id)} value={String(r.location_id)}>{r.name}</option>
              ))}
            </select>
          </F>
          <F label={`Identidade ${identities.length ? "" : "— teste a conexão pra carregar"}`}>
            <select className="input" value={identityId} onChange={(e) => setIdentityId(e.target.value)}>
              <option value="">(padrão da conta)</option>
              {identities.map((i) => (
                <option key={i.identity_id} value={i.identity_id}>{i.display_name || i.identity_id}</option>
              ))}
            </select>
          </F>
        </div>
        <p className="dim" style={{ fontSize: 11, margin: "4px 0 12px" }}>
          A campanha nasce <b>pausada</b>. Nada gasta até você ativar no Ads Manager.
        </p>
        <button className="btn btn--gold" style={{ width: "auto", padding: "10px 22px" }}
          onClick={launch} disabled={busy === "launch" || !conectado || !name || locs.length === 0}>
          {busy === "launch" ? "Subindo..." : "Criar campanha"}
        </button>
      </Step>

      {/* 4 — gasto */}
      <Step n={4} title="Importar o gasto" done={false}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Traz o gasto diário por campanha dos últimos 30 dias. É o que o BI cruza
          com a receita pra mostrar lucro — sem isso, só dá pra ver faturamento.
        </p>
        <button className="btn btn--ghost" style={{ width: "auto", padding: "10px 20px" }} onClick={syncSpend} disabled={busy === "sync" || !conectado}>
          {busy === "sync" ? "Importando..." : "Importar gasto agora"}
        </button>
      </Step>

      {store.campaigns.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Campanhas criadas aqui</div>
          <div style={{ display: "grid", gap: 8 }}>
            {store.campaigns.map((c) => (
              <div key={c.id} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 3 }}>
                    {brl(c.budgetCents)}/dia · {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    {c.externalCampaignId ? ` · id ${c.externalCampaignId}` : ""}
                  </div>
                  {c.lastError && <div style={{ color: "var(--red)", fontSize: 12, marginTop: 5 }}>{c.lastError}</div>}
                </div>
                <span className={`badge badge--${c.status === "ATIVA" ? "paid" : c.status === "ERRO" ? "failed" : "pending"}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n, title, done, children }: {
  n: number; title: string; done: boolean; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
          background: done ? "rgba(47,185,106,0.16)" : "var(--gold-dim)",
          color: done ? "#43d17f" : "var(--gold)",
        }}>{done ? "✓" : n}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
