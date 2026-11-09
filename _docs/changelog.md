# Changelog

Funcionalidades entregues, da mais recente para a mais antiga. Atualize a cada push de funcionalidade nova, junto com os documentos afetados em [`docs/`](README.md).

Formato de cada entrada:

```
## AAAA-MM-DD
### Adicionado | Alterado | Corrigido | Removido
- Descrição curta (commit ou PR)
```

---

## 2026-11-09

### Adicionado

- IA: **o agente** (`ai/agent/runner.py`): `create_agent` do LangChain com `ModelCallLimitMiddleware` (8 iterações), `ModelFallbackMiddleware` (OpenAI → Groq `openai/gpt-oss-120b`) e um middleware próprio que conta as iterações e grava cada tool em `agent_steps` assim que ela termina, com log; prompts por modo; tempo máximo de 180 s. API `/agent/runs` (`POST` responde `202` e roda em segundo plano, histórico, detalhe com os passos; execução interrompida por deploy é fechada ao ler). Tools de escrita: `save_draft` (sempre `draft`, mesmas regras do formulário, liga o post à execução), `adapt_for_network` (limite e estilo de cada rede, sem IA) e `search_web` (Tavily, com fontes). 39 testes novos (219 no backend), com modelo de chat roteirizado. Primeira execução real local: 34 s, 5 tools, fontes citadas.
- Frontend: **indicador de saúde do sistema** no cabeçalho: consulta `GET /health/ready` a cada minuto (e ao voltar para a aba) e mostra Online, Instável (API no ar, banco fora: `503`), Offline (sem resposta) ou Demonstração (modo fictício); ao clicar, mostra a latência da API, o estado do banco, a hora da verificação e "Verificar agora". Espera até 70 s pela primeira resposta, porque a Render gratuita leva até um minuto para acordar. 3 testes de integração.
- Frontend: **saída automática por inatividade**: após 30 minutos sem atividade (mouse, teclado, toque, rolagem), o usuário sai da conta. No último minuto aparece o aviso "Você ainda está aí?" com contagem regressiva e "Continuar conectado". A última atividade fica no `localStorage`, compartilhada entre abas (atividade numa aba mantém as outras), e uma sessão deixada aberta (aba fechada, notebook suspenso) é encerrada ao voltar. A tela de login explica o motivo da saída. 6 testes de unidade.

### Alterado

- IA: o modelo de fallback do Groq passa a ser `openai/gpt-oss-120b`; o `llama-3.3-70b-versatile` foi retirado pelo Groq.
- Frontend: **Documentos e Agente ligados à API real**: os tipos (`ProjectDocument`, `AgentRun`, `AgentStep`, `AgentRunInput`) e os campos passam a ser os da API em inglês (`type`, `size_bytes`, `error_message`, `chunk_count`; `mode`, `request`, `response`, `steps`, `step_number`, `arguments`, `result_summary`, `duration_ms`, `started_at`, `finished_at`), e os nomes das tools nos rótulos e no agente fictício são os do backend (`search_documents`, `save_draft`…). Os dados do modo fictício no navegador mudam de versão (`v3`) para não quebrar com os campos antigos. Fluxo de documentos conferido contra o backend local (URL de upload → S3 → processamento → `ready`).

### Corrigido

- Testes do backend: as chaves de IA (`OPENAI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`) ficam vazias e o LangSmith desligado em todos os testes (`tests/conftest.py`), como no CI. Antes, três testes de validação de `/agent/runs` passavam na máquina com chaves no `.env` e falhavam no CI (`503` antes do `422`).

### Removido

- Frontend: **páginas de demonstração do TailAdmin** (grupo "Template (referência)" do menu e as rotas `/template/*`): 67 arquivos e 12 dependências usadas só por elas (`jsvectormap`, `leaflet`, `maplibre-gl`, `react-map-gl`, `prismjs`, `react-dnd`, `react-dnd-html5-backend`, `@popperjs/core`, `@floating-ui/react` e os `@types` correspondentes).

