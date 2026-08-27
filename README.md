# TikTokFlow

Vitrine + checkout com Pix pela **Nerva**, multi-loja, painel admin com login,
feed de catálogo e rastreamento pronto pra rodar TikTok/Meta Ads.
Stack: **Next.js 14 + Postgres + Prisma**. Visual dark com o dourado da Nerva.

## O que já vem pronto

- **Vitrine** por loja em `/{slug-da-loja}` (lista os produtos)
- **Checkout** em `/{loja}/checkout/{produto}` — form, gera Pix na Nerva, mostra QR + copia-e-cola, e vira "pago" sozinho
- **Order bump** no checkout (oferta extra que soma no valor com um clique)
- **Upsell pós-compra**: depois do Pix aprovado, oferece um produto extra; se aceito, gera novo Pix reusando os dados do cliente (sem redigitar)
- **Feed de catálogo** por loja em `/catalog/{slug}/feed.csv` — CSV compatível com **TikTok Catalog Manager**, Meta e Google, pra rodar Video Shopping Ads / DSA
- **Tela Catálogo & TikTok** no painel: URL do feed de cada loja, status dos pixels e o passo a passo pra criar a campanha de catálogo no TikTok
- **Webhook** da Nerva com validação de assinatura HMAC (fonte da verdade do pagamento)
- **Painel** em `/painel` com login: pedidos em tempo real, KPIs (faturamento, líquido, vendas, pendentes)
- **CRUD completo pela tela**: criar/editar **lojas** (com API Key Nerva, webhook secret e pixels), **produtos** e **order bumps** — sem tocar no banco
- **Recuperação**: aba com os Pix pendentes das últimas 48h + contato pra perseguir manualmente
- **Rastreamento de anúncio desde o início**:
  - Pixels do **Meta** e **TikTok** no browser (PageView, InitiateCheckout, Purchase)
  - Captura de UTMs + `fbclid`/`ttclid`/`gclid` + cookies `_fbp`/`_fbc`
  - Envio server-side via o objeto `tracking` da Nerva → ela dispara **Meta CAPI + TikTok Events API** quando a venda é paga
  - `eventId` compartilhado entre browser e server = **deduplicação** correta
- **Multi-loja**: cada loja tem sua própria API Key/webhook secret/pixels da Nerva
- Idempotência, CPF validado, dinheiro em centavos (sem erro de arredondamento)

---

## 1. Rodar no seu computador (teste local)

Pré-requisitos: **Node 18+** e **Postgres** (local ou um banco grátis no Neon/Supabase).

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis
cp .env.example .env
# edite o .env e preencha DATABASE_URL, APP_BASE_URL e AUTH_SECRET
#   - AUTH_SECRET: gere com  ->  openssl rand -hex 32

# 3. criar as tabelas no banco
npm run db:push

# 4. criar seu usuário admin + loja de exemplo
#    (defina a senha antes, senão usa a padrão do seed)
SEED_ADMIN_EMAIL="voce@email.com" SEED_ADMIN_PASSWORD="suaSenhaForte" npm run db:seed

# 5. rodar
npm run dev
```

Acesse:
- Painel: http://localhost:3000/painel  (entre com o e-mail/senha do passo 4)
- Vitrine demo: http://localhost:3000/loja-demo

> O checkout só gera Pix de verdade depois que a loja tiver a **API Key da Nerva** preenchida (veja a seção 3).

---

## 2. Subir na AWS (Lightsail) com domínio

Uso **Lightsail** em vez de EC2/RDS porque é a opção "sem dor" da própria Amazon: preço fixo, sem configurar VPC/load balancer. Dá pra migrar pra EC2 depois se escalar.

### 2.1 Criar a instância
1. Console AWS → **Lightsail** → **Create instance**
2. Plataforma **Linux/Unix** → blueprint **Node.js** (já vem com Node instalado)
3. Escolha o plano (o de US$ 5–10/mês serve pra começar)
4. Nomeie e crie. Anote o **IP público estático** (crie um Static IP em Networking e anexe à instância).

### 2.2 Banco Postgres
Duas opções:
- **Simples:** um Postgres gerenciado grátis no **Neon** (neon.tech) — copie a `DATABASE_URL` que eles dão.
- **Tudo na AWS:** Lightsail → **Databases** → criar um PostgreSQL gerenciado e usar a connection string dele.

### 2.3 Subir o código
No terminal da instância (botão "Connect using SSH" no console):

```bash
# instalar utilitários
sudo apt update && sudo apt install -y git

