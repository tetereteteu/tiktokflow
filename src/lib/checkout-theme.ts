// ─────────────────────────────────────────────────────────────
// Construtor de checkout — tema por loja.
//
// A ideia central: em vez de reescrever a tela de checkout, o tema
// sobrescreve as CSS custom properties de globals.css. Como o
// componente inteiro já usa var(--gold), var(--bg-card) etc., mudar
// os tokens repinta tudo — inclusive o que for criado depois.
//
// Segurança: `customCss` é texto escrito pelo dono da loja e vai
// pra uma página PÚBLICA. Sem tratamento, um "</style><script>"
// vira XSS armazenado. cleanCustomCss() corta essa saída, e toda
// cor passa por validação de hex antes de entrar no CSS.
// ─────────────────────────────────────────────────────────────

export interface CheckoutThemeData {
  brandColor: string;
  bgColor: string;
  cardColor: string;
  textColor: string;
  radiusPx: number;
  bannerDesktopUrl: string | null;
  bannerMobileUrl: string | null;
  noticeEnabled: boolean;
  noticeText: string | null;
  noticeBg: string;
  noticeColor: string;
  countdownEnabled: boolean;
  countdownMinutes: number;
  countdownText: string;
  socialProofEnabled: boolean;
  socialProofText: string | null;
  socialProofAvatars: boolean;
  badgesEnabled: boolean;
  ctaText: string;
  footerText: string | null;
  customCss: string | null;
}

export const DEFAULT_THEME: CheckoutThemeData = {
  brandColor: "#d4a012",
  bgColor: "#08080b",
  cardColor: "#14141c",
  textColor: "#f4f4f7",
  radiusPx: 14,
  bannerDesktopUrl: null,
  bannerMobileUrl: null,
  noticeEnabled: false,
  noticeText: null,
  noticeBg: "#d4a012",
  noticeColor: "#08080b",
  countdownEnabled: false,
  countdownMinutes: 15,
  countdownText: "Oferta reservada por",
  socialProofEnabled: false,
  socialProofText: null,
  socialProofAvatars: true,
  badgesEnabled: true,
  ctaText: "Pagar {valor}",
  footerText: null,
  customCss: null,
};

// ---- cor ----

/** Só aceita #rgb ou #rrggbb. Qualquer outra coisa cai no padrão. */
export function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())
    ? v.trim()
    : fallback;
}

