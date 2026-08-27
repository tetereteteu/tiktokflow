"use client";

// ─────────────────────────────────────────────────────────────
// Peças visuais do checkout controladas pelo Construtor.
// Cada uma se apaga sozinha quando está desligada no painel, então
// dá pra soltar todas na tela sem condicional no componente pai.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import type { CheckoutThemeData } from "@/lib/checkout-theme";
import { hex, contrastOn } from "@/lib/checkout-theme";

export function NoticeBar({ t }: { t: CheckoutThemeData }) {
  if (!t.noticeEnabled || !t.noticeText) return null;
  const bg = hex(t.noticeBg, "#d4a012");
  return (
    <div style={{
      background: bg, color: hex(t.noticeColor, contrastOn(bg)),
      textAlign: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600,
      letterSpacing: 0.2,
    }}>
      {t.noticeText}
    </div>
  );
}

export function Banner({ t }: { t: CheckoutThemeData }) {
  const desk = t.bannerDesktopUrl?.trim();
  const mob = t.bannerMobileUrl?.trim() || desk;
  if (!desk && !mob) return null;
  return (
    <>
      {desk && <img className="ck-banner ck-banner--desk" src={desk} alt="" />}
      {mob && <img className="ck-banner ck-banner--mob" src={mob} alt="" />}
      <style>{`
        .ck-banner { width: 100%; display: block; border-radius: var(--radius-sm); margin-bottom: 4px; }
        .ck-banner--mob { display: none; }
        @media (max-width: 560px) {
          .ck-banner--desk { display: none; }
          .ck-banner--mob { display: block; }
        }
      `}</style>
    </>
  );
}

// Cronômetro de escassez. O início fica em sessionStorage pra
// recarregar a página não devolver o tempo cheio — que é o que
// tira a credibilidade do recurso.
export function Countdown({ t, storageKey }: { t: CheckoutThemeData; storageKey: string }) {
  const total = Math.max(1, Number(t.countdownMinutes) || 15) * 60;
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!t.countdownEnabled) return;
    const k = `ck_deadline_${storageKey}`;
    let deadline: number;
    try {
      const saved = Number(sessionStorage.getItem(k));
      deadline = saved && saved > Date.now() ? saved : Date.now() + total * 1000;
      sessionStorage.setItem(k, String(deadline));
    } catch {
      deadline = Date.now() + total * 1000;
    }
    const tick = () => setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [t.countdownEnabled, total, storageKey]);

  if (!t.countdownEnabled || left === null) return null;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      background: "var(--gold-dim)", border: "1px solid var(--gold)",
      borderRadius: "var(--radius-sm)", padding: "10px 14px", marginTop: 14,
    }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.countdownText}</span>
      <span style={{
        fontSize: 18, fontWeight: 800, color: "var(--gold)",
        fontVariantNumeric: "tabular-nums", letterSpacing: 1,
      }}>{mm}:{ss}</span>
    </div>
  );
}

export function SocialProof({ t }: { t: CheckoutThemeData }) {
  if (!t.socialProofEnabled || !t.socialProofText) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginTop: 14, fontSize: 13, color: "var(--text-muted)",
    }}>
      {t.socialProofAvatars && (
        <div style={{ display: "flex" }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{
              width: 26, height: 26, borderRadius: "50%",
              background: `hsl(${i * 67 + 20} 45% ${38 + i * 5}%)`,
              border: "2px solid var(--bg-card)", marginLeft: i ? -9 : 0,
            }} />
          ))}
        </div>
      )}
      <span>{t.socialProofText}</span>
    </div>
  );
}

export function SecurityBadges({ t }: { t: CheckoutThemeData }) {
  if (!t.badgesEnabled) return null;
  const items = ["🔒 Conexão segura", "⚡ Aprovação na hora", "🇧🇷 Pix Banco Central"];
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center",
      marginTop: 14, fontSize: 11, color: "var(--text-dim)",
    }}>
      {items.map((i) => (
        <span key={i} style={{
          border: "1px solid var(--border)", borderRadius: 999, padding: "4px 10px",
        }}>{i}</span>
      ))}
    </div>
  );
}

export function FooterNote({ t }: { t: CheckoutThemeData }) {
  if (!t.footerText) return null;
  return (
    <p style={{
      textAlign: "center", fontSize: 11, color: "var(--text-dim)",
      marginTop: 22, lineHeight: 1.6,
    }}>{t.footerText}</p>
  );
}
