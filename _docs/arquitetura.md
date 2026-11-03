# Arquitetura (modelo C4)

> Status: **planejada**. Atualize os diagramas conforme a implementação evoluir.

## Nível 1: Contexto

Quem usa o sistema e com quais sistemas externos ele conversa.

```mermaid
flowchart TB
    usuario["👤 Criador de conteúdo<br/><i>Cadastra assuntos, envia documentos,<br/>conversa com o agente e registra métricas</i>"]

    postpilot["<b>PostPilot</b><br/><i>Gera posts para redes sociais<br/>com agente de IA e RAG</i>"]

    auth0["Auth0<br/><i>Identidade e OAuth 2.0</i>"]
    s3["AWS S3<br/><i>Documentos e imagens</i>"]
    llm["Provedor de LLM<br/><i>Tool calling e embeddings</i>"]
    img["Provedor de imagem<br/><i>Geração de imagens</i>"]
    web["Tavily / Brave<br/><i>Busca na web</i>"]
    redes["Redes sociais<br/><i>LinkedIn, Instagram, X</i>"]

    usuario -- "Usa pelo navegador (HTTPS)" --> postpilot
    usuario -- "Login, cadastro, troca de senha" --> auth0
    usuario -. "Publica manualmente" .-> redes
    postpilot -- "Valida JWT" --> auth0
    postpilot -- "Lê e grava arquivos" --> s3
    postpilot -- "Chat e embeddings" --> llm
    postpilot -- "Gera imagens" --> img
    postpilot -- "Pesquisa temas" --> web
```

A publicação nas redes é feita pelo próprio usuário. A integração automática está fora do escopo (roadmap).

## Nível 2: Contêineres

```mermaid
flowchart TB
    browser["👤 Navegador"]

    subgraph k3s["Cluster k3s (VPS)"]
        traefik["Traefik<br/><i>Ingress + HTTPS (cert-manager)</i>"]
        front["Frontend<br/><i>React + Vite + TailAdmin<br/>servido por nginx</i>"]
        back["Backend<br/><i>FastAPI (Python)<br/>2 réplicas</i>"]
        db[("PostgreSQL 16<br/>+ pgvector<br/><i>StatefulSet</i>")]
        backup["CronJob de backup<br/><i>pg_dump</i>"]
    end

    s3["AWS S3"]
    auth0["Auth0"]
    ia["Provedores de IA<br/>e busca web"]

    browser -- "HTTPS" --> traefik
    traefik -- "/" --> front
    traefik -- "/api" --> back
    browser -- "Login (PKCE)" --> auth0
    browser -- "Upload/download<br/>(URL pré-assinada)" --> s3
    back -- "SQL (async)" --> db
    back -- "SDK AWS" --> s3
    back -- "JWKS" --> auth0
    back -- "HTTPS" --> ia
    backup -- "pg_dump" --> db
    backup -- "Envia dump" --> s3
```

Pontos importantes:

- O frontend obtém o token no Auth0 e o envia como `Authorization: Bearer` em cada chamada à API.
- Os arquivos vão **direto do navegador para o S3**, com URL pré-assinada gerada pelo backend. O backend nunca recebe o upload.
- No banco fica só a **chave** do objeto S3, nunca a URL.

## Nível 3: Componentes do backend

```mermaid
flowchart TB
    subgraph api["api/ (routers FastAPI)"]
        r_assuntos["assuntos"]
        r_posts["posts / variações"]
        r_docs["documentos"]
        r_metricas["métricas / relatório"]
        r_agente["agente"]
    end

    core["core/<br/><i>config, JWT Auth0, logging</i>"]

    subgraph services["services/"]
        s_crud["Serviços de domínio<br/><i>assuntos, posts, métricas</i>"]
        s_docs["Serviço de documentos"]
        s_agente["Serviço do agente"]
    end

    repos["repositories/<br/><i>acesso a dados</i>"]

    subgraph ai["ai/"]
        loop["agent/<br/><i>loop (máx. 8 iterações),<br/>prompts por modo</i>"]
        tools["tools/<br/><i>uma tool por arquivo</i>"]
        rag["rag/<br/><i>extração, chunking,<br/>PgVectorStore</i>"]
        providers["providers/<br/><i>LLMProvider, EmbeddingProvider,<br/>ImageProvider</i>"]
    end

    storage["storage/<br/><i>cliente S3, URLs pré-assinadas</i>"]
    db[("PostgreSQL")]

    api --> core
    r_assuntos & r_posts & r_metricas --> s_crud
    r_docs --> s_docs
    r_agente --> s_agente
    s_crud --> repos
    s_docs --> storage
    s_docs --> rag
    s_agente --> loop
    loop --> providers
    loop --> tools
    tools --> repos
    tools --> rag
    tools --> providers
    rag --> providers
    rag --> repos
    repos --> db
```

Regras de dependência:

- Routers são finos e só chamam services.
- O código do agente depende **apenas das interfaces** em `ai/providers/`, nunca de um SDK diretamente.
- O `usuario_id` vem do token validado em `core/` e é repassado a services, repositories e tools. O LLM nunca escolhe de qual usuário ler dados.

## Componentes do frontend

```
src/
├── pages/        # uma página por rota (React Router)
├── components/   # layout e componentes do TailAdmin
├── features/     # assuntos, posts, documentos, agente, relatorio
│   └── */api.ts  # hooks TanStack Query (única forma de chamar a API)
└── lib/          # cliente HTTP, integração com Auth0
```
