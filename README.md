# PostPilot

[![CI/CD](https://github.com/JonasRocha189/postpilot-ai/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/JonasRocha189/postpilot-ai/actions/workflows/ci-cd.yml)

> Gerador de posts para redes sociais com agente de IA e RAG.
> Projeto Integrado (TCC) — Pós-graduação em Desenvolvimento FullStack, PUC Minas
> Autor: Jonas Rocha · [jonas.rvrocha@gmail.com](mailto:jonas.rvrocha@gmail.com)

*PostPilot é um nome provisório.*

## Sumário

- [Sobre o projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Acesso à aplicação](#acesso-à-aplicação)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Como executar localmente](#como-executar-localmente)
- [Entregas](#entregas)
- [Requisitos não-funcionais](#requisitos-não-funcionais)
- [Requisitos funcionais](#requisitos-funcionais)
- [Fora do escopo](#fora-do-escopo)
- [Orientações do TCC](#orientações-do-tcc)

---

## Sobre o projeto

**Contexto:** quem produz conteúdo para redes sociais (profissionais, pequenas empresas, criadores) precisa publicar com frequência em várias redes, cada uma com formato, limite de caracteres e público próprios.

**Problema:** criar posts consistentes com a voz da marca, embasados em material próprio e adaptados a cada rede toma tempo. Além disso, raramente se usa o desempenho dos posts anteriores para decidir o que publicar em seguida.

**Solução:** uma aplicação web em que o usuário cadastra **assuntos** (com público-alvo e tom de voz), envia **documentos** de referência (PDF, DOCX, TXT) e conversa com um **agente de IA** que sugere temas, escreve posts, adapta o texto para cada rede e gera imagens. As **métricas** dos posts publicados alimentam um **relatório de desempenho**, que por sua vez orienta as próximas sugestões do agente.

## Funcionalidades

- **Projetos:** a marca do próprio usuário ou cada cliente, com público-alvo e tom de voz padrão (CRUD). Assuntos, documentos e conversas com o agente ficam dentro de um projeto, e o conteúdo de um cliente nunca se mistura com o de outro.
- **Assuntos:** cadastro completo (CRUD) com descrição e, se quiser, público-alvo e tom de voz próprios.
- **Posts e variações:** tela mestre/detalhe em que um post tem uma variação por rede (LinkedIn, Instagram, X), com texto, formato, imagens da biblioteca, status e data prevista. As regras de cada rede (limite de caracteres, formatos) são validadas no frontend e no backend.
- **Biblioteca de imagens e editor de arte:** imagens por projeto, usadas nas variações; o editor monta a arte (texto sobre cor ou foto, carrossel) no tamanho de cada rede.
- **Ideias e calendário:** ideias salvas à mão ou pelo agente, que viram post com um clique; calendário pela data prevista.
- **Documentos:** upload direto para o S3, extração de texto, chunking e indexação vetorial para RAG.
- **Agente de IA**, em dois modos:
  - **Ideação:** sugere temas a partir de pesquisa na web, do histórico de posts e do desempenho anterior.
  - **Criação:** escreve o post com base nos documentos (RAG) e em posts aprovados (voz da marca), adapta-o para cada rede e gera a imagem.
  - Cada execução mostra os passos e as ferramentas usadas. O agente só salva rascunhos; aprovar e publicar é sempre decisão do usuário.
- **Métricas e dashboard:** importação do CSV que cada rede exporta (impressões, curtidas, comentários, compartilhamentos, cliques e horário de publicação) e um dashboard com posts por status, próximos posts, últimas execuções do agente e desempenho por rede, assunto e dia × horário. Os mesmos dados orientam as sugestões do agente (só com pelo menos 5 posts por grupo).
- **Segurança da sessão:** login, cadastro e troca de senha pelo Auth0; saída automática após 30 minutos sem atividade.

## Acesso à aplicação

| Item | Valor |
| --- | --- |
| URL de produção | https://postpilot.jonas-rocha.com |
| Documentação da API | https://postpilot.jonas-rocha.com/api/docs |
| Usuário de teste | [a definir] |
| Senha de teste | [informada ao professor] |
| Vídeo de apresentação | [a definir] |

> O acesso ao repositório e ao pipeline deve ser liberado para **71724@sga.pucminas.br**.
>
> O backend roda no plano gratuito da Render, que dorme sem uso: a primeira requisição pode levar até um minuto (o indicador de saúde no cabeçalho mostra quando a API acordou).

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, template TailAdmin, TanStack Query, React Hook Form + Zod, ApexCharts |
| Backend (API) | Python, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2 |
| Banco de dados | PostgreSQL 16 + pgvector, com busca híbrida (vetorial + full-text) |
| IA | LangChain + LangGraph, OpenAI (chat, embeddings e imagem) com fallback para o Groq, busca web com Tavily, rastreio no LangSmith |
| Autenticação | Auth0 (OAuth 2.0 / OpenID Connect, Authorization Code + PKCE) |
| Arquivos | AWS S3 (bucket privado, URLs pré-assinadas) |
| Infraestrutura | Vercel (frontend), Render (backend em Docker), Neon (PostgreSQL) |
| IaC | Terraform (AWS: bucket S3, usuário IAM de menor privilégio, alerta de orçamento, estado remoto). Vercel, Render e Neon são configurados pelo painel |
| CI/CD | GitHub Actions + GitHub Container Registry |
| Testes | pytest, Testcontainers, moto/LocalStack, Vitest + Testing Library, Playwright |
| Qualidade | Ruff, mypy, ESLint, Prettier, pre-commit |

## Arquitetura

```
Navegador ──HTTPS──> Vercel
                       ├── /       → Frontend (React, arquivos estáticos)
                       └── /api/*  → Render: Backend (FastAPI, Docker)
                                     ├── Neon: PostgreSQL + pgvector
                                     ├── AWS S3 (documentos e imagens)
                                     ├── Auth0 (validação de JWT)
                                     └── Provedores de IA (LLM, embeddings, imagem, busca web)
```

O agente usa o `create_agent` do LangChain (sobre o LangGraph), com o chat na OpenAI e fallback automático para o Groq. O código depende das interfaces do LangChain (`BaseChatModel`, `Embeddings`), então trocar de modelo é configuração. A busca nos documentos é própria: pgvector + full-text em SQL ([decisão 34](_docs/decisoes.md)).

A documentação técnica está em [`_docs/`](_docs/README.md): [descoberta de produto](_docs/produto.md) (Lean Canvas, personas, jornadas, histórias), [modelos C4](_docs/arquitetura.md) (contexto, contêineres, componentes), [diagrama de classes](_docs/modelo-de-dados.md), [agente e RAG](_docs/agente-e-rag.md), [API](_docs/api.md), [modelo de implantação](_docs/implantacao.md), [decisões](_docs/decisoes.md) e [changelog](_docs/changelog.md).

## Como executar localmente

Pré-requisitos: Docker, [uv](https://docs.astral.sh/uv/) e Node.js 20+.

```bash
# Postgres + pgvector (porta 5433) e S3 simulado (LocalStack)
docker compose up -d

# Backend: http://127.0.0.1:8000/api/docs
cd backend
cp .env.example .env        # AUTH_DEV_USER=dev-user: aceita requisições sem token (só local)
uv sync
uv run alembic upgrade head
uv run fastapi dev main.py

# Frontend: http://localhost:5173
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:8000 para usar o backend local
npm ci
npm run dev
```

As chaves de IA (`OPENAI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`) são opcionais localmente: sem elas, o agente e o processamento de documentos respondem que a IA não está configurada, e o restante funciona. Sem `VITE_API_URL`, o `npm run dev` usa uma API fictícia guardada no navegador (modo de demonstração, sem backend); sem `VITE_AUTH0_*`, entra com um usuário fictício (ver `frontend/.env.example`).

### Testes

```bash
cd backend && uv run pytest tests/unit          # unidade
cd backend && uv run pytest tests/integration   # integração (requer Docker)
cd frontend && npm run test                     # frontend
cd e2e && npx playwright test                   # aceite (ver _docs/testes.md)
```

## Entregas

- [x] [Lean Canvas](_docs/produto.md#lean-canvas)
- [x] [Personas](_docs/produto.md#personas)
- [x] [Jornadas dos usuários](_docs/produto.md#jornadas-dos-usuários)
- [x] [Mapeamento de histórias de usuário](_docs/produto.md#mapeamento-de-histórias-de-usuário)
- [x] Modelos de [contexto, contêineres e componentes](_docs/arquitetura.md), [classes](_docs/modelo-de-dados.md) e [implantação](_docs/implantacao.md) (C4)
- [x] Repositório e respectivo código-fonte (este repositório)
- [x] Pipeline [CI/CD](.github/workflows/ci-cd.yml) e artefatos [IaC](infra/terraform/)
- [x] Solução implantada em plataforma de computação em nuvem (https://postpilot.jonas-rocha.com)
- [ ] Vídeo de até 15 minutos apresentando a solução (conforme template)

## Requisitos não-funcionais

| | Requisito | Como é atendido |
| --- | --- | --- |
| [x] | Acesso por navegador, com responsividade | React + Tailwind, layout mobile-first |
| [x] | Persistência em banco de dados | PostgreSQL 16 + pgvector |
| [x] | OAuth para autenticação e autorização das APIs | Auth0 (OIDC + PKCE), JWT validado no backend |
| [x] | Backend com API consumida pelo frontend | API REST FastAPI em `/api/v1` |
| [x] | Controle de versões na internet | GitHub |
| [x] | CI/CD com build, testes, publicação e IaC | GitHub Actions, GHCR, Terraform |
| [x] | Implantação em nuvem | Vercel + Render + Neon + AWS S3 |
| [x] | Declaração e isolamento de dependências | `uv.lock`, `package-lock.json`, imagens Docker |
| [x] | Configuração por variáveis de ambiente | pydantic-settings, variáveis da Render e da Vercel, GitHub Secrets |
| [x] | Logs como fluxo de eventos | JSON no stdout (structlog) |
| [x] | Testes de unidade, integração e aceite | pytest, Vitest, Testcontainers, Playwright |
| [x] | Ciclo de vida do usuário (cadastro e alteração de credenciais) | Auth0 |

## Requisitos funcionais

- [x] **CRUD completo:** Projeto, Assunto e Post (`/projects`, `/subjects`, `/posts`)
- [x] **Cadastro mestre/detalhe na mesma tela:** Post → Variações por rede (`/posts/new`)
- [x] **Recurso de IA:** agente com RAG, busca na web e geração de imagem (`/agent`, ver [agente e RAG](_docs/agente-e-rag.md))

## Fora do escopo

Ficam como roadmap: publicação automática nas redes sociais, integração com APIs de analytics, fine-tuning, arquitetura multiagente e observabilidade com Prometheus/Grafana.

---

## Orientações do TCC

<details>
<summary>Texto original das orientações</summary>

### Introdução

O Projeto Integrado consiste no desenvolvimento de uma aplicação web completa. O tema do projeto é de escolha do aluno, que deverá descrever o contexto e o problema para o qual a solução é endereçada.

O trabalho poderá ser desenvolvido individualmente, de forma que cada aluno consiga sedimentar os conhecimentos adquiridos e aplicá-los em trabalhos práticos de desenvolvimento de aplicações Web.

**Ementa:** Descoberta de Produto. Ambiente de desenvolvimento integrado de projetos web. Estratégias para Gerência de Configuração. Projeto da arquitetura da solução. Gestão ágil de requisitos de desenvolvimento e de entrega.

### Acesso às entregas

Deverá ser liberado acesso ao e-mail 71724@sga.pucminas.br para que o professor possa fazer a verificação do repositório e a execução do pipeline.

Devem ser disponibilizadas a URL e credenciais de acesso previamente cadastradas para que o professor possa validar a aplicação em funcionamento.

### Requisitos funcionais (direcionamentos)

A solução deve ser estruturada com pelo menos uma entidade para a qual deve ser fornecida tela de cadastro completa, cumprindo as funções de criação, recuperação, atualização e deleção — Create/Retrieve/Update/Delete (CRUD).

A solução deve apresentar pelo menos uma funcionalidade de cadastro de duas entidades associadas, na modalidade mestre/detalhe, em uma mesma tela. Entende-se por cadastro mestre/detalhe a funcionalidade em que, em uma mesma tela, são informados os dados de duas entidades que possuam relacionamento 1-N ou N-M.

Implementação de uma funcionalidade que faça uso de recursos e serviços como inteligência artificial, blockchain, IoT, dentre outros.

</details>
