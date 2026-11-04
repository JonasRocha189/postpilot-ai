# CLAUDE.md

Guia para o Claude Code trabalhar neste repositório.

## Visão geral

**PostPilot** (nome provisório) é um gerador de posts para redes sociais com agente de IA e RAG, desenvolvido como TCC da pós-graduação em Desenvolvimento FullStack e como projeto de portfólio.

O usuário cria **projetos** (a própria marca ou cada cliente, com público-alvo e tom de voz padrão) e, dentro de cada projeto, cadastra **assuntos**, sobe **documentos** (PDF, DOCX, TXT) e conversa com um **agente** que:

- **Modo Ideação:** sugere temas pesquisando a web, o histórico de posts e o desempenho dos posts anteriores.
- **Modo Criação:** escreve o post usando RAG nos documentos, exemplos de posts aprovados (voz da marca), adapta o texto para cada rede e gera a imagem.

O usuário registra as **métricas** dos posts publicados, e um **relatório de desempenho** alimenta as sugestões do agente.

**Prazo:** 20 dias. Priorize sempre o que atende aos requisitos do TCC (ver "Requisitos" e "Ordem de corte").

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS, template TailAdmin (versão gratuita; não misturar com shadcn/ui), React Router, TanStack Query, React Hook Form + Zod, ApexCharts (já vem no TailAdmin) |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2.x (async), Alembic, Pydantic v2, pydantic-settings |
| Banco | PostgreSQL 16 + pgvector (índice HNSW) + full-text search (`tsvector`) para busca híbrida |
| IA | LLM com tool calling via SDK oficial (provedor **a definir**, atrás de abstração), embeddings, geração de imagem, busca web via Tavily ou Brave |
| Autenticação | Auth0 (OAuth 2.0 / OIDC, Authorization Code + PKCE no frontend, validação de JWT no backend) |
| Arquivos | AWS S3 (bucket privado, URLs pré-assinadas) |
| Infra | VPS Hostinger (2 vCPU, 8 GB RAM, Ubuntu 24.04) com k3s, Traefik, cert-manager + Let's Encrypt |
| IaC | Terraform (AWS: S3, IAM, Budget), Ansible (VPS), Helm (aplicação) |
| CI/CD | GitHub Actions, imagens no GitHub Container Registry (GHCR) |
| Testes | pytest, Vitest + Testing Library, Testcontainers (`pgvector/pgvector`), moto/LocalStack, Playwright |
| Qualidade | Ruff, mypy, ESLint, Prettier, pre-commit |

**Não use LangChain nem LlamaIndex.** O loop do agente é implementado manualmente com tool calling do SDK, por decisão de aprendizado.

**Domínio de produção:** `https://projeto.jonas-rocha.com` (`/` frontend, `/api` backend). A home `jonas-rocha.com` não pertence a este projeto.

## Estrutura do repositório

```
.
├── backend/
│   ├── app/
│   │   ├── api/            # routers FastAPI (um arquivo por recurso)
│   │   ├── core/           # config, segurança (JWT Auth0), logging
│   │   ├── db/             # sessão, base, migrations (Alembic)
│   │   ├── models/         # modelos SQLAlchemy
│   │   ├── schemas/        # schemas Pydantic
│   │   ├── services/       # regras de negócio
│   │   ├── repositories/   # acesso a dados
│   │   ├── ai/
│   │   │   ├── providers/  # LLMProvider, EmbeddingProvider, ImageProvider + implementações
│   │   │   ├── agent/      # loop do agente, prompts por modo, registro de tools
│   │   │   ├── tools/      # uma tool por arquivo
│   │   │   └── rag/        # extração, chunking, VectorStore (PgVectorStore)
│   │   ├── storage/        # cliente S3, URLs pré-assinadas
│   │   └── main.py
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── conftest.py
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── features/       # assuntos, posts, documentos, agente, relatorio
│   │   ├── lib/            # cliente da API, auth
│   │   └── main.tsx
│   ├── tests/
│   ├── package.json
│   └── Dockerfile          # multi-stage: build Node → nginx
├── e2e/                    # testes de aceite Playwright
├── infra/
│   ├── terraform/          # S3, IAM, Budget, estado remoto
│   ├── ansible/            # provisionamento da VPS (k3s, firewall, usuários)
│   └── helm/postpilot/     # chart da aplicação
├── .github/workflows/
├── docker-compose.yml      # ambiente local
└── CLAUDE.md
```

