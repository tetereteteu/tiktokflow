// ─────────────────────────────────────────────────────────────
// Conversions API PRÓPRIA — Meta CAPI + TikTok Events API.
//
// Dispara o evento de compra direto daqui, sem depender do gateway.
// Roda no webhook (única fonte de verdade do pagamento), logo depois
// do pedido virar PAID.
//
// Deduplicação: usa o MESMO eventId do pixel do browser
// (`purchase_{orderId}`, de makeEventId) e o MESMO nome de evento
// (Meta "Purchase", TikTok "CompletePayment"). O Meta casa por
// event_id + event_name; o TikTok, por event_id. Mudar qualquer um
// dos dois quebra a dedup e a mesma compra conta duas vezes.
//
// Regra de ouro: nada aqui pode derrubar o webhook. Toda falha é
// capturada e gravada no pedido — o webhook responde 200 de qualquer
// jeito, senão a Nerva re-tenta 4x.
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { toReais } from "@/lib/nerva";
import { makeEventId } from "@/lib/tracking";

const META_API_VERSION = "v21.0";
const metaUrl = (pixelId: string) =>
  `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(pixelId)}/events`;
const TIKTOK_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;

// ---- Normalização + hash (exigência das duas APIs: SHA-256 hex) ----

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

function hashEmail(v?: string | null): string | undefined {
  const s = v?.trim().toLowerCase();
  return s ? sha256(s) : undefined;
}

// Telefone precisa ir com DDI e só dígitos. Número BR sem o 55 ganha o 55.
function hashPhone(v?: string | null): string | undefined {
  let d = (v ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.length <= 11) d = `55${d}`;
  return sha256(d);
}

// CPF vira external_id — só dígitos.
function hashDoc(v?: string | null): string | undefined {
  const d = (v ?? "").replace(/\D/g, "");
  return d ? sha256(d) : undefined;
}

