# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Fale sempre **português** com o dono do projeto. Código, comentários e UI também são em pt-BR — siga o padrão existente.

## Comandos

```bash
npm install                # deps (roda prisma generate no postinstall)
npm run dev                # dev em :3000
npm run build              # prisma generate + next build
npm run start              # produção

npm run db:push            # aplica o schema no banco (NÃO gera migration)
npm run db:studio          # Prisma Studio :5555
SEED_ADMIN_EMAIL="voce@email.com" SEED_ADMIN_PASSWORD="senha" npm run db:seed

npx tsc --noEmit           # checagem de tipos
```

**Não existe suíte de testes.** A verificação antes de entregar é `npx tsc --noEmit` seguido de `npm run build`. O build **não precisa de banco no ar** — todas as rotas que consultam o Postgres são dinâmicas (`ƒ`); só `/` e `/painel/login` são estáticas. Basta ter `DATABASE_URL` definida (mesmo apontando pra um banco inexistente).

Variáveis (`.env`, modelo em `.env.example`): `DATABASE_URL`, `APP_BASE_URL` (monta a `postbackUrl` do webhook — precisa ser a URL pública real em produção), `AUTH_SECRET`. Opcional: `NERVA_BASE_URL`.

## Arquitetura

Next.js 14 (App Router, Server Components) + Prisma + Postgres. Vitrine, checkout Pix, painel admin e feed de catálogo pra TikTok/Meta Ads, tudo no mesmo app.

### Multi-tenant por `Store`

Não existe configuração global de gateway ou de pixel: **cada `Store` carrega a própria `nervaApiKey`, `nervaWebhookSecret`, `metaPixelId` e `tiktokPixelId`**. Toda rota nova que toque dados de loja precisa resolver a loja primeiro e usar as credenciais dela.

Autorização: `requireSession()` + `canManageStore()` (`src/lib/admin.ts`) em **toda** rota `/api/admin/*`. `ADMIN` enxerga tudo; `OWNER` só as lojas onde é `ownerId`. Sessão é JWT (`jose`) em cookie httpOnly `nerva_session` — o nome do cookie é legado, não renomeie sem invalidar as sessões ativas.

### Fluxo de pagamento (o núcleo)

```
POST /api/checkout          cria Order PENDING → createNervaSale() → devolve Pix (QR + copia-e-cola)
   ↓ (cliente paga)
POST /api/webhooks/nerva/{storeId}   ← FONTE DA VERDADE do status
   ↓
GET /api/orders/{orderId}/status     ← polling da tela de checkout
   ↓
/{store}/pos-compra/{orderId}        ← upsell → POST /api/upsell/accept (novo Order, reusa CPF e tracking)
```

Regras que quebram dinheiro ou atribuição se violadas:

- **O webhook é a única fonte de verdade do pagamento.** A resposta do `POST /sales` nunca marca `PAID`. A tela faz polling do status.
- **O webhook precisa do corpo BRUTO** (`await req.text()`). O HMAC é calculado sobre a string `timestamp.body` byte a byte — se o corpo for parseado e re-serializado antes de validar, a assinatura falha. O `storeId` vai na URL justamente pra descobrir qual secret usar.
- **O webhook responde 200 mesmo quando não casa o pedido**, senão a Nerva re-tenta 4x. Só 401 (assinatura inválida) e 404 (loja sem secret) recusam.
- **Dinheiro em centavos (`Int`) em todo o banco e na lógica interna.** A API da Nerva trabalha em **reais**: converta só na fronteira, com `toReais()` / `toCents()` de `src/lib/nerva.ts`. Nunca float em valor.
- **Idempotência:** `idempotencyKey` e `externalId` do `POST /sales` são o `order.id`. O webhook não reprocessa um pedido já `PAID`.

### Tracking de anúncio

`src/lib/tracking.ts` captura UTMs, `fbclid`/`ttclid`/`gclid` e os cookies `_fbp`/`_fbc`, persistindo em `localStorage` sob `trk_*` (a query some quando o cliente navega antes de comprar). Esses dados vão por dois caminhos:

1. **Browser** — `src/components/Pixels.tsx` dispara Meta Pixel e TikTok Pixel.
2. **Server** — dois caminhos, escolhidos **por loja** no campo `Store.capiOwn`:
   - `capiOwn = false` (padrão): sobe só o objeto `tracking` no `POST /sales` e **é a Nerva que dispara** Meta CAPI e TikTok Events API quando a venda é paga.
   - `capiOwn = true`: `src/lib/capi.ts` dispara **direto daqui**, no webhook, assim que o pedido vira `PAID` — usando `Store.metaAccessToken` / `Store.tiktokAccessToken`. Nesse modo, **desligue a integração equivalente no painel da Nerva**, senão a mesma venda vai pelos dois caminhos.

   O disparo próprio é `void` no webhook (sem `await`): a resposta 200 tem que sair rápido. Sucesso carimba `Order.metaCapiAt` / `Order.tiktokCapiAt`, o que torna o envio único mesmo com as re-tentativas da Nerva; falha fica em `Order.metaCapiError` / `tiktokCapiError`. Nada em `capi.ts` pode lançar pra fora.

Os dois lados compartilham o mesmo `eventId` (`makeEventId(orderId)` → `purchase_${orderId}`) e o mesmo nome de evento (Meta `Purchase`, TikTok `CompletePayment`). **Mudar qualquer um dos dois quebra a deduplicação** e a compra conta duas vezes.

### Catálogo

`/catalog/{slug}/feed.csv` é público e serve colunas padrão (TikTok Catalog Manager, Meta Catalog, Google Merchant). O `link` de cada linha aponta direto pro checkout do produto, não pra uma página de produto. É esse feed que alimenta Video Shopping Ads / DSA.

## Convenções

- **"Nerva" é o gateway de pagamento, não o nome do projeto.** O projeto se chama **TikTokFlow**. `src/lib/nerva.ts`, `/api/webhooks/nerva/*`, o dourado `--gold` e os rótulos "Gateway Nerva" no painel são a integração — não renomeie.
- Arquivos importantes abrem com um bloco de comentário `─────` explicando o papel do módulo; mantenha o padrão ao criar arquivos novos.
- Estilo é CSS puro com design tokens em `src/app/globals.css` (tema escuro) + `style={{}}` inline. Sem Tailwind, sem biblioteca de componentes.
- Componentes de painel seguem o par `page.tsx` (Server Component: sessão + queries) + `XClient.tsx` (`"use client"`: formulários e interação).

## Deploy

`ORDENS-VPS.md` tem o passo a passo completo (AWS Lightsail + Neon Postgres + pm2 + Caddy com SSL automático). Atualização em produção: `git pull && npm install && npm run build && pm2 restart tiktokflow`.

O schema é aplicado com `prisma db push`, **sem migrations versionadas** — mudança destrutiva no `schema.prisma` derruba dados em produção sem aviso. Migrar pra `prisma migrate` é um dos próximos passos do README.

## Fora do código

`rabbitfy_mapa.md` é documento de **pesquisa** sobre uma plataforma concorrente (Rabbitfy/Blackfy), não especificação de implementação. Parte do que ele descreve — cloaker "Zero Gate", camuflagem de vídeo, automação em massa de contas de anúncio, apelação em lote — existe pra burlar a moderação de TikTok/Meta e **não deve ser implementada aqui**. As partes legítimas do mapa (construtor de checkout, upsell/downsell, recuperação de venda, múltiplos gateways, BI) são referência válida de roadmap.