## Comandos

```bash
# Ambiente local completo (Postgres + pgvector, S3 simulado, backend, frontend)
docker compose up -d

# Backend
cd backend
uv sync                                  # instalar dependências
uv run alembic upgrade head              # aplicar migrations
uv run alembic revision --autogenerate -m "descricao"
uv run fastapi dev main.py               # http://localhost:8000/docs
uv run pytest tests/unit
uv run pytest tests/integration          # requer Docker (Testcontainers)
uv run ruff check . && uv run ruff format . && uv run mypy app

# Frontend
cd frontend
npm ci
npm run dev
npm run test
npm run lint && npm run typecheck

# Testes de aceite
cd e2e && npx playwright test

# Infra
cd infra/terraform && terraform plan
helm lint infra/helm/postpilot
helm template infra/helm/postpilot      # revisar manifests antes de aplicar
```

Se um comando acima ainda não existir, crie-o seguindo este padrão e atualize esta seção.

## Modelo de dados

Nomes em inglês (classe / tabela). Detalhes e glossário em `_docs/modelo-de-dados.md`. Todas as entidades de usuário têm `user_id` (o `sub` do Auth0), `created_at` e `updated_at`.

- **Project** / `projects`: name, description, target_audience, voice_tone (padrão). CRUD completo. Topo da hierarquia: a marca do usuário ou um cliente. Exclusão só sem subjects e documents (`409`).
- **Subject** / `subjects`: project_id, name, description, target_audience e voice_tone **opcionais** (vazios = valem os do projeto). CRUD completo.
- **Post** / `posts`: title, subject_id, content, status (`draft`, `review`, `approved`, `published`), expected_date, image_id (opcional, da biblioteca do projeto). CRUD completo. Sem `project_id`: o projeto vem do subject.
- **PostVariation** / `post_variations`: post_id, network (`linkedin`, `instagram`, `x`), text, hashtags, char_count. **Detalhe de Post** (tela mestre-detalhe).
- **Image** / `images`: project_id, key, content_type, description. **Biblioteca de imagens do projeto**; o post escolhe uma (`posts.image_id`). Exclusão só se nenhum post usa (`409`).
- **Metric** / `metrics`: variation_id, published_at, impressions, likes, comments, shares, clicks, collected_at.
- **Document** / `documents`: project_id, name, s3_key, type, status (`pending`, `processing`, `ready`, `error`).
- **Chunk** / `chunks`: document_id, content, embedding (`vector`), search_vector (`tsvector`). `ON DELETE CASCADE` a partir de Document.
- **AgentRun** / `agent_runs` (com project_id) e **AgentStep** / `agent_steps`: registro de cada execução e de cada tool chamada, exibido na tela.

No banco, salve **apenas a chave do objeto S3** (ex.: `users/{id}/projects/{id}/posts/{id}/{uuid}.png`), nunca a URL.

**Escopo por projeto:** listagens de subjects, posts, documents, relatório e execuções exigem `project_id`, e o backend sempre confere se o projeto pertence ao usuário do token. No frontend, o projeto atual vem do seletor no cabeçalho.

## Agente

- Loop: o LLM recebe o pedido e as tools, decide qual chamar, recebe o resultado e repete até responder.
- **Máximo de 8 iterações** por execução. Ao atingir o limite, encerre e informe o usuário.
- Prompts de sistema separados para **Ideação** (`ideation`) e **Criação** (`creation`), em `app/ai/agent/prompts/`.
- Tools (uma por arquivo em `app/ai/tools/`, com schema de entrada em Pydantic):
  - `search_web(query)`: Tavily ou Brave, sempre retornando as fontes
  - `get_project()`, `list_subjects()` e `get_subject(id)` (público e tom resolvidos: do subject ou, se vazios, do projeto)
  - `search_documents(query)`: RAG híbrido (vetorial + full-text)
  - `search_past_posts(subject)`: exemplos de estilo, apenas posts `approved` ou `published`
  - `analyze_performance()`: agregados de métricas por subject, dia, horário, rede e imagem
  - `adapt_for_network(text, network)`: limites e formato de cada rede
  - `generate_image(prompt, format)`: sem texto dentro da imagem
  - `save_draft(post)`
