# Testes

> Status: **frontend coberto** (unidade, integração e aceite). **Backend coberto** (180 testes): unidade (autenticação, verificação de saúde, log das requisições, regras por rede e da importação de métricas, extração de texto, chunking e configuração dos embeddings, fusão RRF e o schema das tools que o LLM vê) e integração com PostgreSQL de verdade de todos os recursos (Projects, Subjects, Posts com variações, Images e Documents com S3 simulado, Ideas, importação de métricas), da busca híbrida, das tools de leitura do agente e da migration das variações.

Requisito do TCC: testes de **unidade, integração e aceite**. Nenhum teste chama API paga nem depende de rede externa.

## Visão geral

| Tipo | Ferramenta | Onde | O que cobre | Comando |
| --- | --- | --- | --- | --- |
| Unidade | Vitest | `frontend/src/**/*.test.ts` | Funções puras: datas (`lib/format`), schema do post, hashtags e contagem de caracteres, tipos de imagem, cálculos da arte (quebra de linha, ajuste da fonte, recorte), cliente HTTP (`apiFetch`: erros, `204`, token) e paridade das traduções pt-BR/en | `cd frontend && npm run test` |
| Integração | Vitest + Testing Library + MSW | `frontend/src/test/integration/` | Páginas de verdade (TanStack Query, roteador, projeto atual) chamando os services `http` contra uma **API falsa em memória** (`src/test/fakeApi.ts`) com as mesmas regras do backend: escopo por projeto, `404`, `409`, `422` e upload para o S3 por URL pré-assinada | `cd frontend && npm run test` |
| Unidade (backend) | pytest | `backend/tests/unit/` | Validação do JWT do Auth0 (token válido, expirado, de outra audiência ou emissor, sem `sub`, assinado por outra chave, `alg: none`, sem token com e sem usuário de desenvolvimento, Auth0 fora do ar → `503`) e verificação de saúde (banco no ar e fora) | `cd backend && uv run pytest tests/unit` |
| Integração (backend) | pytest + Testcontainers | `backend/tests/integration/` | A API de verdade (HTTP → router → SQLAlchemy) contra **PostgreSQL + pgvector num contêiner**, com o esquema criado pelas migrations: CRUD, validações (`422`), `409` e **autorização** (um usuário nunca lê, altera ou apaga dados de outro: `404`) | `cd backend && uv run pytest tests/integration` (Docker ligado) |
| Aceite (E2E) | Playwright | `e2e/tests/` | Fluxos completos no navegador: login, projeto → assunto → imagem → post com imagem → filtros → calendário → exclusões (com os `409`), validação de formulários e uso no celular | `cd e2e && npx playwright test` |

## Unidade e integração (Vitest)

- Configuração em `frontend/vitest.config.ts` (ambiente `jsdom`). O teste roda em modo **http**: `VITE_API_URL=http://api.test`, e o MSW responde (`onUnhandledFrame: "error"`, então qualquer chamada sem handler falha o teste).
- `src/test/fakeApi.ts`: handlers do MSW que imitam o FastAPI, com dados em memória, um **log das requisições** (para conferir URL, query string e corpo) e helpers para preparar dados (`addProject`, `addSubject`, `addPost`, `addImage`).
- `src/test/render.tsx`: `renderPage()` monta a página como no app (QueryClient novo por teste, `createMemoryRouter`, `ProjetoAtualProvider`, `ExigeProjeto`) e expõe a URL atual para conferir navegação.
- O jsdom não tem `<canvas>`: o teste de integração do editor de arte (`src/test/integration/art.test.tsx`) substitui só o módulo de desenho (`features/arte/canvas.ts`) e confere o resto (tamanho, escolhas, upload e corpo do post). Os cálculos (quebra de linha, ajuste da fonte, recorte) têm teste de unidade em `features/arte/layout.test.ts`, e o desenho real é conferido no aceite (`e2e/tests/artwork.spec.ts`, pela cor dos pixels), para imagem única e carrossel.
- Limite de 15 s por teste (`testTimeout`), porque os fluxos longos de formulário passam dos 5 s padrão quando os arquivos rodam em paralelo.
- O teste de traduções (`src/locales/locales.test.ts`) falha se uma chave existir só em um idioma ou se os `{placeholders}` forem diferentes.

## Backend (pytest)

```
backend/tests/
├── conftest.py          # para todos: variáveis do Auth0 fixas (não depende do .env)
├── unit/                # sem banco e sem rede
│   ├── test_auth.py
│   ├── test_health.py
│   ├── test_post_rules.py   # regras por rede (formato, limite de texto, imagens) e da importação de métricas
│   ├── test_rag.py          # extração (PDF, DOCX, TXT), chunking com sobreposição, modelo de embeddings
│   ├── test_rrf.py          # Reciprocal Rank Fusion
│   ├── test_tool_schemas.py # o que o LLM vê de cada tool: nunca user_id, project_id ou runtime
│   └── test_request.py      # logs JSON: request_id (cabeçalho X-Request-ID), user_id, 500 e token nunca registrado
└── integration/
    ├── conftest.py          # contêiner do Postgres, migrations, cliente HTTP, limpeza
    ├── test_projects.py
    ├── test_subjects.py     # CRUD, 409 com posts, autorização
    ├── test_images.py       # S3 simulado (moto): URL pré-assinada, arquivo não enviado ou grande demais, exclusão do objeto
    ├── test_posts.py        # variações: regras por rede, filtros na mesma variação, id mantido no PUT
    ├── test_ideas.py        # ligação com o post, ON DELETE SET NULL
    ├── test_metrics.py      # importação tudo ou nada
    ├── test_documents.py    # URL de upload, processamento em segundo plano (ready/error), reprocessar, 409, 422, 503, autorização
    ├── test_search.py       # busca híbrida no pgvector: termos (com redução em português), significado, escopo
    ├── test_read_tools.py   # tools de leitura: voz resolvida, ids inválidos, isolamento entre projetos e usuários
    └── test_migrations.py   # dados antigos viram variações (downgrade → insert → upgrade)
```

