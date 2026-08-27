// ─────────────────────────────────────────────────────────────
// Tracking de marketing.
// Captura no browser: UTMs (query), click IDs (fbclid/ttclid/gclid),
// e cookies do pixel (_fbp/_fbc). Esses dados vão para:
//   1. os pixels do browser (evento client-side)
//   2. o objeto `tracking` do POST /sales da Nerva (server-side / CAPI)
// A combinação client + server com o mesmo eventId = deduplicação.
// ─────────────────────────────────────────────────────────────

export interface TrackingData {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
  fbp?: string;
  fbc?: string;
  eventId?: string;
}

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : undefined;
}

// Lê tudo que dá do navegador. Guarda os click IDs no localStorage
// porque o usuário pode navegar antes de comprar (a query some).
export function collectTracking(): TrackingData {
  if (typeof window === "undefined") return {};

  const url = new URL(window.location.href);
  const q = url.searchParams;

  const persist = (key: string, val?: string | null) => {
    if (val) {
      try {
        localStorage.setItem(`trk_${key}`, val);
      } catch {}
      return val;
    }
    try {
      return localStorage.getItem(`trk_${key}`) || undefined;
    } catch {
      return undefined;
    }
  };

  // _fbc: se veio fbclid na URL e o cookie ainda não existe, monta no padrão do FB
  let fbc = getCookie("_fbc");
  const fbclid = persist("fbclid", q.get("fbclid"));
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
  }

  return {
    utmSource: persist("utm_source", q.get("utm_source")),
    utmMedium: persist("utm_medium", q.get("utm_medium")),
    utmCampaign: persist("utm_campaign", q.get("utm_campaign")),
    utmContent: persist("utm_content", q.get("utm_content")),
    utmTerm: persist("utm_term", q.get("utm_term")),
    fbclid,
    ttclid: persist("ttclid", q.get("ttclid")),
    gclid: persist("gclid", q.get("gclid")),
    fbp: getCookie("_fbp"),
    fbc,
  };
}

// Gera um eventId estável pra deduplicar pixel (browser) x CAPI (server).
export function makeEventId(orderId: string): string {
  return `purchase_${orderId}`;
}