- **Toda tool recebe o `user_id` e o `project_id` do contexto** (token e projeto validado na requisição), nunca do LLM. O LLM jamais escolhe de qual usuário ou projeto ler dados.
- O agente **só salva como `draft`**. Aprovar e publicar é sempre ação do usuário.
- Cada passo (tool, argumentos, duração, erro) vira log estruturado e um registro em `AgentStep`.
- Recomendações de desempenho só com amostra mínima (5 posts por grupo). Abaixo disso, o agente deve dizer que os dados são insuficientes.

## Provedores de IA

- O código do agente depende **apenas das interfaces** `LLMProvider`, `EmbeddingProvider`, `ImageProvider` e `VectorStore`, nunca de um SDK diretamente.
- O provedor de LLM ainda **não foi decidido**. Não acople nada a um provedor específico fora de `app/ai/providers/`.
- Trocar o modelo de embeddings exige reprocessar todos os chunks. A dimensão do vetor vem da configuração.

## RAG

1. O frontend pede ao backend uma URL pré-assinada de upload (o backend valida tipo e tamanho).
2. O arquivo vai **direto do navegador para o S3**.
3. O backend é avisado, baixa o arquivo, extrai o texto (pypdf, python-docx), faz chunking, gera embeddings e grava em `Chunk`.
4. A busca combina similaridade vetorial e full-text, sempre filtrando por `user_id` e `project_id`.

## Convenções

- **Idioma:** código, banco e API em **inglês**: classes, tabelas, colunas, valores de enum, rotas e campos da API (`/api/v1/subjects`, `subject_id`), nomes de tools e comentários. URLs das páginas também em inglês (`/subjects`, `/posts/new`). **Português** só nos textos da interface (via i18n). A documentação em `_docs/` fica em português, citando os identificadores em inglês. Ver decisões 20 e 21 em `_docs/decisoes.md`.
- **Interface multilíngue (pt-BR e en):** i18next. Nenhum texto de interface fica fixo no componente: todo texto novo entra em `frontend/src/locales/pt-BR/app.json` **e** `frontend/src/locales/en/app.json` (namespace `app`), e é lido com `useTranslation("app")`. Números e datas usam `useFormat()` (`src/lib/format.ts`). pt-BR é o idioma padrão.
- **Backend:** routers finos, regra de negócio em `services/`, acesso a dados em `repositories/`. Tipagem completa (mypy sem erros). Funções assíncronas para I/O.
- **API:** REST, prefixo `/api/v1`, erros no formato `{"detail": ...}`. Documentação via OpenAPI do FastAPI.
- **Frontend:** componentes funcionais com TypeScript estrito; chamadas à API apenas via TanStack Query em `features/*/api.ts`; validação de formulário com Zod; layout responsivo desde o início (mobile-first).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `infra:`).
- **Migrations:** toda mudança de modelo vem com migration Alembic revisada à mão.

## Os 12 fatores neste projeto

- **Configuração** só por variáveis de ambiente (pydantic-settings). Mantenha `.env.example` atualizado. Nunca commite `.env`, chaves ou kubeconfig.
- **Segredos** em produção ficam em Secrets do Kubernetes e no GitHub Secrets.
- **Logs** em JSON no stdout (structlog), com `request_id` e `user_id` quando houver. Nunca grave logs em arquivo. Nunca registre tokens, chaves ou conteúdo completo de documentos.
- **Dependências** declaradas e travadas (`uv.lock`, `package-lock.json`).
- **Processos sem estado:** nada de arquivos em disco local. Tudo que persiste vai para o Postgres ou o S3.