- `tests/conftest.py` define `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` e `AUTH_DEV_USER` (vazio) antes de qualquer import, então o resultado não depende do `.env` de quem roda, e o CI (sem `.env`) funciona igual.
- **Autenticação (unidade):** o teste faz o papel do Auth0: gera um par de chaves RSA e assina os tokens. O cliente JWKS é trocado por um falso (`monkeypatch`) que devolve a chave pública, sem rede. A dependência é testada num app mínimo (`/me`), sem banco.
- **Integração:** um contêiner `pgvector/pgvector:pg16` por execução (Testcontainers), com `alembic upgrade head`, então as migrations também são testadas. Cada teste começa com as tabelas vazias (`TRUNCATE`). O usuário vem do cabeçalho `X-Test-User` (padrão `user-a`), o que permite agir como dois usuários no mesmo teste; o JWT em si fica com os testes de unidade.
- Os testes assíncronos usam o plugin do **anyio** (já vem com o FastAPI) e o `httpx.AsyncClient` com `ASGITransport`, para o app e o driver do banco (asyncpg) rodarem no mesmo loop de eventos.
- Rode a partir de `backend/` (o `alembic.ini` é lido do diretório atual). A integração precisa do Docker ligado.
- **S3 nos testes:** o **moto** simula o S3 em memória (`mock_aws`), sem rede e sem conta na AWS. A fixture `bucket` de `test_images.py` cria o bucket, aponta o cliente do app para ele (tira o `S3_ENDPOINT_URL` do LocalStack e limpa o cache do `_client()`) e faz o papel do navegador, colocando o arquivo no bucket antes de registrar a imagem.
- **IA nos testes:** os embeddings vêm de `tests/fakes.py` (`FakeEmbeddings`: o mesmo texto gera sempre o mesmo vetor, a partir de um hash), no lugar da OpenAI; o `DeterministicFakeEmbedding` do LangChain não foi usado porque exige numpy. A dependência `require_embeddings` é trocada em `app.dependency_overrides`. O processamento de documentos roda em segundo plano com sessões de `get_session_factory`, que o `conftest.py` aponta para o banco do teste; o cliente de teste só responde depois da tarefa terminar, então o resultado é conferido logo em seguida.
- `tests/conftest.py` também define `TC_HOST=127.0.0.1`: em alguns Windows com Docker, conectar por `localhost` falha com `WinError 64`. Pelo mesmo motivo, o `.env.example` usa `127.0.0.1` no `DATABASE_URL` e no `S3_ENDPOINT_URL`.

## Aceite (Playwright)

Pasta `e2e/` com `package.json` próprio. Dois modos:

| Modo | Como rodar | O que testa |
| --- | --- | --- |
| **Isolado** (padrão) | `npx playwright test` | O Playwright sobe o frontend em `:5174` com a **API fictícia** e o login fictício. Não precisa de backend; resultado determinístico |
| **Stack completa** | `E2E_BASE_URL=http://localhost:5173 npx playwright test` | Os mesmos testes contra um app já rodando: frontend + FastAPI + Postgres + LocalStack (`docker compose up -d`, backend e `npm run dev` com `VITE_API_URL`). Valida a integração de verdade, inclusive o upload para o S3 |

- Projetos: `desktop` (Chrome) e `mobile` (Pixel 7, só `responsive.spec.ts`, que também confere que não há rolagem horizontal).
- Os testes criam dados com nomes únicos (`E2E …`) e apagam tudo no final, então podem rodar contra o banco de desenvolvimento.
- Sem Auth0 configurado, o botão **Entrar** abre a sessão fictícia. Contra o ambiente publicado (com Auth0), o login precisará de um usuário de teste (próximo passo, junto com o CI).
- **No CI** (job `e2e` de `.github/workflows/ci-cd.yml`), roda no modo isolado em cada pull request; o relatório de uma falha fica como artefato da execução por 7 dias. Os testes de unidade e integração do backend e do frontend rodam nos jobs `backend` e `frontend` (ver [implantação](implantacao.md#pipeline-github-actions)).
- **Filtros e URL:** o React Router muda a URL na hora, mas a página só renderiza de novo depois (transição). Depois de "Limpar filtros", espere o próprio `<select>` voltar para "Todos" (`toHaveValue("")`), não só a URL; senão o filtro seguinte parte dos parâmetros antigos (no runner do CI, mais lento, isso aparecia).
- Em caso de falha: `npx playwright show-report` (trace, screenshot e vídeo do passo que falhou).
