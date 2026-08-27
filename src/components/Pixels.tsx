"use client";

import { useEffect } from "react";

// Injeta os pixels (Meta + TikTok) e expõe funções de disparo de evento.
// Client-side + o server-side da Nerva usam o MESMO eventId → dedup.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, params?: unknown, opts?: unknown) => void;
      page: () => void;
      load: (id: string) => void;
      [k: string]: unknown;
    };
    _fbLoaded?: boolean;
    _ttLoaded?: boolean;
  }
}

export function PixelLoader({
  metaPixelId,
  tiktokPixelId,
}: {
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
}) {
  useEffect(() => {
    // ---- Meta Pixel ----
    if (metaPixelId && !window._fbLoaded) {
      window._fbLoaded = true;
      /* eslint-disable */
      (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = true;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      /* eslint-enable */
      window.fbq?.("init", metaPixelId);
      window.fbq?.("track", "PageView");
    }

    // ---- TikTok Pixel ----
    if (tiktokPixelId && !window._ttLoaded) {
      window._ttLoaded = true;
      /* eslint-disable */
      (function (w: any, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq: any = (w[t] = w[t] || []);
        ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
        ttq.setAndDefer = function (obj: any, m: string) {
          obj[m] = function () {
            obj.push([m].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (id: string) {
          var e = ttq._i[id] || [];
          for (var n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
          return e;
        };
        ttq.load = function (e: string, n?: any) {
          var r = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = r;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          var o = d.createElement("script");
          o.type = "text/javascript";
          o.async = true;
          o.src = r + "?sdkid=" + e + "&lib=" + t;
          var a = d.getElementsByTagName("script")[0];
          a.parentNode!.insertBefore(o, a);
        };
        ttq.load(tiktokPixelId);
        ttq.page();
      })(window, document, "ttq");
      /* eslint-enable */
    }
  }, [metaPixelId, tiktokPixelId]);

  return null;
}

// Dispara "iniciou checkout"
export function trackInitiateCheckout(valueReais: number) {
  window.fbq?.("track", "InitiateCheckout", { value: valueReais, currency: "BRL" });
  window.ttq?.track("InitiateCheckout", { value: valueReais, currency: "BRL" });
}

// Dispara "compra" com eventID = o mesmo do server (dedup)
export function trackPurchase(valueReais: number, eventId: string) {
  window.fbq?.("track", "Purchase", { value: valueReais, currency: "BRL" }, { eventID: eventId });
  window.ttq?.track("CompletePayment", { value: valueReais, currency: "BRL" }, { event_id: eventId });
}
