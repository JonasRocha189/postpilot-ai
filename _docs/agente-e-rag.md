# Agente e RAG

> Status: **em implementação** (a partir de 09/11). Stack definida na [decisão 34](decisoes.md): LangChain 1.x + LangGraph, OpenAI com fallback para o Groq, LangSmith.

## Stack

| Papel | Escolha | Pacote |
| --- | --- | --- |
| Loop do agente | `create_agent` do LangChain (construído sobre o LangGraph) | `langchain` (traz `langgraph`) |
| Chat (tool calling) | OpenAI, com **fallback automático** para o Groq (modelo aberto, plano gratuito) quando a OpenAI falha ou atinge limite | `langchain-openai`, `langchain-groq` |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensões; a dimensão vem da configuração) | `langchain-openai` |
| Geração de imagem | OpenAI, versão mínima: uma imagem **sem texto** para a biblioteca do projeto; o texto entra depois no editor de arte | `openai` |
| Busca web | Tavily (plano gratuito), chamado com `httpx` | — |
| Busca nos documentos | **Própria:** pgvector (HNSW) + `tsvector` (GIN) + RRF em SQL | `pgvector` |
| Extração de texto | PDF e DOCX (TXT direto) | `pypdf`, `python-docx` |
| Rastreio | LangSmith, **só em produção**; desligado nos testes e no CI (`LANGSMITH_TRACING=false`) | `langsmith` |

