"use client";

// ─────────────────────────────────────────────────────────────
// Construtor de checkout. Coluna de controles à esquerda, preview
// à direita — em <iframe srcDoc>, pra que o CSS do lojista e o
// :root do tema não vazem pro painel.
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { DEFAULT_THEME, previewHtml, type CheckoutThemeData } from "@/lib/checkout-theme";

type StoreOpt = {
  id: string;
  name: string;
  slug: string;
  theme: CheckoutThemeData;
  sampleTitle: string;
  samplePriceCents: number;
  sampleSlug: string | null;
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CheckoutBuilderClient({ stores }: { stores: StoreOpt[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const store = stores.find((s) => s.id === storeId) ?? stores[0];
  const [t, setT] = useState<CheckoutThemeData>(store?.theme ?? DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [device, setDevice] = useState<"desk" | "mob">("desk");

  const set = <K extends keyof CheckoutThemeData>(k: K, v: CheckoutThemeData[K]) => {
    setT((p) => ({ ...p, [k]: v }));
    setMsg("");
  };

  function switchStore(id: string) {
    setStoreId(id);
    setT(stores.find((s) => s.id === id)?.theme ?? DEFAULT_THEME);
    setMsg("");
  }

  const html = useMemo(
    () => previewHtml(t, store?.sampleTitle ?? "Seu produto", brl(store?.samplePriceCents ?? 9700)),
    [t, store],
  );

  async function save() {
    setSaving(true); setMsg("");
    try {
      const res = await fetch(`/api/admin/checkout-theme?storeId=${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
      const data = await res.json();
      if (res.ok) { setT(data.theme); setMsg("Salvo ✓"); }
      else setMsg(data.error || "Erro ao salvar");
    } catch { setMsg("Erro de conexão"); }
    setSaving(false);
  }

  if (!store) {
    return <div className="card"><p className="muted">Crie uma loja primeiro.</p></div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Aparência</div>
          <h1 className="display" style={{ fontSize: 34 }}>Construtor de checkout</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {stores.length > 1 && (
            <select className="input" style={{ width: "auto" }} value={storeId}
              onChange={(e) => switchStore(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button className="btn btn--ghost" style={{ width: "auto", padding: "10px 16px" }}
            onClick={() => { setT({ ...DEFAULT_THEME }); setMsg(""); }}>
            Restaurar padrão
          </button>
          <button className="btn btn--gold" style={{ width: "auto", padding: "10px 22px" }}
            onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {msg && (
        <p style={{ fontSize: 13, marginBottom: 12, color: msg.includes("✓") ? "#43d17f" : "var(--red)" }}>
          {msg}
        </p>
      )}

      <div className="ck-grid">
        {/* ---------------- controles ---------------- */}
        <div style={{ display: "grid", gap: 14 }}>
          <Section title="Identidade visual">
            <Row>
              <Color label="Cor da marca" v={t.brandColor} on={(v) => set("brandColor", v)} />
              <Color label="Fundo" v={t.bgColor} on={(v) => set("bgColor", v)} />
            </Row>
            <Row>
              <Color label="Cartão" v={t.cardColor} on={(v) => set("cardColor", v)} />
              <Color label="Texto" v={t.textColor} on={(v) => set("textColor", v)} />
            </Row>
            <div className="field">
              <label>Arredondamento — {t.radiusPx}px</label>
              <input type="range" min={0} max={32} value={t.radiusPx} style={{ width: "100%", accentColor: "var(--gold)" }}
                onChange={(e) => set("radiusPx", Number(e.target.value))} />
            </div>
            <p className="dim" style={{ fontSize: 11 }}>
              Borda, campo e elevação saem da cor do cartão — clareadas automaticamente.
            </p>
          </Section>

          <Section title="Banner">
            <Text label="URL da imagem (desktop)" v={t.bannerDesktopUrl ?? ""} ph="https://..."
              on={(v) => set("bannerDesktopUrl", v || null)} />
            <Text label="URL da imagem (mobile) — opcional" v={t.bannerMobileUrl ?? ""} ph="cai no desktop se vazio"
              on={(v) => set("bannerMobileUrl", v || null)} />
          </Section>

          <Section title="Barra de avisos"
            toggle={<Toggle v={t.noticeEnabled} on={(v) => set("noticeEnabled", v)} />}>
            {t.noticeEnabled && (
              <>
                <Text label="Texto" v={t.noticeText ?? ""} ph="Frete grátis só hoje"
                  on={(v) => set("noticeText", v || null)} />
                <Row>
                  <Color label="Fundo" v={t.noticeBg} on={(v) => set("noticeBg", v)} />
                  <Color label="Texto" v={t.noticeColor} on={(v) => set("noticeColor", v)} />
                </Row>
              </>
            )}
          </Section>

          <Section title="Cronômetro"
            toggle={<Toggle v={t.countdownEnabled} on={(v) => set("countdownEnabled", v)} />}>
            {t.countdownEnabled && (
              <>
                <Text label="Texto antes do relógio" v={t.countdownText} ph="Oferta reservada por"
                  on={(v) => set("countdownText", v)} />
                <div className="field">
                  <label>Duração — {t.countdownMinutes} min</label>
                  <input type="range" min={1} max={60} value={t.countdownMinutes} style={{ width: "100%", accentColor: "var(--gold)" }}
                    onChange={(e) => set("countdownMinutes", Number(e.target.value))} />
                </div>
                <p className="dim" style={{ fontSize: 11 }}>
                  O prazo fica guardado na sessão: recarregar a página não devolve o tempo cheio.
                </p>
              </>
            )}
          </Section>

          <Section title="Prova social"
            toggle={<Toggle v={t.socialProofEnabled} on={(v) => set("socialProofEnabled", v)} />}>
            {t.socialProofEnabled && (
              <>
                <Text label="Texto" v={t.socialProofText ?? ""} ph="127 pessoas compraram nas últimas 24h"
                  on={(v) => set("socialProofText", v || null)} />
                <Check label="Mostrar avatares" v={t.socialProofAvatars} on={(v) => set("socialProofAvatars", v)} />
              </>
            )}
          </Section>

          <Section title="Textos e selos">
            <Text label="Texto do botão — {valor} vira o total" v={t.ctaText} ph="Pagar {valor}"
              on={(v) => set("ctaText", v)} />
            <Text label="Rodapé — opcional" v={t.footerText ?? ""} ph="CNPJ, contato, política de reembolso"
              on={(v) => set("footerText", v || null)} />
            <Check label="Selos de segurança abaixo do botão" v={t.badgesEnabled} on={(v) => set("badgesEnabled", v)} />
          </Section>

          <Section title="CSS customizado">
            <textarea className="input" rows={6} value={t.customCss ?? ""} spellCheck={false}
              style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, resize: "vertical" }}
              placeholder=".card { border-width: 2px; }"
              onChange={(e) => set("customCss", e.target.value || null)} />
            <p className="dim" style={{ fontSize: 11, marginTop: 6 }}>
              Aplicado por último, sobrescreve o resto. Os caracteres <code>{"<"}</code> e <code>{">"}</code> são
              removidos ao salvar — é por eles que se escaparia da tag de estilo.
            </p>
          </Section>
        </div>

        {/* ---------------- preview ---------------- */}
        <div style={{ position: "sticky", top: 20, alignSelf: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="eyebrow">Preview ao vivo</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["desk", "mob"] as const).map((d) => (
                <button key={d} onClick={() => setDevice(d)}
                  style={{
                    padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                    background: device === d ? "var(--gold-dim)" : "var(--bg-input)",
                    border: `1px solid ${device === d ? "var(--gold)" : "var(--border)"}`,
                    color: device === d ? "var(--gold)" : "var(--text-muted)",
                  }}>
                  {d === "desk" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
          </div>
          <iframe title="Preview do checkout" srcDoc={html}
            style={{
              width: device === "desk" ? "100%" : 390,
              maxWidth: "100%", height: 660, border: "1px solid var(--border)",
              borderRadius: 14, background: t.bgColor, display: "block",
            }} />
          {store.sampleSlug && (
            <a className="btn btn--ghost" style={{ marginTop: 10, fontSize: 13 }}
              href={`/${store.slug}/checkout/${store.sampleSlug}`} target="_blank">
              Abrir o checkout real ↗
            </a>
          )}
        </div>
      </div>

      <style>{`
        .ck-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 22px; }
        @media (max-width: 900px) { .ck-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

// ---- peças do formulário ----

function Section({ title, toggle, children }: {
  title: string; toggle?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="eyebrow">{title}</div>
        {toggle}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}

function Color({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input type="color" value={v} onChange={(e) => on(e.target.value)}
          style={{ width: 42, height: 42, padding: 2, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", cursor: "pointer" }} />
        <input className="input" value={v} onChange={(e) => on(e.target.value)} spellCheck={false}
          style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }} />
      </div>
    </div>
  );
}

function Text({ label, v, ph, on }: { label: string; v: string; ph?: string; on: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={v} placeholder={ph} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

function Check({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 14, marginBottom: 8, cursor: "pointer" }}>
      <input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)}
        style={{ width: 17, height: 17, accentColor: "var(--gold)" }} />
      {label}
    </label>
  );
}

function Toggle({ v, on }: { v: boolean; on: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => on(!v)} aria-pressed={v}
      style={{
        width: 44, height: 24, borderRadius: 999, cursor: "pointer", position: "relative",
        background: v ? "var(--gold)" : "var(--bg-input)",
        border: `1px solid ${v ? "var(--gold)" : "var(--border)"}`, transition: "background .15s",
      }}>
      <span style={{
        position: "absolute", top: 2, left: v ? 22 : 2, width: 18, height: 18, borderRadius: "50%",
        background: v ? "#1a1400" : "var(--text-dim)", transition: "left .15s",
      }} />
    </button>
  );
}