// Nome: primeiro e último separados, minúsculo e sem acento (padrão Meta).
function hashName(full?: string | null): { fn?: string; ln?: string } {
  const parts = (full ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { fn: sha256(parts[0]) };
  return { fn: sha256(parts[0]), ln: sha256(parts[parts.length - 1]) };
}

// ---- Resultado de um envio ----

export interface CapiResult {
  ok: boolean;
  status: number; // HTTP (0 = nem chegou a responder)
  detail: string; // mensagem curta, gravada no pedido
  attempts: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Verdict = { ok: boolean; detail: string; permanent?: boolean };

// 4xx e erro de negócio = permanente (token errado, payload inválido): não repete.
// 5xx, timeout e falha de rede = temporário: repete com backoff 0,5s / 1s.
async function postWithRetry(
  url: string,
  init: RequestInit,
  judge: (status: number, json: Record<string, unknown>) => Verdict,
): Promise<CapiResult> {
  let last: CapiResult = { ok: false, status: 0, detail: "sem tentativa", attempts: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const v = judge(res.status, json);
      last = { ok: v.ok, status: res.status, detail: v.detail, attempts: attempt };
      if (v.ok) return last;
      if (v.permanent || (res.status >= 400 && res.status < 500)) return last;
    } catch (e) {
      clearTimeout(timer);
      const msg =
        e instanceof Error && e.name === "AbortError"
          ? `timeout ${TIMEOUT_MS}ms`
          : e instanceof Error
            ? e.message
            : "erro de rede";
      last = { ok: false, status: 0, detail: msg, attempts: attempt };
    }
    if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
  }
  return last;
}

// ---- Evento de compra, já pronto pros dois destinos ----

export interface PurchaseEvent {
  eventId: string; // purchase_{orderId} — o mesmo do pixel do browser
  eventTimeMs: number;
  valueReais: number;
  currency?: string;
  orderId: string;
  sourceUrl?: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null; // CPF
  name?: string | null;
  clientIp?: string | null;
  clientUa?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ttclid?: string | null;
  contentId?: string | null;
  contentName?: string | null;
}

// ---- Meta Conversions API ----

export async function sendMetaPurchase(params: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  event: PurchaseEvent;
}): Promise<CapiResult> {
  const { pixelId, accessToken, testEventCode, event: e } = params;
  const { fn, ln } = hashName(e.name);
  const em = hashEmail(e.email);
  const ph = hashPhone(e.phone);
  const ext = hashDoc(e.document);

  const body = {
    data: [
      {
        event_name: "Purchase", // MESMO nome do pixel do browser
        event_time: Math.floor(e.eventTimeMs / 1000),
        event_id: e.eventId,
        action_source: "website",
        ...(e.sourceUrl ? { event_source_url: e.sourceUrl } : {}),
        user_data: {
          ...(em ? { em: [em] } : {}),
          ...(ph ? { ph: [ph] } : {}),
          ...(fn ? { fn: [fn] } : {}),
          ...(ln ? { ln: [ln] } : {}),
          ...(ext ? { external_id: [ext] } : {}),
          ...(e.clientIp ? { client_ip_address: e.clientIp } : {}),
          ...(e.clientUa ? { client_user_agent: e.clientUa } : {}),
          ...(e.fbp ? { fbp: e.fbp } : {}),
          ...(e.fbc ? { fbc: e.fbc } : {}),
        },
        custom_data: {
          value: e.valueReais,
          currency: e.currency ?? "BRL",
          order_id: e.orderId,
          content_type: "product",
          ...(e.contentId ? { content_ids: [e.contentId] } : {}),
          ...(e.contentName ? { content_name: e.contentName } : {}),
        },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  return postWithRetry(
    `${metaUrl(pixelId)}?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    (status, json) => {
      const received = json.events_received;
      if (status === 200 && typeof received === "number" && received > 0) {
        return { ok: true, detail: `events_received=${received}` };
      }
      const err = json.error as { message?: string } | undefined;
      return { ok: false, detail: String(err?.message ?? `HTTP ${status}`).slice(0, 300) };
    },
  );
}

// ---- TikTok Events API ----

export async function sendTiktokPurchase(params: {
  pixelId: string;
  accessToken: string;
  testEventCode?: string | null;
  event: PurchaseEvent;
}): Promise<CapiResult> {
  const { pixelId, accessToken, testEventCode, event: e } = params;

  const body = {
    event_source: "web",
    event_source_id: pixelId,
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
    data: [
      {
        event: "CompletePayment", // MESMO nome do pixel do browser
        event_time: Math.floor(e.eventTimeMs / 1000),
        event_id: e.eventId,
        user: {
          ...(hashEmail(e.email) ? { email: hashEmail(e.email) } : {}),
          ...(hashPhone(e.phone) ? { phone: hashPhone(e.phone) } : {}),
          ...(hashDoc(e.document) ? { external_id: hashDoc(e.document) } : {}),
          ...(e.ttclid ? { ttclid: e.ttclid } : {}),
          ...(e.clientIp ? { ip: e.clientIp } : {}),
          ...(e.clientUa ? { user_agent: e.clientUa } : {}),
        },
        properties: {
          currency: e.currency ?? "BRL",
          value: e.valueReais,
          order_id: e.orderId,
          content_type: "product",
          ...(e.contentId
            ? {
                contents: [
                  {
                    content_id: e.contentId,
                    ...(e.contentName ? { content_name: e.contentName } : {}),
                    quantity: 1,
                    price: e.valueReais,
                  },
                ],
              }
            : {}),
        },
        ...(e.sourceUrl ? { page: { url: e.sourceUrl } } : {}),
      },
    ],
  };

  return postWithRetry(
    TIKTOK_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": accessToken },
      body: JSON.stringify(body),
    },
    (status, json) => {
      // O TikTok responde 200 mesmo em erro de negócio — o que vale é o `code`.
      if (status === 200 && json.code === 0) return { ok: true, detail: "code=0" };
      const detail = String(json.message ?? `HTTP ${status}`).slice(0, 300);
      return { ok: false, detail, permanent: status === 200 };
    },
  );
}

// ─────────────────────────────────────────────────────────────
// Orquestrador chamado pelo webhook. NUNCA lança.
// Só dispara o que está configurado e ainda não foi enviado com
// sucesso — o carimbo metaCapiAt/tiktokCapiAt torna o envio único
// mesmo com as re-tentativas do webhook.
// ─────────────────────────────────────────────────────────────

export async function sendPurchaseConversions(
  orderId: string,
): Promise<{ meta?: CapiResult; tiktok?: CapiResult }> {
  const out: { meta?: CapiResult; tiktok?: CapiResult } = {};
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: {
          select: {
            slug: true,
            capiOwn: true,
            metaPixelId: true,
            metaAccessToken: true,
            metaTestEventCode: true,
            tiktokPixelId: true,
            tiktokAccessToken: true,
            tiktokTestEventCode: true,
          },
        },
        product: { select: { id: true, slug: true, title: true } },
      },
    });

    if (!order || order.status !== "PAID") return out;

    const s = order.store;
    if (!s.capiOwn) return out; // desligado: quem dispara é o gateway

    const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
    const event: PurchaseEvent = {
      eventId: makeEventId(order.id),
      eventTimeMs: (order.paidAt ?? order.updatedAt).getTime(),
      valueReais: toReais(order.amountCents),
      orderId: order.id,
      sourceUrl: base ? `${base}/${s.slug}/checkout/${order.product.slug}` : undefined,
      email: order.customerEmail,
      phone: order.customerPhone,
      document: order.customerDocument,
      name: order.customerName,
      clientIp: order.clientIp,
      clientUa: order.clientUa,
      fbp: order.fbp,
      fbc: order.fbc,
      ttclid: order.ttclid,
      contentId: order.product.id,
      contentName: order.product.title,
    };

    if (s.metaPixelId && s.metaAccessToken && !order.metaCapiAt) {
      const r = await sendMetaPurchase({
        pixelId: s.metaPixelId,
        accessToken: s.metaAccessToken,
        testEventCode: s.metaTestEventCode,
        event,
      });
      out.meta = r;
      await prisma.order
        .update({
          where: { id: order.id },
          data: r.ok
            ? { metaCapiAt: new Date(), metaCapiError: null }
            : { metaCapiError: `${r.status} ${r.detail}`.slice(0, 500) },
        })
        .catch(() => {});
    }

    if (s.tiktokPixelId && s.tiktokAccessToken && !order.tiktokCapiAt) {
      const r = await sendTiktokPurchase({
        pixelId: s.tiktokPixelId,
        accessToken: s.tiktokAccessToken,
        testEventCode: s.tiktokTestEventCode,
        event,
      });
      out.tiktok = r;
      await prisma.order
        .update({
          where: { id: order.id },
          data: r.ok
            ? { tiktokCapiAt: new Date(), tiktokCapiError: null }
            : { tiktokCapiError: `${r.status} ${r.detail}`.slice(0, 500) },
        })
        .catch(() => {});
    }
  } catch (e) {
    console.error("[capi] falha inesperada", e);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Validação de credenciais pro painel — SEM enviar compra falsa.
// Meta: GET no pixel (read-only) confirma token + acesso ao pixel.
// TikTok: não tem leitura equivalente sem advertiser_id, então usa
// o próprio /event/track com test_event_code (evento de teste não
// entra nos dados de anúncio); sem código de teste, não testa.
// ─────────────────────────────────────────────────────────────

export async function checkMetaCredentials(
  pixelId: string,
  accessToken: string,
): Promise<CapiResult> {
  const url =
    `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(pixelId)}` +
    `?fields=id,name&access_token=${encodeURIComponent(accessToken)}`;
  return postWithRetry(url, { method: "GET" }, (status, json) => {
    if (status === 200 && json.id) {
      return { ok: true, detail: `pixel "${String(json.name ?? json.id)}" acessível` };
    }
    const err = json.error as { message?: string } | undefined;
    return { ok: false, detail: String(err?.message ?? `HTTP ${status}`).slice(0, 300) };
  });
}

export async function checkTiktokCredentials(
  pixelId: string,
  accessToken: string,
  testEventCode: string,
): Promise<CapiResult> {
  return sendTiktokPurchase({
    pixelId,
    accessToken,
    testEventCode,
    event: {
      eventId: `capitest_${Date.now()}`,
      eventTimeMs: Date.now(),
      valueReais: 1,
      orderId: "teste-de-conexao",
      email: "teste@exemplo.com",
    },
  });
}
