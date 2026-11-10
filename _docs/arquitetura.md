# Arquitetura (modelo C4)

> Status: **implementada**. Os diagramas refletem o código em produção (novembro de 2026). O modelo de implantação está em [implantacao.md](implantacao.md) e o diagrama de classes em [modelo-de-dados.md](modelo-de-dados.md).

## Nível 1: Contexto

Quem usa o sistema e com quais sistemas externos ele conversa.

```mermaid
flowchart TB
    usuario["👤 Criador de conteúdo<br/><i>Organiza projetos e assuntos, envia documentos,<br/>conversa com o agente e importa métricas</i>"]

    postpilot["<b>PostPilot</b><br/><i>Gera posts para redes sociais<br/>com agente de IA e RAG</i>"]

    auth0["Auth0<br/><i>Identidade e OAuth 2.0</i>"]
    s3["AWS S3<br/><i>Documentos e imagens</i>"]
    openai["OpenAI<br/><i>Chat, embeddings e imagem</i>"]
    groq["Groq<br/><i>Chat (fallback)</i>"]
    web["Tavily<br/><i>Busca na web</i>"]
    langsmith["LangSmith<br/><i>Rastreio do agente</i>"]
    redes["Redes sociais<br/><i>LinkedIn, Instagram, X</i>"]

    usuario -- "Usa pelo navegador (HTTPS)" --> postpilot
    usuario -- "Login, cadastro, troca de senha" --> auth0
    usuario -. "Publica manualmente e<br/>exporta as métricas (CSV)" .-> redes
    postpilot -- "Valida JWT" --> auth0
    postpilot -- "Lê e grava arquivos" --> s3
    postpilot -- "Chat, embeddings, imagens" --> openai
    postpilot -- "Chat quando a OpenAI falha" --> groq
    postpilot -- "Pesquisa temas" --> web
    postpilot -- "Envia os passos de cada execução" --> langsmith
```

A publicação nas redes e a coleta de métricas são feitas pelo próprio usuário: ele publica o post e depois importa o CSV que a rede exporta. A integração automática está fora do escopo (roadmap).

## Nível 2: Contêineres

```mermaid
flowchart TB
    browser["👤 Navegador"]

    subgraph vercel["Vercel"]
        front["Frontend<br/><i>React + Vite + TailAdmin<br/>arquivos estáticos (SPA)</i>"]
    end
    subgraph render["Render"]
        back["Backend<br/><i>FastAPI (Python 3.12)<br/>contêiner Docker</i>"]
        bg["Tarefas em segundo plano<br/><i>processamento de documentos<br/>e execuções do agente</i>"]
    end
    db[("PostgreSQL 18<br/>+ pgvector<br/><i>Neon</i>")]
    backup["Backup agendado<br/><i>GitHub Actions, pg_dump</i>"]

    s3["AWS S3"]
    auth0["Auth0"]
    ia["OpenAI, Groq, Tavily,<br/>LangSmith"]

    browser -- "HTTPS" --> front
    front -- "/api/* (rewrite, mesma origem)" --> back
    browser -- "Login (Authorization Code + PKCE)" --> auth0
    browser -- "Upload/download<br/>(URL pré-assinada)" --> s3
    back -- "SQL (async)" --> db
    back --> bg
    bg -- "SQL" --> db
    bg -- "Baixa documentos,<br/>grava imagens" --> s3
    bg -- "HTTPS" --> ia
    back -- "JWKS" --> auth0
    backup -- "pg_dump" --> db
    backup -- "Envia o dump" --> s3
```

Pontos importantes:

- O frontend obtém o token no Auth0 e o envia como `Authorization: Bearer` em cada chamada à API. O backend valida assinatura, emissor e audiência pelo JWKS.
- Os arquivos vão **direto do navegador para o S3**, com URL pré-assinada gerada pelo backend. O backend nunca recebe o upload.
- No banco fica só a **chave** do objeto S3, nunca a URL.
- O processamento de documentos e o loop do agente rodam em segundo plano no mesmo processo (`BackgroundTasks` do FastAPI). A API responde `202` na hora e o frontend consulta o andamento, que fica no banco.

