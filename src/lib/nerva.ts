// ─────────────────────────────────────────────────────────────
// Client da API da Nerva (pixnerva.com.br)
// Toda chamada usa a API key da LOJA (multi-tenant).
// Docs: https://pixnerva.com.br/docs
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";

const NERVA_BASE_URL =
  process.env.NERVA_BASE_URL?.replace(/\/$/, "") || "https://pixnerva.com.br/api";

// ---- Tipos da resposta da Nerva ----

export interface NervaSaleResponse {
  id: string; // UUID interno da Nerva
  status: "pending" | "paid" | "failed" | "refunded" | "expired";
  amount: number; // em reais
  fee: number;
  netAmount: number;
  pixCode: string; // copia-e-cola
  pixQrCode: string; // url do QR
  transactionId: string; // id do adquirente
  description?: string;
  payerName?: string;
  payerEmail?: string;
  payerDocument?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSaleInput {
  apiKey: string; // sk_live_... da loja
  amountReais: number; // valor em reais (a Nerva trabalha em reais no /sales)
  document: string; // CPF do pagador (único obrigatório do customer)
  name?: string;
  email?: string;
  phone?: string;
  description?: string;
  externalId?: string; // nosso número de pedido — ecoado no webhook
  idempotencyKey?: string; // evita cobrança duplicada
  postbackUrl?: string; // webhook por transação (opcional)
  expirationInSeconds?: number; // 300–86400
  tracking?: NervaTracking; // dados de marketing p/ CAPI/Events API
}

// Objeto tracking da Nerva (dispara Meta CAPI / TikTok Events API no pago)
export interface NervaTracking {
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
  clientUserAgent?: string;
  clientIpAddress?: string;
  eventId?: string;
}

// ---- Erro tipado ----

export class NervaError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "NervaError";
  }
}

// ---- Criar cobrança PIX ----

export async function createNervaSale(
  input: CreateSaleInput,
): Promise<NervaSaleResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": input.apiKey,
  };
  if (input.idempotencyKey) {
    headers["idempotency-key"] = input.idempotencyKey;
  }

  const body: Record<string, unknown> = {
    amount: input.amountReais,
    customer: {
      document: input.document,
      ...(input.name ? { name: input.name } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    },
    ...(input.description ? { description: input.description } : {}),
    ...(input.externalId ? { externalId: input.externalId } : {}),
    ...(input.postbackUrl ? { postbackUrl: input.postbackUrl } : {}),
    ...(input.expirationInSeconds
      ? { expirationInSeconds: input.expirationInSeconds }
      : {}),
    ...(input.tracking && Object.keys(input.tracking).length > 0
      ? { tracking: input.tracking }
      : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s

  let res: Response;
  try {
    res = await fetch(`${NERVA_BASE_URL}/sales`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new NervaError(504, "Gateway demorou a responder. Tente novamente.");
    }
    throw new NervaError(502, "Não foi possível contatar o gateway.");
  }
  clearTimeout(timeout);

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new NervaError(
      res.status,
      json?.message || `Falha ao criar cobrança (HTTP ${res.status})`,
    );
  }

  return json as NervaSaleResponse;
}

// ---- Consultar cobrança (fallback / reconciliação) ----

export async function getNervaSale(
  apiKey: string,
  saleId: string,
): Promise<NervaSaleResponse> {
  const res = await fetch(`${NERVA_BASE_URL}/sales/${saleId}`, {
    headers: { "x-api-key": apiKey },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new NervaError(
      res.status,
      json?.message || `Falha ao consultar cobrança (HTTP ${res.status})`,
    );
  }
  return json as NervaSaleResponse;
}

// ─────────────────────────────────────────────────────────────
// Verificação de assinatura do webhook (HMAC-SHA256)
// Regra da Nerva: assinar a string `timestamp.body` com o secret,
// comparar com x-pixnerva-signature, e rejeitar se timestamp > 5 min.
// ─────────────────────────────────────────────────────────────

export function verifyNervaWebhook(params: {
  rawBody: string; // corpo BRUTO da requisição (string, não re-serializado)
  timestamp: string | null; // header x-pixnerva-timestamp
  signature: string | null; // header x-pixnerva-signature
  secret: string; // webhook secret da loja
}): boolean {
  const { rawBody, timestamp, signature, secret } = params;
  if (!timestamp || !signature || !secret) return false;

  // Proteção contra replay: rejeita se passou de 5 minutos
  const age = Date.now() / 1000 - Number(timestamp);
  if (!Number.isFinite(age) || age > 300 || age < -300) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  // timingSafeEqual exige buffers do mesmo tamanho
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

// ---- Helpers de dinheiro (centavos <-> reais) ----

export const toReais = (cents: number): number =>
  Math.round(cents) / 100;

export const toCents = (reais: number): number =>
  Math.round(reais * 100);
