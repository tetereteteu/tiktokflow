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

// ─────────────────────────────────────────────────────────────
// Business Center: listar BCs, contar contas e criar conta de
// anúncio.
//
// Contrato conferido no SDK oficial (tiktok/tiktok-business-api-sdk,
// docs de BCApi e AdvertiserCreateBody), não chutado:
//   POST /bc/advertiser/create/
//     obrigatórios: bc_id, advertiser_info, customer_info
//     opcionais:    contact_info, qualification_info, billing_info
//
// ATENÇÃO BRASIL — a doc marca estes campos como "optional" no
// esquema, mas eles são EXIGIDOS quando a conta ou o BC é
// registrado no Brasil:
//   contact_info.email
//   qualification_info.license_no            (CNPJ)
//   qualification_info.qualification_image_ids (via /bc/image/upload/)
//   billing_info.tax_map -> tax_id
// Faltando qualquer um, a API nega — e negação por falta de campo
// não vira sucesso por insistência.
// ─────────────────────────────────────────────────────────────

export const listBusinessCenters = (token: string) =>
  call(token, "GET", "/bc/get/", { page: 1, page_size: 50 });

/** Conta quantas contas de anúncio o BC já tem (paginando até o fim). */
export async function countBcAdvertisers(
  token: string,
  bcId: string,
): Promise<{ result: TikTokResult; total: number }> {
  const result = await call(token, "GET", "/bc/asset/get/", {
    bc_id: bcId,
    asset_type: "ADVERTISER",
    page: 1,
    page_size: 100,
  });
  const info = (result.data as { page_info?: { total_number?: number }; list?: unknown[] } | null);
  const total =
    typeof info?.page_info?.total_number === "number"
      ? info.page_info.total_number
      : (info?.list?.length ?? 0);
  return { result, total };
}

export interface NovaContaInput {
  bcId: string;
  /** advertiser_info */
  name: string;
  currency: string; // BRL
  timezone: string; // ex: "America/Sao_Paulo"
  type?: "AUCTION" | "RESERVATION";
  /** customer_info (obrigatório) */
  company: string;
  industry: number;
  registeredArea: string; // código de localização, ex: BR
  /** contact_info — email é exigido no Brasil */
  contactEmail?: string;
  contactName?: string;
  contactNumber?: string;
  /** qualification_info — license_no e imagens exigidos no Brasil */
  licenseNo?: string;
  qualificationImageIds?: string[];
  promotionLink?: string;
  /** billing_info — tax_id exigido no Brasil */
  taxId?: string;
  billingAddress?: string;
}

export const createBcAdvertiser = (token: string, i: NovaContaInput) =>
  call(token, "POST", "/bc/advertiser/create/", {
    bc_id: i.bcId,
    advertiser_info: {
      name: i.name,
      currency: i.currency,
      timezone: i.timezone,
      type: i.type ?? "AUCTION",
    },
    customer_info: {
      company: i.company,
      industry: i.industry,
      registered_area: i.registeredArea,
    },
    ...(i.contactEmail || i.contactName || i.contactNumber
      ? {
          contact_info: {
            ...(i.contactEmail ? { email: i.contactEmail } : {}),
            ...(i.contactName ? { name: i.contactName } : {}),
            ...(i.contactNumber ? { number: i.contactNumber } : {}),
          },
        }
      : {}),
    ...(i.licenseNo || i.qualificationImageIds?.length || i.promotionLink
      ? {
          qualification_info: {
            ...(i.licenseNo ? { license_no: i.licenseNo } : {}),
            ...(i.qualificationImageIds?.length
              ? { qualification_image_ids: i.qualificationImageIds }
              : {}),
            ...(i.promotionLink ? { promotion_link: i.promotionLink } : {}),
          },
        }
      : {}),
    ...(i.taxId || i.billingAddress
      ? {
          billing_info: {
            ...(i.billingAddress ? { address: i.billingAddress } : {}),
            ...(i.taxId ? { tax_map: { tax_id: i.taxId } } : {}),
          },
        }
      : {}),
  });

