# Rabbitfy Commerce OS — Mapa Completo da Plataforma

> Mapeamento feito por acesso autenticado à conta, leitura de todas as telas internas e dos endpoints de API que cada uma consome. Manifest interno: "Rabbitfy Commerce OS". Termos de uso ainda assinam "Blackfy Store" (white-label/rebrand). Acesso por aprovação manual ("enviar para análise"). PWA com push de notificação de vendas.

## Resumo em uma linha
Painel fechado que unifica **loja + checkout próprio + gestão de pedidos + automação industrial de contas de anúncio (TikTok/Meta) + cloaker**, voltado para operação de tráfego pago em escala e produtos que não passam na moderação normal das plataformas.

---

## 1. LOJA / VITRINE
| Tela | Função |
|---|---|
| Vitrines | Lista de lojas (multi-loja: stores 57, 58…) |
| Criar vitrine | Nome, descrição, loja vinculada, domínio personalizado, modelo de landing, identidade |
| Domínios vitrines | Vincular domínio próprio, subdomínio, CNAME, SSL |
| Coleções (listar) | Agrupamento de produtos |
| Produtos / Criar produto | Cadastro com **importação por link** (dropship), preço/preço-comparação/desconto, oferta relâmpago, nota e nº de avaliações (prova social), **vídeos de criadores**, modelo de landing |

Import de produto usa `import_product.php`, `import_produto_zip.php`, `tiktok_product_resolve.php`, `upload_creator_media.php`.

## 2. CHECKOUT (próprio, altamente customizável)
| Tela | Função |
|---|---|
| Construtor | Editor visual completo: banner desktop/mobile, cores, arredondamento, cronômetro, barra de avisos, avatares de prova social, CSS customizado |
| Produtos | Liga produto ↔ link de checkout |
| Pagamentos | Métodos (Pix, Cartão até 12x, Boleto, Paypal), gateway Pix por domínio, retentativa inteligente, taxa de parcelamento, descrição de fatura |
| Redirecionamento | URL pós-pagamento por vitrine |

## 3. GATEWAYS DE PAGAMENTO (todos plugáveis, por loja/domínio)
BlackCat · D2Bank · Fastsoftbrasil · GhostPay · IronPay · KeyClub · MagicPay · Mangofy · Mercado Pago · Nitro · Paradise · Pixo · Plowf · PrimeCash Brasil · Scalefy · Telegram · (+ Gateway Teste)
> Quase todos são gateways/adquirentes "de operação" brasileiros focados em Pix. Gateway Pix definível **por domínio**.

## 4. MARKETING / CONVERSÃO
- **Pixels** (`marketing_pixels`): central multi-plataforma, TikTok Events API, Access Token, Pixel Code
- **Order Bumps** + métricas próprias
- **Upsells / Upcell** (pós-checkout): gatilho, modo redirecionamento, domínio fixo, métricas
- **Recuperação de vendas**: e-mail de recuperação, lista de pedidos recuperados
- **Recompensas**: gamificação de faturamento (placas R$50K→1M, pulseira) — mecânica de engajamento estilo "clube"
- **Telegram Bots**: funil completo de venda de assinatura/VIP — presell, planos, upsell, downsell automático, PIX pendentes, gateway próprio, Events/Conversions API. (venda de acesso a grupo/canal via bot)

## 5. LOGÍSTICA
- **Fretes**: cadastro manual, Correios (Nacional), prazo, valor, imagem
- **Rastreios**: código, transportadora, cliente, domínio de rastreio próprio

## 6. ANÚNCIOS — TikTok Ads Central v2  ⭐ (núcleo, tela de 800KB)
Endpoints: `tiktok_ads_v2.php`, `tiktok_advanced.php`, `tiktok_catalog_csv.php`, `tiktok_catalog_feed.php`, `vcloak.php`

### 6a. A função que você descreveu (catálogo → campanha automática)
Confirmado pelos textos da própria ferramenta:
- "o sistema **cria o catálogo, sobe os vídeos e registra o feed no TikTok automaticamente**"
- "**Não é necessário fazer upload** de vídeos, imagens ou textos"
- **Catálogo DSA**: criativos vêm automaticamente do feed do catálogo; placement e otimização de compra automáticos
- **Smart+** (`/smart_plus/ad/create/`): TikTok otimiza e segmenta sozinho; modo Normal (`/ad/create/`) como fallback
- **ACO** (criativos dinâmicos): combina vídeos+textos testando combinações
- **Campanhas em Massa / Templates**: publica em várias contas com 1 clique; nº de campanhas/conjuntos/anúncios por conta configurável