## 2026-11-08

### Alterado

- IA: **decisão 34**: agente com LangChain 1.x + LangGraph (`create_agent`), chat na OpenAI com fallback para o Groq, embeddings e imagem na OpenAI, Tavily e LangSmith; substitui o loop manual (decisões 1 e 4). Busca híbrida continua própria. Plano de implementação em `_docs/agente-e-rag.md`; CLAUDE.md, README e arquitetura atualizados.

### Adicionado

- IA: **busca híbrida e tools de leitura do agente**: `search_chunks` combina similaridade vetorial (pgvector, cosseno) e full-text em português (`websearch_to_tsquery` + `ts_rank`) com Reciprocal Rank Fusion, só nos documentos `ready` do projeto do usuário; tools `get_project`, `list_subjects`, `get_subject` (público e tom resolvidos), `search_documents` e `search_past_posts` (só aprovados e publicados), com `user_id` e `project_id` injetados pelo `ToolRuntime` do LangChain, fora do schema que o LLM vê. 32 testes novos (180 no backend).
- IA: **documentos para o RAG** (decisão 34): migration com `documents`, `chunks` (pgvector com índice HNSW e `tsvector` gerado com índice GIN), `agent_runs` e `agent_steps`; API `/documents` (URL de upload pré-assinada, processamento em segundo plano com extração de PDF/DOCX/TXT, chunking com sobreposição e embeddings da OpenAI, lista e exclusão); projeto com documentos não pode ser excluído (`409`). Novas dependências: `langchain`, `langchain-openai`, `langchain-groq`, `openai`, `pgvector`, `pypdf`, `python-docx`. 32 testes novos (148 no backend), com embeddings falsos e S3 simulado.
- Infra: **backend na Render** (`postpilot-apit.onrender.com`), web service a partir da imagem do GHCR (pacote público), plano gratuito em US East, ligado ao Neon (migrations aplicadas no primeiro deploy) e ao S3. Variáveis de produção documentadas em `_docs/implantacao.md`.

### Corrigido

- Frontend: o rewrite de `/api/*` no `vercel.json` aponta para o endereço real do serviço na Render (`postpilot-apit.onrender.com`).
- CI/CD: o `vercel deploy` roda a partir da raiz do repositório; de dentro de `frontend/`, a Vercel somava o Root Directory do projeto e procurava `frontend/frontend`. Primeira execução completa do pipeline na `main` (imagem, Render, Vercel e smoke test).
- Produção: as variáveis da Vercel tinham o `VITE_AUTH0_AUDIENCE` do domínio antigo (todas as chamadas davam `401`) e a connection string do Neon em `VITE_AUTH0_DB_CONNECTION`, o que a deixava no JavaScript público. Variáveis corrigidas, senha do Neon trocada e regra registrada em `_docs/implantacao.md` (segredo nunca em `VITE_*`).

## 2026-11-07

### Adicionado