- Os modelos concretos só são criados em `ai/models.py`, a partir das variáveis de ambiente; o resto do código usa as interfaces do LangChain (`BaseChatModel`, `Embeddings`), então trocar de modelo é configuração.
- **Chaves** (`OPENAI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `LANGSMITH_API_KEY`) só no `.env` local e na Render, nunca no frontend. Na OpenAI, limite mensal de gasto configurado na conta.
- A integração PGVector do LangChain **não** é usada: não tem full-text e cria tabelas próprias.

## Loop do agente

`create_agent` do LangChain: o LLM recebe o pedido e as tools, decide qual chamar, recebe o resultado e repete até responder. O backend acompanha o fluxo de eventos da execução para gravar cada passo em `agent_steps` assim que a tool termina.

```mermaid
sequenceDiagram
    actor U as Usuário
    participant API as Backend
    participant A as Loop do agente
    participant LLM as LLMProvider
    participant T as Tools
    participant DB as PostgreSQL

    U->>API: POST /agent/runs (pedido + modo + project_id)
    API->>DB: Confere se o projeto é do usuário e cria AgentRun (running)
    API-->>U: 202 + execução
    API->>A: Executa em segundo plano com user_id (token) e project_id
    loop até responder ou 8 iterações
        A->>LLM: Mensagens + schema das tools
        alt LLM pede tool
            LLM-->>A: tool + argumentos
            A->>T: Executa (user_id e project_id injetados)
            T-->>A: Resultado
            A->>DB: Grava AgentStep
        else LLM responde
            LLM-->>A: Resposta final
        end
    end
    A->>DB: Finaliza AgentRun
    loop a cada ~0,7 s até o status final
        U->>API: GET /agent/runs/{id}
        API-->>U: Status + passos gravados até agora
    end
```

- **Execução em segundo plano, passos ao vivo.** `POST /agent/runs` responde `202` na hora com `status: "running"` e o loop roda em segundo plano, gravando cada `AgentStep` assim que a tool termina. A tela consulta `GET /agent/runs/{id}` a cada ~0,7 s até o status final e mostra os passos conforme aparecem. Sem WebSocket nem SSE, e funciona com 2 réplicas, porque o estado fica no banco.
- **Máximo de 8 iterações.** Ao atingir o limite, a execução termina com `limit_reached` e o usuário é avisado. Várias tools pedidas pelo LLM na mesma resposta (ex.: adaptar para LinkedIn e para X) contam como uma iteração.
- **Erro numa tool:** a execução termina com `error`, e o passo que falhou guarda a mensagem em `error`.
- **Cada pedido é independente:** a conversa na tela é uma sequência de execuções; o agente não recebe o histórico das anteriores.
- **Prompts de sistema** separados por modo em `ai/agent/prompts/`.
- **Segurança:** o `user_id` e o `project_id` são injetados pelo backend em toda tool. Eles não aparecem no schema que o LLM vê: o agente só enxerga os dados do projeto em que foi chamado, e os documentos de um cliente nunca entram nos posts de outro.
- **Voz da marca:** o público-alvo e o tom de voz vêm do assunto; quando o assunto não define, valem os do projeto.
- **Rastreabilidade:** cada passo (tool, argumentos, duração, erro) vira log estruturado e registro em `AgentStep`.

## Modos

| Modo | Objetivo | Tools mais usadas |
| --- | --- | --- |
| Ideação (`ideation`) | Sugerir temas | `search_web`, `search_past_posts`, `analyze_performance`, `list_subjects` |
| Criação (`creation`) | Escrever o post completo | `get_subject`, `search_documents`, `search_past_posts`, `adapt_for_network`, `generate_image`, `save_draft` |

## Tools

Uma por arquivo em `ai/tools/`, `@tool` do LangChain com schema de entrada em Pydantic. Nomes em inglês (ver [decisão 20](decisoes.md)); as descrições que o LLM recebe podem ficar no idioma dos prompts.

| Tool | O que faz |
| --- | --- |
| `search_web(query)` | Busca no Tavily, sempre retornando as fontes |
| `get_project()` | Dados do projeto atual: nome, descrição, público-alvo e tom de voz padrão |
| `list_subjects()` | Lista os assuntos do projeto |
| `get_subject(id)` | Detalhes do assunto, com público-alvo e tom de voz já resolvidos (do assunto ou, se vazios, do projeto) |
| `search_documents(query)` | RAG híbrido nos documentos do projeto |
| `search_past_posts(subject)` | Exemplos de estilo do projeto, só de posts aprovados ou publicados |
| `analyze_performance()` | Agregados do projeto por assunto, dia, horário, rede e imagem. Com menos de 5 posts no grupo, informa que os dados são insuficientes |
| `adapt_for_network(text, network)` | Ajusta formato e limite de caracteres da rede |
| `generate_image(prompt, format)` | Gera imagem sem texto dentro dela e salva no S3 |
| `save_draft(post)` | Salva o post com status `draft` (único status que o agente pode usar) |

## Plano de implementação

Uma branch e um PR por etapa; cada merge vai para produção pelo pipeline.

| Dia | Branch | Entrega |
| --- | --- | --- |
| 09/11 | `feat/ai-documents` | Decisão 34 e docs, dependências e configuração, migration (`documents`, `chunks`, `agent_runs`, `agent_steps`, extensão `vector`), API de documentos (URL de upload, processamento, lista, exclusão) |
| 10/11 | `feat/ai-search-tools` | Busca híbrida (RRF) e tools de leitura: `get_project`, `list_subjects`, `get_subject`, `search_documents`, `search_past_posts` |
| 11–12/11 | `feat/ai-agent` | `create_agent` com fallback OpenAI → Groq, `/agent/runs` (202 + polling), passos em `agent_steps`, `save_draft`, `adapt_for_network`, `search_web`, `generate_image` (mínima), `analyze_performance`, prompts por modo, LangSmith |
| 13/11 | `feat/ai-frontend` | Tipos do frontend em inglês, páginas ligadas à API real, testes |
| 14/11 | — | Produção (chaves na Render), teste ponta a ponta, docs |

Se o prazo apertar (ordem de corte do CLAUDE.md): sai primeiro `analyze_performance`, depois `generate_image`. Documentos, RAG, busca web, o loop e `save_draft` nunca são cortados.

## Pipeline de documentos (RAG)

```mermaid
sequenceDiagram
    actor U as Navegador
    participant API as Backend
    participant S3 as AWS S3
    participant E as EmbeddingProvider
    participant DB as PostgreSQL

    U->>API: Pede URL de upload (nome, tipo, tamanho)
    API->>API: Valida tipo (PDF, DOCX, TXT) e tamanho
    API->>DB: Cria Document (pending)
    API-->>U: URL pré-assinada
    U->>S3: PUT do arquivo
    U->>API: Upload concluído
    API->>DB: Status processing
    API->>S3: Baixa o arquivo
    API->>API: Extrai texto (pypdf, python-docx) e faz chunking
    API->>E: Gera embeddings
    API->>DB: Grava Chunks e status ready (ou error)
```

## Busca híbrida

`search_documents` combina:

1. **Similaridade vetorial** (pgvector, índice HNSW) sobre o embedding da consulta.
2. **Full-text** (`tsvector` em português) sobre o conteúdo.

Os dois rankings são combinados em uma lista única, por exemplo com Reciprocal Rank Fusion. A consulta **sempre** filtra por `user_id` e `project_id` (via `Document`).

## Testes

LLM, embeddings, imagem e busca web são **sempre mockados**, com respostas gravadas e determinísticas. Nenhum teste chama API paga ou depende de rede externa.