### 6b. Automação industrial de contas (o que vai MUITO além de "facilitar campanha")
Ações de API confirmadas:
- **Business Centers em lote**: `bc_create_batch`, `bc_create_full`, `bc_transfer`, `bc_ban_stats`, `bc_removed_list`, `bc_restore`
- **Contas anunciantes em massa**: `bc_advertiser_create`, `account_add_manual`, `accounts_list`, `acc_rename`
- **Identidades em massa**: criar/deletar identidades de anúncio em lote
- **Rotação de contas**: `rotation_list`, `rotation_remove`
- **Recarga de conta / saldo**: `bc_balance_get`, `+ Recarga`
- **Planos de aquecimento (warmup)**: `warmup_create`, `warmup_list`, `warmup_cancel`
- **Pixels centralizados**: cria no BC e auto-compartilha com todas as contas (`bc_pixel_autolink`, `pixel_share_bc`, `pixel_create_bc`), Events API
- **Apelações em massa** de anúncios reprovados: `appeal_submit_all`, `rejected_ads_all`
- **Automação por regras**: `automation_rules_list/_toggle/_run` (scaling/kill automático)
- **Scaling**: `campaign_scale`, `scaling_suggestions`, calculadora ROAS, P&L, estimativa de alcance, audiências lookalike
- **Comentários**: moderação/ocultação automática por regras (`comment_rule_add`, `comment_bulk_action`)
- **Posts orgânicos / Spark**: `spark_post_lookup`, "Copiar Spark Code"

### 6c. Ponte com o cloaker
`cloacker_link_save`, `cloacker_links_list` + seção "Links Cloacker × Campanhas TikTok" — amarra cada campanha a um link cloaqueado. Também: "Suba um vídeo, escolha o modo de camuflagem e baixe o vídeo processado para usar como criativo" (burla detecção de criativo repetido/proibido).

## 7. ANÚNCIOS — Meta Ads
`meta_video_upload.php` — Catálogo de Vídeos, Feed de Catálogo, Links de Produto. Mesma lógica de catálogo, versão Meta (mais enxuta que a do TikTok).

## 8. CLOACKER ("Zero Gate")  ⭐
| Tela | Função |
|---|---|
| Campanhas de Cloaking | Cria campanha: escolhe página **black** (money) e **white** (safe) |
| Páginas | Cadastro das páginas black/white |
| Domínios | Cadastro, saúde/health, revalidar DNS, impressões (`zg_domain_health.php`) |
| Camuflagens | Processa vídeo pra despistar detecção |
| Logs | (redireciona; auditoria de tráfego) |

**Filtros de gate**: Países permitidos, IPs permitidos/bloqueados, ISPs bloqueados, User-Agents bloqueados, tokens obrigatórios na URL de origem.
**Mecânica**: white com presell anti-bot; conteúdo via iframe/redirect JS; payload JS que injeta a página de forma invisível + verificação de fingerprint pra pegar "bots avançados" (= robôs de revisão da plataforma). "IPs permitidos: sempre mostra black / bloqueados: nunca mostra black."

## 9. DASHBOARD / BI
Command Center (Live Dashboard): receita, faturamento, lucro estimado, gasto em ads, conversão, maior/menor venda, pagos/pendentes, chargeback, reembolso, parcelas. Mapa vivo (`led_visitors_live.php`) de visitantes/vendas em tempo real por região.

---

## Leitura de risco (pro seu contexto de payments/PIX)
- O ferramental de **rotação + recarga + warmup + apelação em massa de contas** e o **cloaker com anti-bot/fingerprint** são o kit clássico de operação "black hat"/gray de mídia — desenhado para **driblar a moderação** de TikTok/Meta, não é o Ads Manager comum.
- Gateways são majoritariamente Pix "de operação". Combinação cloaker + produto que não passa na análise = **alto índice de chargeback/MED** e risco de exposição do adquirente. É exatamente o perfil de fluxo que gera dor de compliance no lado que a Nerva/Atlas operam.
- A parte 100% "limpa" e vendável do produto é: **publicar catálogo e subir campanha no TikTok em lote sem montar criativo manual** + checkout/upsell/recuperação. Isso sozinho já é uma oferta forte.