## Testes

- **Unidade:** services, tools, chunking, adaptação por rede, cálculo de métricas. Rápidos, sem rede e sem banco.
- **Integração:** API + Postgres real via Testcontainers (`pgvector/pgvector`), S3 via moto ou LocalStack.
- **Aceite:** Playwright cobrindo os fluxos principais: CRUD de assunto, mestre-detalhe de post, upload de documento, geração pelo agente, relatório.
- **LLM, embeddings, imagem e busca web sempre mockados nos testes.** Nenhum teste do pipeline pode chamar API paga ou depender de rede externa. Use respostas gravadas e determinísticas.
- Testes de autorização: para cada recurso, verifique que um usuário não acessa dados de outro.
- Ao corrigir um bug, escreva primeiro o teste que reproduz o problema.

## CI/CD

Pipeline no GitHub Actions:
1. Lint e typecheck (backend e frontend)
2. Testes de unidade e integração
3. Build das imagens Docker e push para o GHCR (apenas na `main`)
4. Deploy com `helm upgrade --install` no k3s
5. Testes de aceite contra o ambiente publicado

## Infraestrutura

- **k3s na VPS:** frontend (nginx), backend (FastAPI, 2 réplicas) e PostgreSQL (StatefulSet com volume persistente). Todo Deployment define `requests` e `limits` de CPU e memória.
- **Ingress (Traefik):** host `projeto.jonas-rocha.com`, `/` para o frontend e `/api` para o backend. HTTPS via cert-manager.
- **Backup:** CronJob com `pg_dump` enviando para o S3.
- **AWS (Terraform):** bucket privado com Block Public Access, SSE-S3, CORS liberando apenas o domínio de produção (e `localhost` em dev), lifecycle para uploads incompletos; usuário IAM com menor privilégio (`GetObject`, `PutObject`, `DeleteObject` só neste bucket); AWS Budget com alerta.
- Não altere recursos de infraestrutura em produção sem mostrar antes o `terraform plan` ou o `helm diff`/`helm template`.

## Requisitos do TCC (não podem ser quebrados)

1. Acesso via navegador, responsivo
2. Persistência em banco relacional (PostgreSQL)
3. OAuth para autenticação e autorização das APIs (Auth0)
4. Backend expõe API consumida pelo frontend
5. Controle de versão na internet (GitHub)
6. CI/CD com build, testes, publicação e artefatos de IaC
7. Implantação em nuvem
8. Declaração e isolamento de dependências
9. Configuração por variáveis de ambiente
10. Logs como fluxo de eventos (stdout)
11. Testes de unidade, integração e aceite
12. Ciclo de vida do usuário (cadastro, alteração de credenciais), via Auth0
- **CRUD completo:** Projeto, Assunto e Post
- **Mestre-detalhe na mesma tela:** Post → Variações por rede
- **Recurso de IA:** agente com RAG, busca web e geração de imagem

## Fora do escopo

- Publicação automática nas redes sociais e integração com APIs de analytics (roadmap)
- Fine-tuning / LoRA (roadmap)
- ArgoCD, service mesh (roadmap)
- Banco vetorial separado (Pinecone etc.): usar pgvector

## Ordem de corte (se o prazo apertar)

1. Importação de métricas por CSV
2. Resumo do relatório gerado por IA
3. Geração de imagem
4. Relatório de desempenho

O núcleo (CRUDs, mestre-detalhe, RAG, agente, OAuth, CI/CD, testes, deploy) nunca é cortado.

## Como trabalhar neste repositório

- Prazo para finalizacao 15/11/2026: prefira a solução mais simples que atenda aos requisitos do TCC.
- Não adicione dependências sem necessidade clara; se adicionar, explique o motivo.
- Mantenha o README e este arquivo atualizados quando mudar comandos, estrutura ou decisões.
- A documentação técnica fica em `_docs/` (índice em `_docs/README.md`). Todo push de funcionalidade nova atualiza `_docs/changelog.md` e os documentos afetados; decisões novas entram em `_docs/decisoes.md`.