## Nível 3: Componentes do backend

```mermaid
flowchart TB
    subgraph api["api/"]
        deps["deps.py<br/><i>JWT Auth0 → user_id</i>"]
        mw["middleware.py<br/><i>request_id, log de cada requisição</i>"]
        routers["v1/routers/<br/><i>projects, subjects, posts, images,<br/>ideas, metrics, reports,<br/>documents, agent</i>"]
    end

    schemas["schemas/<br/><i>Pydantic: entrada e saída da API</i>"]
    services["services/<br/><i>performance: dados de desempenho<br/>(relatório e agente)</i>"]
    database["database/<br/><i>config (pydantic-settings),<br/>sessão, modelos SQLAlchemy</i>"]
    storage["storage/<br/><i>cliente S3, URLs pré-assinadas</i>"]
    core["core/<br/><i>logs JSON (structlog)</i>"]

    subgraph ai["ai/"]
        models["models.py<br/><i>OpenAI + fallback Groq,<br/>embeddings, imagem</i>"]
        runner["agent/runner.py<br/><i>create_agent + middlewares:<br/>limite de 8, fallback, StepRecorder</i>"]
        tools["tools/<br/><i>10 tools, uma por arquivo;<br/>registry por modo</i>"]
        rag["rag/<br/><i>extração, chunking, ingestão,<br/>busca híbrida (pgvector + tsvector + RRF)</i>"]
    end

    db[("PostgreSQL")]

    routers --> deps
    routers --> schemas
    routers --> database
    routers --> storage
    routers --> services
    routers -- "documents" --> rag
    routers -- "agent" --> runner
    runner --> models
    runner --> tools
    tools --> rag
    tools --> services
    tools --> storage
    tools --> models
    rag --> models
    rag --> database
    services --> database
    database --> db
    mw --> core
```

Regras de dependência:

- **Escopo sempre do token:** o `user_id` vem de `api/deps.py` (JWT validado) e o projeto é conferido antes de qualquer leitura. As tools recebem `user_id` e `project_id` por um contexto (`AgentContext`) que o LLM não vê nem altera.
- **IA atrás de interfaces:** o agente depende só de `BaseChatModel`, `Embeddings` e de um gerador de imagens injetado; os modelos concretos são criados apenas em `ai/models.py`. Nos testes, entram modelos falsos.
- **Simplificação deliberada:** os routers usam a sessão do SQLAlchemy diretamente (sem camada de repositórios), porque cada recurso é um CRUD pequeno. O que é compartilhado entre a API e o agente fica em `services/` (ex.: os dados de desempenho) ou nas funções `*_data` de cada tool.
- **Configuração** só por variáveis de ambiente (`database/config.py`); **logs** só em JSON no stdout.

## Componentes do frontend

```
src/
├── pages/          # uma página por rota (React Router), carregadas sob demanda
├── components/     # layout, cabeçalho (seletor de projeto, saúde, usuário) e UI do TailAdmin
├── features/       # um módulo por recurso: projects, subjects, posts, images, ideas,
│   │               # documents, agent, metrics, dashboard, calendar, art, health...
│   ├── */service.ts  # chamadas HTTP (ou a API fictícia no modo de demonstração)
│   └── */api.ts      # hooks TanStack Query: única forma de as telas chamarem a API
├── lib/            # cliente HTTP com o token, Auth0 (login, saída por inatividade), formatação
├── locales/        # textos da interface em pt-BR e en (i18next)
└── test/           # API falsa (MSW) e testes de integração
```

- **Projeto atual:** escolhido no cabeçalho e guardado no navegador; toda listagem envia `project_id`.
- **Sem segredos no frontend:** só variáveis públicas (`VITE_AUTH0_*`, URL da API). As chaves de IA ficam no backend.
