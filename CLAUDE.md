# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Fale sempre **português** com o dono do projeto. Código, comentários e UI também são em pt-BR — siga o padrão existente.

## Comandos

```bash
npm install                # deps (roda prisma generate no postinstall)
npm run dev                # dev em :3000
npm run build              # prisma generate + next build
npm run start              # produção

npm run db:migrate         # gera a migration a partir do schema e aplica (DEV)
npm run db:deploy          # aplica as migrations pendentes (PRODUÇÃO)
npm run db:status          # quais migrations entraram e quais faltam
npm run db:studio          # Prisma Studio :5555
SEED_ADMIN_EMAIL="voce@email.com" SEED_ADMIN_PASSWORD="senha" npm run db:seed

npx tsc --noEmit           # checagem de tipos
```

**Verificação antes de entregar:** `npm test`, `npx tsc --noEmit` e `npm run build`, nessa ordem. O build **não precisa de banco no ar** — todas as rotas que consultam o Postgres são dinâmicas (`ƒ`); só `/` e `/painel/login` são estáticas. Basta ter `DATABASE_URL` definida (mesmo apontando pra um banco inexistente).

Variáveis (`.env`, modelo em `.env.example`): `DATABASE_URL`, `APP_BASE_URL` (monta a `postbackUrl` do webhook — precisa ser a URL pública real em produção), `AUTH_SECRET`. Opcional: `NERVA_BASE_URL`.

## Testes

`npm test` (Vitest, arquivos em `tests/`). A suíte cobre **só o caminho do
dinheiro** — é onde um bug não aparece na tela, aparece na conta:

- `tests/nerva-assinatura.test.ts` — HMAC do webhook (corpo adulterado, secret
  de outra loja, replay fora da janela de 5 min, assinatura de tamanho
  diferente) e a conversão reais↔centavos.
- `tests/webhook-rota.test.ts` — cada decisão do handler: 404 sem secret, 401
  em assinatura inválida, 200 quando não acha o pedido (senão a Nerva re-tenta
  4x), idempotência do `PAID` e disparo da Conversions API só no pago.

Dois testes existem por causa de regras deste arquivo que quebram dinheiro em
silêncio. Um assina um corpo **não-canônico** (`97.0`, espaço extra) para travar
o uso de `req.text()`: trocar por `req.json()` + `JSON.stringify` derruba os dois
na hora. O outro cobre o arredondamento de centavos.

A suíte foi validada por mutação — afrouxar a janela de replay, re-serializar o
corpo, remover a guarda de idempotência e truncar centavos em vez de arredondar
foram todas detectadas. Ao mexer nessa área, quebre o código de propósito e
confirme que a suíte acusa: teste que passa à toa não protege nada.

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

### Construtor de checkout

`CheckoutTheme` (uma por loja) guarda a aparência. O truque é não reescrever a
tela: `themeCss()` emite **overrides das CSS custom properties** de
`globals.css`, e como o checkout inteiro já usa `var(--gold)` / `var(--bg-card)`,
trocar os tokens repinta tudo — inclusive o que for criado depois. Borda, campo
e elevação são derivados da cor do cartão por clareamento.

**`customCss` é texto de inquilino indo pra página pública.** `cleanCustomCss()`
remove `<` e `>` (nenhum CSS legítimo precisa deles) e toda cor passa por
`hex()`. Não afrouxe isso: sem o corte, `</style><script>` vira XSS armazenado.
O preview do painel é `<iframe srcDoc>` justamente pra isolar esse CSS.

### Anúncios (TikTok Marketing API)

`src/lib/tiktok-ads.ts` cria campanha → conjunto → anúncio direto do painel, e
publica o catálogo apontando pro feed CSV que o app já serve.

- **São DOIS tokens diferentes de TikTok.** `tiktokAccessToken` é da Events API
  (conversão); `tiktokBusinessToken` é da Marketing API (gestão de anúncio).
  Escopos distintos — não unifique os campos.
- A API responde HTTP 200 mesmo em erro: o que vale é `code` (0 = ok). Erro de
  negócio é **permanente**; repetir só queima cota.
- Campanha nasce com `operation_status: DISABLE`. **Mantenha assim** — ninguém
  deve queimar verba por um clique errado no painel.