- Infra: **Terraform da AWS** (`infra/terraform/`): bucket S3 do app (privado, SSE-S3, CORS só para o domínio de produção e `localhost:5173`, lifecycle de uploads incompletos), usuário IAM do backend com menor privilégio (objetos do bucket e `ListBucket`), Budget de US$ 5 por mês com alerta por e-mail e estado remoto num bucket próprio, com trava nativa do S3.
- Infra: contas da Neon (PostgreSQL 16 + pgvector), Render e Vercel; domínio `postpilot.jonas-rocha.com` (CNAME na Cloudflare para a Vercel, HTTPS da Vercel) e URLs de produção no Auth0.
- Backend: **imagem Docker** (`backend/Dockerfile`): dois estágios, `uv sync --locked --no-dev`, Python 3.12, usuário sem privilégios, porta da variável `PORT` e migrations antes do uvicorn. `.dockerignore` deixa de fora `.venv`, `.env`, testes e caches.
- Backend: **logs em JSON no stdout** com structlog (requisito 10): `request_id` (cabeçalho `X-Request-ID`, devolvido na resposta), `user_id` do token e uma linha por requisição (método, caminho, status e duração); uvicorn, Alembic e os loggers padrão saem no mesmo formato. `LOG_JSON=false` deixa os logs legíveis localmente. Nova dependência: `structlog`. Testes de unidade do middleware, inclusive que o token nunca é registrado (116 testes no backend).
- Frontend: **`vercel.json`** com o rewrite de `/api/*` para o backend na Render (`postpilot-apit.onrender.com`, mesma origem, sem CORS), fallback da SPA para `index.html` (rotas como `/posts` e o retorno do login em `/login` deixam de dar 404), cache longo para `/assets/*` e cabeçalhos de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`). Primeiro deploy manual com a Vercel CLI.
- CI/CD: **pipeline no GitHub Actions** (`.github/workflows/ci-cd.yml`): lint, typecheck e testes do backend (unidade e integração com Testcontainers) e do frontend, aceite com Playwright; na `main`, imagem do backend no GHCR (tag do SHA), deploy na Render (Deploy Hook com a imagem do commit) e na Vercel, e smoke test no ambiente publicado. Badge do pipeline no README.

### Alterado

- Backend: documentação da API em **`/api/docs`** (e `/api/openapi.json`), para funcionar atrás do rewrite `/api/*` da Vercel.
- Domínio de produção: **`postpilot.jonas-rocha.com`** no lugar de `projeto.jonas-rocha.com` (decisão 33), e nova API no Auth0 com o identificador `https://postpilot.jonas-rocha.com/api`.

### Corrigido

- Aceite: no teste de filtros dos posts, o filtro escolhido logo depois de "Limpar filtros" partia dos parâmetros antigos (`status=approved` voltava), porque a página renderiza depois da URL mudar; no runner do CI, mais lento, isso aparecia. Agora o teste espera a URL e o `<select>` voltar para "Todos" antes de seguir.

## 2026-11-06

### Adicionado

- Frontend: **texto arrastável no editor de arte**. Apertar sobre o texto na prévia e arrastar coloca o bloco em qualquer lugar da arte (com mouse ou toque); fora do texto, arrastar move a foto de fundo. O bloco nunca passa das margens de segurança (8%), o alinhamento continua valendo dentro dele e escolher Topo, Meio ou Base volta a uma posição fixa. No carrossel, um slide novo herda a posição. A posição livre vai junto na exportação.
- Testes: unidade da posição do bloco (fixa, livre, limitada às margens), integração do arraste no editor e aceite com o canvas de verdade (o mouse arrasta o texto e os pixels conferem onde ele foi desenhado).
- Frontend: **foto de fundo arrastável, como o texto**. Arrastar a prévia fora do texto leva a foto para qualquer lugar (o centro dela não sai da arte); o zoom vai de 20% a 300% (100% cobre a arte inteira). Quando a foto não cobre a arte, aparece a escolha da **cor em volta da imagem**, e **Cobrir a arte** volta ao padrão (100%, centralizada). "Escurecer" vale só sobre a foto. Antes, arrastar só mudava a parte visível de uma foto que sempre cobria a arte, e não fazia nada quando a foto tinha a proporção da arte.
- Testes: unidade da área da foto (cobrir, mover, zoom, limites), integração do arraste da foto e aceite com o canvas de verdade (a cor de fundo aparece acima da foto arrastada).
- Frontend: **variações por rede (mestre-detalhe na mesma tela, decisão 30)**. O post guarda o título e o assunto; cada rede marcada (LinkedIn, Instagram, X) vira uma aba com texto, formato, imagens (com o editor de arte), status e data próprios. Desmarcar uma rede e marcar de novo recupera o texto; uma aba com erro fica marcada e abre sozinha ao salvar. A lista mostra as variações de cada post (rede, formato, data e status, com link para a aba) e ganhou o filtro por rede; o calendário mostra uma entrada por variação, no dia dela, e abre o post na aba certa (`/posts/{id}?network=…`). API fictícia, MSW e dados de exemplo no novo formato.
- Testes: unidade do schema por variação, integração do mestre-detalhe (abas, status e data por rede, erro na aba certa, filtro por rede, `id` mantido por rede) e aceite do fluxo completo com duas variações, lista, calendário e edição.
- Frontend: página **Ideias** (`/ideas`, decisão 31): possíveis posts com anotações, assunto e redes sugeridas, criados pelo usuário ou sugeridos pelo agente; filtro abertas / viraram post; **Criar post** preenche o formulário a partir da ideia e, ao salvar, liga a ideia ao post.
- Frontend: página **Métricas** (`/metrics`, decisão 32): importação do CSV exportado do LinkedIn, Instagram ou X, com modelo para baixar, prévia com erros por linha, associação automática à variação publicada no mesmo dia (editável) e envio de tudo numa requisição.
- Testes: unidade do leitor de CSV e da leitura das métricas (colunas por rede, datas, números com separador de milhar, associação), integração das duas páginas (inclusive um teste que reproduz a associação quando os posts carregam depois do arquivo) e aceite do fluxo ideia → post publicado → importação das métricas.
- Backend: **variações por rede**. Tabelas `post_variations` (no máximo uma por rede, `UNIQUE (post_id, network)`) e `variation_images`; `POST`/`PUT /posts` recebem `variations` (o `PUT` casa pela rede e mantém o `id` de cada variação) e os filtros `status`, `network`, `from` e `to` valem para a mesma variação (`EXISTS`). As regras por rede passaram para o schema de cada variação. A migration transforma cada post existente numa variação, com as imagens na mesma ordem.
- Backend: **ideias** (`/ideas`, CRUD). `subject_id` e `post_id` precisam ser do mesmo projeto (`422`); apagar o post reabre a ideia e apagar o assunto mantém a ideia sem assunto (`ON DELETE SET NULL`). `source` é sempre `manual` pela API.
- Backend: **importação de métricas** (`POST /metrics/import`), tudo ou nada: cada linha precisa apontar para uma variação publicada do usuário, na rede informada; números negativos, datas sem fuso ou `published_at` depois de `collected_at` dão `422` com o número da linha. Nova tabela `metrics` (apagada junto com a variação).
- Testes do backend: integração de posts, ideias e métricas (inclusive autorização entre usuários) e da migration das variações com dados antigos.
- Testes do backend que faltavam: integração de **Subjects** (CRUD, `409` com posts, autorização) e de **Images** com o S3 simulado pelo **moto** (URL pré-assinada na pasta do projeto, arquivo não enviado, grande demais e apagado, chave de outra pasta, exclusão do objeto, projeto com imagens `409`, autorização), e unidade das regras por rede e da importação de métricas. Todos os recursos do backend têm testes de integração (111 testes no total). Nova dependência de desenvolvimento: `moto[s3]`.

### Corrigido

- Conexão local com o Docker no Windows: `localhost` falhava com `WinError 64` (no Alembic e no Testcontainers). O `.env.example` usa `127.0.0.1` e os testes definem `TC_HOST=127.0.0.1`.

## 2026-11-05

### Adicionado

- Backend: **autenticação com Auth0** (decisão 29). Toda rota da API exige `Authorization: Bearer <access token>`; o backend confere a assinatura RS256 com as chaves públicas do tenant (JWKS, em cache), o emissor (`iss`), a audiência (`aud`) e a validade (`exp`), e usa o `sub` do token como `user_id`. Token ausente ou inválido responde `401`; Auth0 fora do ar responde `503`. Novas variáveis `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` e `AUTH_DEV_USER` (só local).
- Backend: **verificação de saúde** sem autenticação: `GET /api/v1/health` (o processo responde) e `GET /api/v1/health/ready` (o banco responde a um `SELECT 1` em até 2 s; senão, `503`), para o health check da plataforma de hospedagem.
- Frontend: **logo do PostPilot**: avião de papel com rastro e um brilho (a IA), no azul da marca. Aparece no menu lateral (só o símbolo quando recolhido), nas telas de login e cadastro e como favicon (`favicon.svg`).

### Alterado

- Implantação planejada: **Vercel** (frontend), **Render** (backend) e **Neon** (PostgreSQL), no lugar da VPS com k3s (decisão 28). Deploy só pelo GitHub Actions, depois do lint e dos testes.
- `.gitignore` ignora `node_modules/` em qualquer pasta (antes, só na raiz).

### Corrigido

- Backend: o download das chaves públicas do Auth0 (JWKS) usa o repositório de certificados do sistema operacional (`truststore`). Com o OpenSSL padrão do Python, falhava com `certificate has expired` (resposta `503`) atrás de antivírus com inspeção de HTTPS, por causa de raízes vencidas no repositório do Windows.

### Testes

- Backend: **pytest** com testes de unidade da autenticação (validação do JWT com chaves RSA geradas no teste, sem rede) e da verificação de saúde, e testes de integração de **Projects** com **Testcontainers** (PostgreSQL + pgvector de verdade, esquema pelas migrations), incluindo autorização entre usuários. Documentado em [testes](testes.md).

### Removido

- `frontend/public/favicon.png` (era um PNG declarado como SVG no `index.html`).

## 2026-11-04

### Adicionado

- Frontend: **editor de arte** para post de imagem única (decisão 26). Abre pelo botão "Criar arte" do formulário do post, com a arte no tamanho da rede (Instagram 1080 × 1350 ou 1080 × 1080; LinkedIn 1200 × 1200, 1080 × 1350 ou 1200 × 627; X 1600 × 900 ou 1080 × 1080). O fundo pode ser uma cor ou uma imagem da biblioteca, recortada para cobrir a arte sem distorcer, com zoom, ajuste da parte visível (arrastando ou pelos controles) e escurecimento. O texto tem fonte, cor, alinhamento e posição fixa (topo, meio, base), e a fonte diminui sozinha quando o texto não cabe. "Usar no post" exporta a arte (PNG, ou JPEG quando o fundo é foto), envia para a biblioteca do projeto pelo fluxo de upload que já existia e a escolhe como imagem do post. Sem mudança no backend.
- Frontend: **carrossel no editor de arte**. Com o formato carrossel, o editor cria vários slides no mesmo tamanho, cada um com o próprio fundo e texto: novo slide (mesmo visual, sem texto), duplicar, remover e mudar a ordem, com miniaturas. "Usar no post" envia os slides para a biblioteca, um a um e na ordem, e os coloca no fim do carrossel, respeitando o máximo da rede (20 no Instagram e no LinkedIn, 4 no X). Se um envio falhar, tentar de novo não reenvia os slides que já foram. "Baixar slides" baixa um arquivo numerado por slide.
- Frontend: botão **Baixar imagem** no editor de arte, para quem só quer a imagem (publicar fora do PostPilot): baixa o arquivo (`postpilot-{rede}-{largura}x{altura}.png` ou `.jpg`) sem salvar nada na biblioteca.
- Frontend: o envio de imagem aceita uma descrição. A arte é salva com o próprio texto, que vira o texto alternativo.
- Testes: unidade dos cálculos da arte (quebra de linha, ajuste da fonte, recorte), integração do editor no formulário do post e aceite com o canvas de verdade (cores dos pixels, recorte da foto, exportação e upload), nos dois modos.

### Alterado

- Formulário do post: o texto do post (editor) passa a vir depois da imagem e do botão "Criar arte", já que a arte costuma ser feita primeiro.

### Corrigido

- Testes do frontend: limite de tempo por teste de 15 s. Os fluxos longos de formulário passavam dos 5 s padrão quando todos os arquivos rodavam em paralelo.

## 2026-11-03

### Adicionado

- Post com rede e formato (decisão 25): `network` e `format` no post, carrossel com várias imagens em ordem (`post_images`, migration `post network, format and images`) e regras por rede validadas no backend e no formulário.
- Frontend: formulário de post com escolha de rede e formato, editor de texto (emoji, marcador, hashtag, contador e prévia no feed), data no calendário (flatpickr, no formato do idioma) e seleção de várias imagens com reordenação. Lista e calendário mostram a rede e o formato.
- Frontend: página `/best-practices` (menu "Boas práticas"), só leitura: princípios gerais e, para Instagram, LinkedIn e X, tamanhos de post único e carrossel, limites de texto, hashtags, boas práticas, frequência, métricas e fontes de inspiração (pt-BR e en). Revisada em novembro de 2026.
- Frontend: teste de traduções confere também o tamanho das listas nos dois idiomas.
- Testes do frontend (decisão 24, ver `testes.md`): 35 de unidade e 20 de integração (Vitest, Testing Library, MSW com API falsa) e 5 de aceite (Playwright, desktop e celular), rodando com a API fictícia ou contra a stack completa.
- API: filtros `status`, `from` e `to` em `GET /posts`. O calendário busca só o mês visível e o filtro de status da lista de posts passa a funcionar com a API real.
- Frontend: modais com `role="dialog"` e botão de fechar com rótulo (acessibilidade).
- API: biblioteca de imagens por projeto (`/api/v1/images`): URL pré-assinada de upload, registro depois do envio (confere chave, existência e tamanho no S3), listagem com URL de leitura e exclusão (`409` se algum post usa). Migration `image library per project`.
- API: `image_id` no post (imagem da biblioteca do projeto do assunto, `422` caso contrário) e `409` ao excluir projeto com imagens.
- Backend: cliente S3 (boto3) em `storage/s3.py` e variáveis `S3_*`; LocalStack no `docker-compose.yaml` como S3 local, com o bucket e o CORS criados por `infra/localstack/init-s3.sh` (decisão 23).
- Backend: CORS configurável (`CORS_ORIGINS`) para o Vite em desenvolvimento.
- Frontend: projetos, assuntos, posts e imagens ligados à API real (com `VITE_API_URL`).
- Frontend: página `/images` (biblioteca do projeto) e seletor de imagem no formulário do post (decisão 22). Status `review` nos posts.
- Frontend: menu reordenado (Dashboard, Projetos, Assuntos, Posts, Imagens, Calendário | Documentos, Agente, Execuções | Perfil).

- Backend: FastAPI, conexão assíncrona com o PostgreSQL (SQLAlchemy + asyncpg), configuração por `.env` (pydantic-settings) e Alembic com a primeira migration (`projects`, `subjects`, `posts`, `images`).
- API: CRUD de projetos (`/api/v1/projects`), filtrado pelo dono e com `409` ao excluir projeto com assuntos. Usuário fixo `dev-user` até a integração com o Auth0 (dependência `get_current_user_id`).
- Ambiente local: Postgres do Docker na porta `5433`, para não conflitar com um PostgreSQL instalado no Windows.

### Corrigido

- Frontend: rótulos "Conteúdo" do formulário de post (estavam em `calendar.details`) e textos que ainda falavam de variações.

### Alterado

- Frontend: URLs das páginas em inglês (`/projects`, `/subjects`, `/images`, `/calendar`, `/documents`, `/agent/runs`, `/profile`, `/signup`, `/error`) e campos, valores de enum e rotas da API em inglês, como o backend (decisão 21).
- Frontend: post sem variações por rede por enquanto (um `content` por post); imagens e métricas por variação saíram da tela do post.
- Código, banco e API em inglês; português só na interface (decisão 20). `modelo-de-dados.md`, `api.md`, `agente-e-rag.md`, `arquitetura.md`, `frontend-rotas.md` e `implantacao.md` atualizados com os novos nomes, e glossário domínio ↔ código no modelo de dados.
- Documentação movida de `docs/` para `_docs/`.
- Post ganhou o status `review` (aguardando revisão), entre `draft` e `approved`, como enum do Postgres (`post_status`). IDs passam a ser UUID.

## 2026-10-28

### Adicionado

- Frontend: imagens e métricas na aba de cada variação do post (`/posts/:id`). Imagens: envio direto para o S3 (PNG, JPG, WebP até 5 MB, até 10 por variação), formato pela proporção, ampliação com o prompt das geradas pelo agente e exclusão. Métricas: resumo da última coleta (impressões, interações, engajamento), histórico, registro com validação (só com o post publicado) e exclusão de coleta.
- Frontend: o rascunho salvo pelo agente fictício já vem com a imagem gerada em cada variação.
- Docs: contratos de imagens e métricas em `api.md` (decisão 19).

### Alterado

- Frontend: depois de criar um post, a tela abre o próprio post (para adicionar imagens) em vez da lista.
- API: no `PUT /posts/{id}`, a variação de uma rede que continua mantém o `id`; remover a variação apaga as imagens e métricas dela.

## 2026-10-27

### Adicionado

- Frontend: template TailAdmin em `frontend/`, com erros de lint corrigidos e dependências sem vulnerabilidades.
- Frontend: autenticação com Auth0 (`/login`, `/cadastro`, rotas protegidas, sair) e usuário fictício em desenvolvimento.
- Frontend: páginas `/dashboard` (resumo de posts, desempenho por rede, assunto, dia e horário, próximos posts e execuções do agente, com dados de exemplo), `/perfil` (dados do usuário e alteração de senha), `/erro` e 404 em português.
- Frontend: rotas carregadas sob demanda e marca PostPilot no lugar da TailAdmin.
- Frontend: interface em português e inglês, com seletor de idioma no cabeçalho (no lugar das notificações) e nas telas de login e cadastro.
- Frontend: página `/calendario` com os posts pela data prevista, cor por status e modal de detalhes (dados de exemplo).
- Frontend: CRUD de projetos (`/projetos`, `/projetos/novo`, `/projetos/:id`) com validação (React Hook Form + Zod), exclusão com confirmação e tratamento do `409`, e seletor de projeto no cabeçalho no lugar da busca. Telas de conteúdo mostram um convite quando não há projetos.
- Frontend: camada de API com TanStack Query, envio do token do Auth0 e API fictícia para desenvolvimento sem backend.
- Frontend: CRUD de assuntos (`/assuntos`) com voz da marca herdada do projeto quando os campos ficam vazios, e exclusão bloqueada (`409`) quando há posts.
- Frontend: CRUD de posts (`/posts`) com filtros por status e assunto na URL e **tela mestre-detalhe** (`/posts/novo`, `/posts/:id`): dados do post e uma variação por rede em abas, com contador e validação do limite de caracteres de cada rede.
- Frontend: calendário passa a mostrar os posts do projeto, e "Abrir post" leva ao formulário do post.
- Frontend: `/documentos` com upload por arrastar-e-soltar (PDF, DOCX, TXT até 10 MB) direto para o S3 via URL pré-assinada, barra de progresso e status de processamento atualizado automaticamente.
- Frontend: `/agente` (conversa nos modos Ideação e Criação, com os passos aparecendo ao vivo e link para o rascunho salvo), `/agente/execucoes` (histórico) e `/agente/execucoes/:id` (passo a passo com tools, argumentos, duração e erros).
- Docs: execução do agente em segundo plano com consulta periódica (decisão 18) e contratos de documentos e execuções em `api.md`.
- Documentação técnica em `docs/`: arquitetura C4, modelo de dados, agente e RAG, API, implantação, registro de decisões e este changelog.

### Alterado

- Modelo de dados: nova entidade **Projeto** (marca ou cliente) acima de assuntos, documentos e execuções do agente; API, agente, RAG e rotas atualizados nos documentos (decisões 14 a 16).
- Frontend passa a usar o template TailAdmin no lugar de shadcn/ui (ver [decisão 8](decisoes.md)).

## Versão inicial

### Adicionado

- README com visão geral, requisitos do TCC e plano de entregas.
- CLAUDE.md com stack, convenções e ordem de corte.
