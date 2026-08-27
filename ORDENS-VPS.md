# Ordens pra rodar na VPS (AWS Lightsail) — passo a passo

Execute na ordem. Cada bloco é pra colar no terminal SSH da instância.
Quando algo falhar, copie a mensagem de erro e me mande — a gente resolve.

Legenda: **[VOCÊ]** = fazer no console web da AWS / no seu registrador de domínio.
**[TERMINAL]** = colar no SSH da instância.

---

## FASE 0 — Antes de tudo (coletar credenciais)

Tenha em mãos:
- A **API Key da Nerva** (`sk_live_...`) de cada loja — painel Nerva → Integrações → API Keys
- Um **Postgres**. Recomendo criar grátis no **Neon** (neon.tech): crie um projeto e copie a `DATABASE_URL` (formato `postgresql://...`).
- Seu **domínio** (onde você vai apontar o DNS).

---

## FASE 1 — Criar a instância [VOCÊ]

1. Console AWS → **Lightsail** → **Create instance**.
2. Region: escolha São Paulo (`sa-east-1`) pra menor latência no Brasil.
3. Plataforma **Linux/Unix** → blueprint **Node.js**.
4. Plano: o de **US$ 10/mês** (2 GB RAM) — o de 512 MB às vezes engasga no build do Next.
5. Nomeie (ex: `tiktokflow`) e crie.
6. Aba **Networking** da instância → **Create static IP** → anexe à instância. Anote esse IP.
7. Aba **Networking** → **Firewall** → adicione as regras: **HTTP (80)** e **HTTPS (443)**.

---

## FASE 2 — Apontar o domínio [VOCÊ]

No painel do seu domínio (Registro.br, GoDaddy, Cloudflare, etc.):
- Crie um registro **A**: nome `@` (ou o subdomínio que quiser) → **IP estático** da Fase 1.
- Se quiser `www` também: registro **A** de `www` pro mesmo IP.

> DNS pode levar de minutos a algumas horas pra propagar.

---

## FASE 3 — Preparar o servidor [TERMINAL]

Conecte via SSH (botão "Connect using SSH" no console Lightsail) e cole:

```bash
# atualizar o sistema e instalar utilitários
sudo apt update && sudo apt upgrade -y
sudo apt install -y git unzip

# conferir Node (o blueprint já traz; precisa ser 18+)
node -v
```

Se o Node for menor que 18, instale o 20:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

---

## FASE 4 — Subir o código [TERMINAL]

O código-fonte fica versionado no repositório. Na VPS:

```bash
cd ~
git clone https://github.com/tetereteteu/tiktokflow.git
cd tiktokflow
```

> Se o repositório for **privado**, gere um Personal Access Token no GitHub
> (Settings → Developer settings → Tokens) e use:
> `git clone https://SEU_TOKEN@github.com/tetereteteu/tiktokflow.git`

---

## FASE 5 — Configurar e instalar [TERMINAL]

```bash
cd ~/tiktokflow

# instalar dependências
npm install

# criar o arquivo de ambiente
nano .env
```

No editor `nano`, cole (troque os valores):
```
DATABASE_URL="postgresql://...cole a URL do Neon aqui..."
APP_BASE_URL="https://seudominio.com"
AUTH_SECRET="COLE_AQUI_UM_SEGREDO"
```
Para gerar o `AUTH_SECRET`, abra outro terminal e rode `openssl rand -hex 32`, copie o resultado.
Salvar no nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

```bash
# criar as tabelas no banco
npm run db:push

# criar seu usuário admin (troque e-mail e senha)
SEED_ADMIN_EMAIL="voce@email.com" SEED_ADMIN_PASSWORD="UmaSenhaForte123" npm run db:seed

# compilar
npm run build
```

---

## FASE 6 — Deixar rodando 24/7 [TERMINAL]

```bash
sudo npm install -g pm2
pm2 start "npm run start" --name tiktokflow
pm2 save
pm2 startup
```
O `pm2 startup` vai imprimir **um comando** — copie e cole exatamente o que ele mandar (começa com `sudo env PATH=...`). Isso faz o app voltar sozinho se a VPS reiniciar.

Teste rápido (ainda sem domínio/SSL):
```bash
curl -I http://localhost:3000
```
Deve responder algo como `HTTP/1.1 307` ou `200`.

---

## FASE 7 — HTTPS + domínio com Caddy [TERMINAL]

```bash
# instalar o Caddy (proxy com SSL automático)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# configurar
sudo nano /etc/caddy/Caddyfile
```
Apague o conteúdo e cole (troque o domínio):
```
seudominio.com {
    reverse_proxy localhost:3000
}
```
Salvar: `Ctrl+O`, `Enter`, `Ctrl+X`. Depois:
```bash
sudo systemctl restart caddy
```

O Caddy emite o certificado SSL sozinho na primeira visita. Acesse **https://seudominio.com/painel** e entre com o e-mail/senha da Fase 5.

---

## FASE 8 — Configurar loja e Nerva (pela tela, sem terminal)

1. Acesse `https://seudominio.com/painel/lojas` → **Nova loja**.
2. Preencha nome e slug.
3. Em **Gateway Nerva**: cole a `sk_live_...` e o **webhook secret**.
4. Copie a **URL de webhook** que a tela mostra e cadastre na aba *Webhooks* do painel da Nerva.
5. Em **Pixels**: cole Meta Pixel ID e TikTok Pixel ID.
6. Salve. Depois vá em **Produtos** → cadastre os produtos, e em **Ofertas** → order bumps.
7. No painel da **Nerva**, ative as integrações de Meta/TikTok (é a Nerva que dispara o CAPI server-side).

Sua loja fica em `https://seudominio.com/{slug}` e o checkout em `https://seudominio.com/{slug}/checkout/{produto}`.

---

## Atualizar o app no futuro [TERMINAL]

Quando eu te mandar código novo:
```bash
cd ~/tiktokflow
git pull
npm install
npm run build
pm2 restart tiktokflow
```

## Comandos úteis [TERMINAL]
```bash
pm2 logs tiktokflow      # ver logs em tempo real (erros aparecem aqui)
pm2 restart tiktokflow   # reiniciar
pm2 status               # ver se está no ar
npm run db:studio        # abrir o Prisma Studio pra ver o banco (porta 5555)
```