function toRgb(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

const rgba = (h: string, a: number) => {
  const [r, g, b] = toRgb(h);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Clareia em direção ao branco — usado pra derivar input/borda do card. */
function lighten(h: string, amount: number): string {
  const [r, g, b] = toRgb(h).map((c) => Math.round(c + (255 - c) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Preto ou branco, o que tiver mais contraste com a cor de fundo. */
export function contrastOn(h: string): string {
  const [r, g, b] = toRgb(h);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#08080b" : "#ffffff";
}

// ---- CSS customizado ----

/**
 * Remove `<` e `>` — nenhum CSS legítimo precisa deles, e é por ali
 * que se escapa da tag <style>. Também limita o tamanho.
 */
export function cleanCustomCss(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[<>]/g, "").slice(0, 20000).trim();
  return s || null;
}

// ---- geração do CSS do tema ----

export function themeCss(t: CheckoutThemeData): string {
  const brand = hex(t.brandColor, DEFAULT_THEME.brandColor);
  const bg = hex(t.bgColor, DEFAULT_THEME.bgColor);
  const card = hex(t.cardColor, DEFAULT_THEME.cardColor);
  const text = hex(t.textColor, DEFAULT_THEME.textColor);
  const radius = Math.max(0, Math.min(40, Number(t.radiusPx) || 0));

  return `
:root {
  --bg: ${bg};
  --bg-elev: ${lighten(card, 0.03)};
  --bg-card: ${card};
  --bg-input: ${lighten(card, 0.06)};
  --border: ${lighten(card, 0.12)};
  --border-strong: ${lighten(card, 0.2)};
  --text: ${text};
  --gold: ${brand};
  --gold-soft: ${lighten(brand, 0.25)};
  --gold-dim: ${rgba(brand, 0.14)};
  --gold-glow: ${rgba(brand, 0.35)};
  --radius: ${radius}px;
  --radius-sm: ${Math.max(0, radius - 4)}px;
  --cta-fg: ${contrastOn(brand)};
}
.btn--gold { color: var(--cta-fg); }
${cleanCustomCss(t.customCss) ?? ""}
`.trim();
}

/**
 * Junta a linha do banco (que pode não existir) com os padrões.
 * Só copia as chaves do tema — id, storeId e datas ficam de fora.
 */
export function resolveTheme(row: Partial<CheckoutThemeData> | null | undefined): CheckoutThemeData {
  if (!row) return { ...DEFAULT_THEME };
  const out = { ...DEFAULT_THEME };
  for (const k of Object.keys(DEFAULT_THEME) as (keyof CheckoutThemeData)[]) {
    const v = row[k];
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Troca {valor} pelo total já formatado. */
export function ctaLabel(t: CheckoutThemeData, valorFormatado: string): string {
  const raw = (t.ctaText || DEFAULT_THEME.ctaText).trim() || DEFAULT_THEME.ctaText;
  return raw.includes("{valor}") ? raw.replace("{valor}", valorFormatado) : raw;
}

// ─────────────────────────────────────────────────────────────
// Preview do construtor.
// Vai num <iframe srcDoc>, e não num <div>, por dois motivos: o
// customCss do lojista não vaza pro painel, e o `:root` do tema não
// briga com os tokens da página do painel. O HTML abaixo replica a
// estrutura e as classes do checkout real.
// ─────────────────────────────────────────────────────────────

const PREVIEW_BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);line-height:1.5;padding:0 0 24px;
  font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:460px;margin:0 auto;padding:0 20px;position:relative;z-index:1}
.glow{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(900px 400px at 50% -120px,var(--gold-dim),transparent 70%)}
.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:600}
.muted{color:var(--text-muted)}.dim{color:var(--text-dim)}
.card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:22px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;
  border-radius:var(--radius-sm);border:1px solid transparent;font:600 15px/1.5 inherit;width:100%;cursor:pointer}
.btn--gold{background:linear-gradient(180deg,var(--gold-soft),var(--gold));
  color:var(--cta-fg);box-shadow:0 6px 20px var(--gold-glow)}
.field{margin-bottom:14px}
.field label{display:block;font-size:13px;color:var(--text-muted);margin-bottom:6px;font-weight:500}
.input{width:100%;padding:12px 14px;background:var(--bg-input);border:1px solid var(--border);
  border-radius:var(--radius-sm);color:var(--text-dim);font-size:15px}
.notice{text-align:center;padding:9px 14px;font-size:13px;font-weight:600}
.banner{width:100%;display:block;border-radius:var(--radius-sm);margin:16px 0 4px}
.timer{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--gold-dim);
  border:1px solid var(--gold);border-radius:var(--radius-sm);padding:10px 14px;margin-top:14px}
.timer b{font-size:18px;color:var(--gold);letter-spacing:1px}
.badges{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:14px;font-size:11px;color:var(--text-dim)}
.badges span{border:1px solid var(--border);border-radius:999px;padding:4px 10px}
.proof{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:13px;color:var(--text-muted)}
.av{display:flex}
.av i{width:26px;height:26px;border-radius:50%;border:2px solid var(--bg-card);display:block}
.av i+i{margin-left:-9px}
.prod{display:flex;gap:14px;align-items:center;padding:16px;margin-top:16px}
.thumb{width:60px;height:60px;border-radius:10px;background:var(--bg-input);flex-shrink:0}
.price{color:var(--gold);font-size:18px;font-weight:700}
.foot{text-align:center;font-size:11px;color:var(--text-dim);margin-top:22px;line-height:1.6}
`;

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function previewHtml(t: CheckoutThemeData, productTitle = "Seu produto", priceLabel = "R$ 97,00"): string {
  const banner = t.bannerDesktopUrl?.trim();
  const mm = String(Math.max(1, Number(t.countdownMinutes) || 15)).padStart(2, "0");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${PREVIEW_BASE_CSS}</style><style>${themeCss(t)}</style></head>
<body><div class="glow"></div>
${t.noticeEnabled && t.noticeText
  ? `<div class="notice" style="background:${hex(t.noticeBg, "#d4a012")};color:${hex(t.noticeColor, contrastOn(hex(t.noticeBg, "#d4a012")))}">${esc(t.noticeText)}</div>`
  : ""}
<div class="wrap">
${banner ? `<img class="banner" src="${esc(banner)}" alt="">` : ""}
<div class="dim" style="display:inline-block;padding:20px 0 8px;font-size:13px">← Sua loja</div>
<div class="card prod"><div class="thumb"></div>
  <div><div style="font-size:15px;font-weight:600">${esc(productTitle)}</div>
  <div class="price" style="margin-top:4px">${esc(priceLabel)}</div></div></div>
${t.countdownEnabled ? `<div class="timer"><span style="font-size:13px;color:var(--text-muted)">${esc(t.countdownText || "")}</span><b>${mm}:00</b></div>` : ""}
<div class="card" style="margin-top:16px">
  <div class="eyebrow" style="margin-bottom:14px">Seus dados</div>
  <div class="field"><label>Nome completo</label><div class="input">Como no comprovante</div></div>
  <div class="field"><label>CPF *</label><div class="input">000.000.000-00</div></div>
  <button class="btn btn--gold">${esc(ctaLabel(t, priceLabel))}</button>
  ${t.badgesEnabled ? `<div class="badges"><span>🔒 Conexão segura</span><span>⚡ Aprovação na hora</span><span>🇧🇷 Pix Banco Central</span></div>` : ""}
  ${t.socialProofEnabled && t.socialProofText
    ? `<div class="proof">${t.socialProofAvatars ? `<div class="av"><i style="background:hsl(20 45% 38%)"></i><i style="background:hsl(87 45% 43%)"></i><i style="background:hsl(154 45% 48%)"></i><i style="background:hsl(221 45% 53%)"></i></div>` : ""}<span>${esc(t.socialProofText)}</span></div>`
    : ""}
</div>
${t.footerText ? `<p class="foot">${esc(t.footerText)}</p>` : ""}
</div></body></html>`;
}