# clonar seu projeto (suba pro GitHub antes, ou use scp)
git clone https://github.com/tetereteteu/tiktokflow.git && cd tiktokflow

npm install

# criar o .env de produção
nano .env
#   DATABASE_URL="...(do Neon ou Lightsail DB)..."
#   APP_BASE_URL="https://seudominio.com"
#   AUTH_SECRET="...(openssl rand -hex 32)..."

npm run db:push
SEED_ADMIN_EMAIL="voce@email.com" SEED_ADMIN_PASSWORD="senhaForte" npm run db:seed

npm run build

# rodar em produção com PM2 (mantém no ar e reinicia sozinho)
sudo npm install -g pm2
pm2 start "npm run start" --name tiktokflow
pm2 save && pm2 startup   # siga a instrução que ele imprime
```

### 2.4 Domínio + HTTPS
1. Aponte seu domínio pro IP estático da instância (registro **A** no seu provedor de DNS → IP do Lightsail).
2. Instale um proxy com HTTPS automático (Caddy é o mais simples):

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# configurar o Caddy
sudo nano /etc/caddy/Caddyfile
```

Conteúdo do Caddyfile (troque o domínio):
```
seudominio.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Pronto — o Caddy emite o certificado SSL sozinho. Seu site fica no ar em `https://seudominio.com`.

> No Lightsail, libere as portas **80** e **443** em Networking → Firewall.

---

## 3. Conectar a Nerva e os pixels (tudo pela tela)

Agora é feito no painel, sem mexer no banco:

1. Entre em `/painel/lojas` → **Nova loja** (ou edite uma).
2. Na seção **Gateway Nerva**, cole a `sk_live_...` (Integrações → API Keys no painel Nerva) e o **webhook secret**.
3. A tela mostra a **URL de webhook** já pronta pra você cadastrar na aba *Webhooks* da Nerva:
   `https://seudominio.com/api/webhooks/nerva/{ID_DA_LOJA}`
4. Na seção **Pixels de anúncio**, cole o **Meta Pixel ID** e o **TikTok Pixel ID** da loja.

Pronto. A partir daí o checkout já dispara os pixels no browser e manda o tracking server-side pra Nerva (que aciona Meta CAPI + TikTok Events API no pagamento).

> Para o server-side de anúncio funcionar 100%, ative a integração de Meta/TikTok **no painel da Nerva** também (a Nerva é quem dispara o CAPI). O app já entrega todos os dados de tracking pra ela.

---

## Estrutura do repositório

```
src/
  app/
    [store]/page.tsx                    vitrine da loja
    [store]/checkout/[product]/         checkout (form + Pix + polling)
    [store]/pos-compra/[orderId]/       upsell pós-pagamento
    catalog/[store]/feed.csv/route.ts   feed CSV (TikTok / Meta / Google)
    painel/                             admin: login, pedidos, lojas,
                                        produtos, ofertas, catálogo, recuperação
    api/
      checkout/route.ts                 cria pedido + cobrança Nerva
      webhooks/nerva/[storeId]/route.ts recebe confirmação (HMAC validado)
      orders/[orderId]/status/route.ts  status pro polling da tela
      upsell/accept/route.ts            aceita o upsell e gera o novo Pix
      admin/                            CRUD de lojas, produtos, bumps, upsells
      auth/                             login / logout
  components/
    Pixels.tsx                          Meta Pixel + TikTok Pixel no browser
    TrackingCapture.tsx                 captura UTM / fbclid / ttclid / cookies
  lib/
    nerva.ts                            client da Nerva + verificação de webhook
    capi.ts                             Meta CAPI + TikTok Events API (disparo próprio)
    tiktok-ads.ts                       Marketing API: catálogo + campanha
    checkout-theme.ts                   tema do checkout + preview do construtor
    tracking.ts                         monta o payload de tracking server-side
    prisma.ts                           conexão com o banco
    auth.ts                             sessão do painel (JWT em cookie)
    admin.ts                            guarda das rotas do painel
prisma/
  schema.prisma                         modelo de dados
  seed.ts                               admin + loja de exemplo

ORDENS-VPS.md                           passo a passo do deploy na Lightsail
rabbitfy_mapa.md                        mapa da plataforma Rabbitfy (pesquisa)
```

## Próximos passos (quando validar)
Testes automatizados do fluxo de checkout/webhook, migrations versionadas
(`prisma migrate` em vez de `db:push`), múltiplos gateways além da Nerva
e criação de campanha no TikTok direto pelo painel.