// ─────────────────────────────────────────────────────────────
// Classificação de erro para a repetição.
//
// O dono do projeto observou que algumas negações passam numa
// tentativa seguinte, então aqui ninguém desiste na primeira. O que
// muda é QUANTO esperar antes de tentar de novo:
//
//   REDE      — timeout/queda: espera curta, é ruído de conexão.
//   LIMITE    — rate limit: espera longa, é a API pedindo calma.
//                Insistir rápido aqui piora, gera mais negação.
//   SERVIDOR  — erro 5xx do lado deles: espera média.
//   NEGOCIO   — payload/permissão/qualificação: espera longa e
//                número máximo de tentativas. É o caso do campo
//                faltando: repetir não conserta, e o motivo fica
//                visível na tela em vez de virar tentativa infinita.
//   COTA      — o BC atingiu o limite de contas: para de vez neste
//                BC. Continuar aqui só marca a conta.
// ─────────────────────────────────────────────────────────────

export type ClasseErro = "REDE" | "LIMITE" | "SERVIDOR" | "NEGOCIO" | "COTA";

export function classificarErro(r: TikTokResult): ClasseErro {
  if (r.code === -1) return "REDE";

  const msg = r.message.toLowerCase();

  if (/limit of ad account|account limit|quota (has been )?(reached|exceeded)|maximum number of ad account/.test(msg))
    return "COTA";

  if (r.code === 40100 || /rate limit|too many request|qps|frequenc/.test(msg))
    return "LIMITE";

  if (r.code >= 50000 || /internal|server error|timeout|try again later/.test(msg))
    return "SERVIDOR";

  return "NEGOCIO";
}

/** Espera antes da próxima tentativa: cresce com a tentativa, com jitter. */
export function esperaMs(classe: ClasseErro, tentativa: number): number {
  const base: Record<ClasseErro, number> = {
    REDE: 1_000,
    SERVIDOR: 5_000,
    LIMITE: 30_000,
    NEGOCIO: 15_000,
    COTA: 0,
  };
  const teto: Record<ClasseErro, number> = {
    REDE: 30_000,
    SERVIDOR: 120_000,
    LIMITE: 300_000,
    NEGOCIO: 180_000,
    COTA: 0,
  };
  const cru = base[classe] * Math.pow(2, Math.max(0, tentativa - 1));
  const limitado = Math.min(cru, teto[classe]);
  // jitter de ±20% pra várias tentativas não baterem no mesmo instante
  return Math.round(limitado * (0.8 + Math.random() * 0.4));
}

// ─────────────────────────────────────────────────────────────
// Upload de certificado (contrato social, CNPJ) para o BC.
//
// Devolve o image_id que vai em qualification_info.qualification_image_ids
// na criação da conta — o campo que o Brasil exige.
//
// Não usa o helper `call`: aquele manda Content-Type: application/json,
// e aqui é multipart. O Content-Type NÃO pode ser definido à mão — o
// fetch precisa montar o boundary sozinho, senão o servidor não
// consegue separar as partes.
//
// Campos conferidos no SDK oficial (js_sdk/src/api/BCApi.js,
// bcImageUpload): formParams bc_id + image_file, contentTypes
// multipart/form-data, header Access-Token.
// ─────────────────────────────────────────────────────────────

export async function uploadBcImage(
  token: string,
  bcId: string,
  arquivo: Blob,
  nomeArquivo: string,
): Promise<TikTokResult<{ image_id?: string }>> {
  const form = new FormData();
  form.append("bc_id", bcId);
  form.append("image_file", arquivo, nomeArquivo);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // imagem é maior que JSON

  try {
    const res = await fetch(`${BASE}/bc/image/upload/`, {
      method: "POST",
      headers: { "Access-Token": token }, // sem Content-Type: o fetch põe o boundary
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const json = (await res.json().catch(() => ({}))) as {
      code?: number; message?: string; data?: { image_id?: string };
    };
    const code = typeof json.code === "number" ? json.code : res.status;
    return {
      ok: code === 0,
      code,
      message: String(json.message ?? `HTTP ${res.status}`),
      data: json.data ?? null,
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false, code: -1, data: null,
      message: e instanceof Error && e.name === "AbortError"
        ? "timeout no upload (60s)" : e instanceof Error ? e.message : "erro de rede",
    };
  }
}