- Cada etapa grava o id devolvido antes de seguir: falha no meio deixa registro
  em `AdCampaign.lastError` em vez de órfão invisível na conta de anúncio.
- Região e identidade são **lidas da conta** (`/tool/region/`, `/identity/get/`),
  nunca chutadas.

### BI

`/painel/bi` cruza `Order` (receita) com `AdSpend` (custo) — é o que permite
mostrar lucro e ROAS, não só faturamento. `AdSpend` é preenchido pela sincronia
com o TikTok (upsert por loja+plataforma+dia+campanha, então re-sincronizar
corrige em vez de duplicar) ou à mão com `platform: MANUAL`.

Regras dos gráficos, se for mexer: receita e gasto são ambos em reais e dividem
**um** eixo (dois eixos y inventam correlação); a paleta categórica
(`#3987e5` / `#d95926`) foi validada contra a superfície real `#14141c` —
banda de luminosidade, croma, separação para daltonismo e contraste; cor nunca
carrega sentido sozinha (legenda + rótulo direto + tabela-espelho).

### Catálogo

`/catalog/{slug}/feed.csv` é público e serve colunas padrão (TikTok Catalog Manager, Meta Catalog, Google Merchant). O `link` de cada linha aponta direto pro checkout do produto, não pra uma página de produto. É esse feed que alimenta Video Shopping Ads / DSA.

## Convenções

- **"Nerva" é o gateway de pagamento, não o nome do projeto.** O projeto se chama **TikTokFlow**. `src/lib/nerva.ts`, `/api/webhooks/nerva/*`, o dourado `--gold` e os rótulos "Gateway Nerva" no painel são a integração — não renomeie.
- Arquivos importantes abrem com um bloco de comentário `─────` explicando o papel do módulo; mantenha o padrão ao criar arquivos novos.
- Estilo é CSS puro com design tokens em `src/app/globals.css` (tema escuro) + `style={{}}` inline. Sem Tailwind, sem biblioteca de componentes.
- Componentes de painel seguem o par `page.tsx` (Server Component: sessão + queries) + `XClient.tsx` (`"use client"`: formulários e interação).

## Deploy

`ORDENS-VPS.md` tem o passo a passo completo (VPS + Postgres + pm2 + Caddy com SSL automático). Atualização em produção:

```bash
git pull && npm install && npm run db:deploy && npm run build && pm2 restart tiktokflow
```

O `db:deploy` vem **antes** do build de propósito: o código novo já espera o schema novo.

### Migrations

O schema é versionado em `prisma/migrations/`. **Não use `prisma db push` em banco com
dados** — ele reconcilia o schema sem deixar histórico e derruba coluna ou tabela removida
sem perguntar. O script `db:push` continua no `package.json` só para banco descartável.

Ao mexer no `schema.prisma`:

1. `npm run db:migrate` — o Prisma gera `prisma/migrations/<timestamp>_<nome>/migration.sql`
   e aplica no banco local.
2. **Leia o SQL antes de commitar.** É ali que um `DROP` aparece. Renomear um campo no
   schema vira drop + add, o que descarta os dados da coluna: nesse caso edite o SQL à mão
   para `ALTER TABLE ... RENAME COLUMN`.
3. Commite a pasta da migration junto com a mudança do schema — uma sem a outra quebra o
   próximo deploy.
4. Em produção, `npm run db:deploy` aplica só o que falta e não gera nada.

`0_init` é o baseline: foi gerada a partir do schema que já rodava e marcada como aplicada
com `prisma migrate resolve`, então banco existente não a re-executa. `npm run db:status`
mostra o estado atual.

## Fora do código

`rabbitfy_mapa.md` é documento de **pesquisa** sobre uma plataforma concorrente (Rabbitfy/Blackfy), não especificação de implementação. Parte do que ele descreve — cloaker "Zero Gate", camuflagem de vídeo, automação em massa de contas de anúncio, apelação em lote — existe pra burlar a moderação de TikTok/Meta e **não deve ser implementada aqui**. As partes legítimas do mapa (construtor de checkout, upsell/downsell, recuperação de venda, múltiplos gateways, BI) são referência válida de roadmap.
