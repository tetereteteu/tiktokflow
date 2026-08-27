// ─────────────────────────────────────────────────────────────
// TikTok Marketing API (v1.3) — criar campanha direto do painel.
//
// O token daqui é OUTRO, diferente do da Events API: este precisa
// dos escopos de Ads Management. Guardado em Store.tiktokBusinessToken.
//
// A API responde HTTP 200 mesmo em erro: o que vale é o campo `code`
// (0 = ok). Por isso todo erro de negócio é tratado como permanente —
// repetir um payload inválido só queima cota.
//
// Nada de ID chutado: região e identidade são LIDAS da conta do
// lojista (`/tool/region/`, `/identity/get/`) e escolhidas na tela.
// ─────────────────────────────────────────────────────────────

const BASE = "https://business-api.tiktok.com/open_api/v1.3";
const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 2;

export interface TikTokResult<T = Record<string, unknown>> {
  ok: boolean;
  code: number;
  message: string;
  data: T | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T = Record<string, unknown>>(
  token: string,
  method: "GET" | "POST",
  path: string,
  payload: Record<string, unknown>,
): Promise<TikTokResult<T>> {
  let url = `${BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: { "Access-Token": token, "Content-Type": "application/json" },
  };

  if (method === "GET") {
    // No GET, arrays e objetos vão JSON-encodados na query.
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    const q = qs.toString();
    if (q) url += `?${q}`;
  } else {
    init.body = JSON.stringify(payload);
  }

  let last: TikTokResult<T> = { ok: false, code: -1, message: "sem tentativa", data: null };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const json = (await res.json().catch(() => ({}))) as {
        code?: number; message?: string; data?: T;
      };
      const code = typeof json.code === "number" ? json.code : res.status;
      last = {
        ok: code === 0,
        code,
        message: String(json.message ?? `HTTP ${res.status}`),
        data: json.data ?? null,
      };
      // code != 0 é erro de negócio: payload/permissão/saldo. Não repete.
      return last;
    } catch (e) {
      clearTimeout(timer);
      last = {
        ok: false, code: -1, data: null,
        message: e instanceof Error && e.name === "AbortError"
          ? `timeout ${TIMEOUT_MS}ms` : e instanceof Error ? e.message : "erro de rede",
      };
      if (attempt < MAX_ATTEMPTS) await sleep(800);
    }
  }
  return last;
}

// ---- leitura: usadas pra preencher a tela e testar a conexão ----

export const advertiserInfo = (token: string, advertiserId: string) =>
  call(token, "GET", "/advertiser/info/", { advertiser_ids: [advertiserId] });

export const listRegions = (token: string, advertiserId: string, objectiveType: string) =>
  call(token, "GET", "/tool/region/", {
    advertiser_id: advertiserId,
    objective_type: objectiveType,
    placements: ["PLACEMENT_TIKTOK"],
  });

export const listIdentities = (token: string, advertiserId: string) =>
  call(token, "GET", "/identity/get/", { advertiser_id: advertiserId });

export const listCatalogs = (token: string, bcId: string) =>
  call(token, "GET", "/catalog/get/", { bc_id: bcId });

export const listCampaigns = (token: string, advertiserId: string) =>
  call(token, "GET", "/campaign/get/", { advertiser_id: advertiserId, page_size: 100 });

// ---- catálogo: cria e registra o feed CSV que este app já publica ----

export const createCatalog = (token: string, bcId: string, name: string, currency = "BRL") =>
  call(token, "POST", "/catalog/create/", {
    bc_id: bcId,
    catalog_name: name,
    catalog_type: "ECOMMERCE",
    currency,
    region: "BR",
  });

export const createCatalogFeed = (
  token: string, bcId: string, catalogId: string, name: string, feedUrl: string,
) =>
  call(token, "POST", "/catalog/feed/create/", {
    bc_id: bcId,
    catalog_id: catalogId,
    name,
    feed_url: feedUrl,
    update_mode: "REPLACE",
    schedule: { interval: "DAILY", hour: 3 },
  });

// ---- criação da campanha (campanha → conjunto → anúncio) ----

export interface LaunchInput {
  token: string;
  advertiserId: string;
  campaignName: string;
  dailyBudgetReais: number;
  catalogId?: string | null;
  identityId?: string | null;
  identityType?: string | null;
  locationIds: string[];
  pixelId?: string | null;
  /** "YYYY-MM-DD HH:mm:ss" no fuso da conta */
  startTime: string;
  landingUrl: string;
  adText: string;
}

export const createCampaign = (i: LaunchInput) =>
  call(i.token, "POST", "/campaign/create/", {
    advertiser_id: i.advertiserId,
    campaign_name: i.campaignName,
    objective_type: "PRODUCT_SALES",
    budget_mode: "BUDGET_MODE_INFINITE", // orçamento fica no conjunto
    campaign_product_source: "CATALOG",
    catalog_enabled: true,
    operation_status: "DISABLE", // nasce pausada — quem liga é o dono
  });

export const createAdgroup = (i: LaunchInput, campaignId: string) =>
  call(i.token, "POST", "/adgroup/create/", {
    advertiser_id: i.advertiserId,
    campaign_id: campaignId,
    adgroup_name: `${i.campaignName} — conjunto`,
    // catálogo como origem do criativo (Video Shopping Ads / DSA)
    promotion_type: "PRODUCT",
    product_source: "CATALOG",
    shopping_ads_type: "VIDEO",
    ...(i.catalogId ? { catalog_id: i.catalogId } : {}),
    ...(i.pixelId ? { pixel_id: i.pixelId } : {}),
    optimization_goal: "CONVERT",
    optimization_event: "SHOPPING",
    billing_event: "OCPM",
    pacing: "PACING_MODE_SMOOTH",
    budget_mode: "BUDGET_MODE_DAY",
    budget: i.dailyBudgetReais,
    schedule_type: "SCHEDULE_FROM_NOW",
    schedule_start_time: i.startTime,
    placement_type: "PLACEMENT_TYPE_NORMAL",
    placements: ["PLACEMENT_TIKTOK"],
    location_ids: i.locationIds,
    operation_status: "DISABLE",
  });

export const createAd = (i: LaunchInput, adgroupId: string) =>
  call(i.token, "POST", "/ad/create/", {
    advertiser_id: i.advertiserId,
    adgroup_id: adgroupId,
    creatives: [
      {
        ad_name: `${i.campaignName} — anúncio`,
        ad_format: "SHOPPING_ADS",
        ad_text: i.adText,
        landing_page_url: i.landingUrl,
        ...(i.identityId ? { identity_id: i.identityId } : {}),
        ...(i.identityType ? { identity_type: i.identityType } : {}),
      },
    ],
  });

// ---- relatório: alimenta o BI com gasto real ----

export interface SpendRow {
  date: string;
  campaignId: string;
  spendReais: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** Gasto diário por campanha entre duas datas (YYYY-MM-DD). */
export async function campaignSpend(
  token: string, advertiserId: string, startDate: string, endDate: string,
): Promise<{ result: TikTokResult; rows: SpendRow[] }> {
  const result = await call(token, "GET", "/report/integrated/get/", {
    advertiser_id: advertiserId,
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: ["campaign_id", "stat_time_day"],
    metrics: ["spend", "impressions", "clicks", "conversion"],
    start_date: startDate,
    end_date: endDate,
    page_size: 1000,
  });

  const list = (result.data as { list?: unknown[] } | null)?.list ?? [];
  const rows: SpendRow[] = [];
  for (const item of list) {
    const r = item as { dimensions?: Record<string, string>; metrics?: Record<string, string> };
    const d = r.dimensions ?? {};
    const m = r.metrics ?? {};
    const day = String(d.stat_time_day ?? "").slice(0, 10);
    if (!day) continue;
    rows.push({
      date: day,
      campaignId: String(d.campaign_id ?? ""),
      spendReais: Number(m.spend ?? 0) || 0,
      impressions: Math.round(Number(m.impressions ?? 0)) || 0,
      clicks: Math.round(Number(m.clicks ?? 0)) || 0,
      conversions: Math.round(Number(m.conversion ?? 0)) || 0,
    });
  }
  return { result, rows };
}
