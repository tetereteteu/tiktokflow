"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { collectTracking } from "@/lib/tracking";
import { montarUrlDestino } from "@/lib/redirecionamento";
import {
  PixelLoader,
  trackInitiateCheckout,
  trackPurchase,
} from "@/components/Pixels";
import type { CheckoutThemeData } from "@/lib/checkout-theme";
import { themeCss, ctaLabel } from "@/lib/checkout-theme";
import {
  NoticeBar, Banner, Countdown, SocialProof, SecurityBadges, FooterNote,
} from "@/components/CheckoutChrome";

type Product = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
};
type Bump = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
} | null;
type Upsell = {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
} | null;

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function maskCpf(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

type Stage = "form" | "pix" | "paid";

export default function CheckoutClient({
  theme,
  storeName,
  storeSlug,
  metaPixelId,
  tiktokPixelId,
  product,
  bump,
  upsell,
  redirectUrl,
  redirectSkipUpsell,
}: {
  theme: CheckoutThemeData;
  storeName: string;
  storeSlug: string;
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
  product: Product;
  bump: Bump;
  upsell: Upsell;
  redirectUrl: string | null;
  redirectSkipUpsell: boolean;
}) {
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [bumpOn, setBumpOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [orderId, setOrderId] = useState("");
  const [pixCode, setPixCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const firedIC = useRef(false);

  // ---- estado do upsell pós-compra ----
  // 'offer' = mostrando a oferta | 'pix' = pagando o upsell | 'done' = finalizado
  const [upsellStage, setUpsellStage] = useState<"offer" | "pix" | "done">("offer");
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellOrderId, setUpsellOrderId] = useState("");
  const [upsellPix, setUpsellPix] = useState("");
  const [upsellQr, setUpsellQr] = useState("");
  const [upsellCopied, setUpsellCopied] = useState(false);
  const [redirecionando, setRedirecionando] = useState(false);

  const total = product.priceCents + (bumpOn && bump ? bump.priceCents : 0);

  // dispara InitiateCheckout uma vez ao montar
  useEffect(() => {
    if (!firedIC.current) {
      firedIC.current = true;
      trackInitiateCheckout(product.priceCents / 100);
    }
  }, [product.priceCents]);

  async function handleSubmit() {
    setError("");
    if (document.replace(/\D/g, "").length !== 11) {
      setError("Informe um CPF válido.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          bumpId: bumpOn && bump ? bump.id : undefined,
          name, email, document, phone,
          tracking: collectTracking(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível gerar o Pix.");
        setLoading(false);
        return;
      }
      setOrderId(data.orderId);
      setPixCode(data.pixCode);
      (window as any).__eventId = data.eventId;
      const dataUrl = await QRCode.toDataURL(data.pixCode, {
        width: 260, margin: 1, color: { dark: "#08080b", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setStage("pix");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (stage !== "pix" || !orderId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/status`);
        const data = await res.json();
        if (data.status === "PAID") {
          trackPurchase(total / 100, (window as any).__eventId || `purchase_${orderId}`);
          setStage("paid");
        } else if (["FAILED", "EXPIRED"].includes(data.status)) {
          setError("Este Pix expirou ou falhou. Gere um novo.");
          setStage("form");
        }
      } catch {}
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [stage, orderId, total]);

  async function copyPix() {
    await navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // aceitar o upsell: gera novo Pix reusando os dados do cliente
  async function acceptUpsell() {
    if (!upsell || !orderId) return;
    setUpsellLoading(true);
    try {
      const res = await fetch("/api/upsell/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalOrderId: orderId, upsellId: upsell.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpsellLoading(false);
        return;
      }
      setUpsellOrderId(data.orderId);
      setUpsellPix(data.pixCode);
      (window as any).__upsellEventId = data.eventId;
      const dataUrl = await QRCode.toDataURL(data.pixCode, {
        width: 240, margin: 1, color: { dark: "#08080b", light: "#ffffff" },
      });
      setUpsellQr(dataUrl);
      setUpsellStage("pix");
    } catch {
      setUpsellLoading(false);
    }
  }

  async function copyUpsellPix() {
    await navigator.clipboard.writeText(upsellPix);
    setUpsellCopied(true);
    setTimeout(() => setUpsellCopied(false), 2000);
  }

  // polling do pagamento do upsell
  const upPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (upsellStage !== "pix" || !upsellOrderId) return;
    upPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${upsellOrderId}/status`);
        const data = await res.json();
        if (data.status === "PAID") {
          if (upsell) trackPurchase(upsell.priceCents / 100, (window as any).__upsellEventId || `purchase_${upsellOrderId}`);
          setUpsellStage("done");
        }
      } catch {}
    }, 4000);
    return () => { if (upPollRef.current) clearInterval(upPollRef.current); };
  }, [upsellStage, upsellOrderId, upsell]);

  // ---- destino pós-pagamento ----
  // Só sai depois que o fluxo acabou: com upsell ativo, espera ele
  // terminar; sem upsell (ou com o pulo ligado), vai direto.
  //
  // O atraso de 1,2s não é estética: navegar na hora mata a
  // requisição do pixel de Purchase, que acabou de ser disparada, e a
  // venda some da atribuição.
  useEffect(() => {
    if (!redirectUrl || redirecionando) return;

    const fluxoTerminou =
      stage === "paid" && (redirectSkipUpsell || !upsell || upsellStage === "done");
    if (!fluxoTerminou) return;

    const t = collectTracking();
    const destino = montarUrlDestino(redirectUrl, {
      order: orderId,
      utm_source: t.utmSource,
      utm_medium: t.utmMedium,
      utm_campaign: t.utmCampaign,
      utm_content: t.utmContent,
      utm_term: t.utmTerm,
      fbclid: t.fbclid,
      ttclid: t.ttclid,
      gclid: t.gclid,
    });
    if (!destino) return; // URL inválida ou protocolo barrado: fica na tela

    setRedirecionando(true);
    const timer = setTimeout(() => {
      window.location.href = destino;
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    stage, upsellStage, upsell, orderId,
    redirectUrl, redirectSkipUpsell, redirecionando,
  ]);

  return (
    <>
      {/* O tema sobrescreve os tokens de globals.css — repinta a tela toda. */}
      <style>{themeCss(theme)}</style>
      <NoticeBar t={theme} />
    <main className="wrap" style={{ maxWidth: 460, paddingBottom: 60 }}>
      <PixelLoader metaPixelId={metaPixelId} tiktokPixelId={tiktokPixelId} />
      <div style={{ paddingTop: 16 }}><Banner t={theme} /></div>

      <a href={`/${storeSlug}`} className="dim"
        style={{ display: "inline-block", padding: "24px 0 8px", fontSize: 13 }}>
        ← {storeName}
      </a>

      <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", padding: 16 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 10, flexShrink: 0, background: "var(--bg-input)",
          backgroundImage: product.imageUrl ? `url(${product.imageUrl})` : undefined,
          backgroundSize: "cover", backgroundPosition: "center",
        }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>{product.title}</h2>
          <div style={{ marginTop: 4 }}>
            <span style={{ color: "var(--gold)", fontSize: 18, fontWeight: 700 }}>
              {brl(product.priceCents)}
            </span>
          </div>
        </div>
      </div>

      {stage === "form" && <Countdown t={theme} storageKey={product.id} />}

      {stage === "form" && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Seus dados</div>
          <div className="field">
            <label>Nome completo</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como no comprovante" />
          </div>
          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <div className="field">
            <label>CPF *</label>
            <input className="input" value={document} onChange={(e) => setDocument(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
          </div>
          <div className="field">
            <label>Telefone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" />
          </div>

          {bump && (
            <label style={{
              display: "flex", gap: 12, alignItems: "center", cursor: "pointer",
              background: bumpOn ? "var(--gold-dim)" : "var(--bg-input)",
              border: `1px solid ${bumpOn ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 10, padding: 12, margin: "6px 0 16px", transition: "all .15s",
            }}>
              <input type="checkbox" checked={bumpOn} onChange={(e) => setBumpOn(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--gold)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{bump.title}</div>
                {bump.description && <div className="dim" style={{ fontSize: 12 }}>{bump.description}</div>}
              </div>
              <div style={{ color: "var(--gold)", fontWeight: 700, fontSize: 14 }}>
                +{brl(bump.priceCents)}
              </div>
            </label>
          )}

          {error && <p style={{ color: "var(--red)", fontSize: 13, margin: "4px 0 12px" }}>{error}</p>}

          <button className="btn btn--gold" onClick={handleSubmit} disabled={loading}>
            {loading ? "Gerando Pix..." : ctaLabel(theme, brl(total))}
          </button>
          <SecurityBadges t={theme} />
          <SocialProof t={theme} />
        </div>
      )}

      {stage === "pix" && (
        <div className="card" style={{ marginTop: 16, textAlign: "center" }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Escaneie para pagar</div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Abra o app do seu banco e leia o QR, ou use o copia-e-cola.
          </p>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR Code Pix"
              style={{ width: 220, height: 220, borderRadius: 12, background: "#fff", padding: 8, margin: "0 auto" }} />
          )}
          <div style={{
            marginTop: 16, background: "var(--bg-input)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 12, fontSize: 12, wordBreak: "break-all",
            color: "var(--text-muted)", maxHeight: 72, overflow: "auto",
          }}>{pixCode}</div>
          <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={copyPix}>
            {copied ? "Copiado ✓" : "Copiar código Pix"}
          </button>
          <div style={{
            marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, color: "var(--amber)", fontSize: 13,
          }}>
            <span className="pulse-dot" /> Aguardando pagamento...
          </div>
        </div>
      )}

      {/* ETAPA 3 — PAGO + UPSELL PÓS-COMPRA */}
      {stage === "paid" && (
        <>
          {/* confirmação da compra principal */}
          <div className="card" style={{ marginTop: 16, textAlign: "center", padding: "28px 22px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "rgba(47,185,106,0.15)",
              color: "#43d17f", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, margin: "0 auto 12px",
            }}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Pagamento confirmado</h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              Recebemos seu Pix. Obrigado pela compra!
            </p>
          </div>

          {/* oferta de upsell */}
          {upsell && upsellStage === "offer" && (
            <div className="card" style={{ marginTop: 14, border: "1px solid var(--gold)", boxShadow: "0 0 0 3px var(--gold-dim)" }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Oferta exclusiva · só agora</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                {upsell.imageUrl && (
                  <div style={{
                    width: 72, height: 72, borderRadius: 10, flexShrink: 0,
                    backgroundImage: `url(${upsell.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center",
                  }} />
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>{upsell.title}</h3>
                  {upsell.description && (
                    <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{upsell.description}</p>
                  )}
                  <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
                    {upsell.compareAtCents && upsell.compareAtCents > upsell.priceCents && (
                      <span className="dim" style={{ textDecoration: "line-through", fontSize: 13 }}>
                        {brl(upsell.compareAtCents)}
                      </span>
                    )}
                    <span style={{ color: "var(--gold)", fontSize: 22, fontWeight: 800 }}>
                      {brl(upsell.priceCents)}
                    </span>
                  </div>
                </div>
              </div>
              <button className="btn btn--gold" style={{ marginTop: 16 }}
                onClick={acceptUpsell} disabled={upsellLoading}>
                {upsellLoading ? "Gerando Pix..." : `Sim, quero adicionar por ${brl(upsell.priceCents)}`}
              </button>
              <button className="btn btn--ghost" style={{ marginTop: 8 }}
                onClick={() => setUpsellStage("done")}>
                Não, obrigado
              </button>
            </div>
          )}

          {/* Pix do upsell */}
          {upsell && upsellStage === "pix" && (
            <div className="card" style={{ marginTop: 14, textAlign: "center" }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Pague pra adicionar</div>
              <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                {upsell.title} — {brl(upsell.priceCents)}
              </p>
              {upsellQr && (
                <img src={upsellQr} alt="QR do upsell"
                  style={{ width: 200, height: 200, borderRadius: 12, background: "#fff", padding: 8, margin: "0 auto" }} />
              )}
              <div style={{
                marginTop: 14, background: "var(--bg-input)", border: "1px solid var(--border)",
                borderRadius: 10, padding: 12, fontSize: 12, wordBreak: "break-all",
                color: "var(--text-muted)", maxHeight: 66, overflow: "auto",
              }}>{upsellPix}</div>
              <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={copyUpsellPix}>
                {upsellCopied ? "Copiado ✓" : "Copiar código Pix"}
              </button>
              <div style={{
                marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, color: "var(--amber)", fontSize: 13,
              }}>
                <span className="pulse-dot" /> Aguardando pagamento...
              </div>
            </div>
          )}

          {/* upsell finalizado (aceito e pago, ou recusado) */}
          {upsell && upsellStage === "done" && (
            <div className="card" style={{ marginTop: 14, textAlign: "center", padding: "20px" }}>
              <p className="muted" style={{ fontSize: 14 }}>Tudo certo. Pode fechar esta página.</p>
            </div>
          )}
        </>
      )}

      <FooterNote t={theme} />

      <style>{`
        .pulse-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--amber);
          display: inline-block; animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); } }
      `}</style>
    </main>
    </>
  );
}
