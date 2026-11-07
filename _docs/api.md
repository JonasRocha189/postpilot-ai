# API

> Status: **em implementação**. Prontos: **Projects**, **Subjects**, **Posts**, **Images**, autenticação com Auth0 e verificação de saúde. A referência oficial é o OpenAPI gerado pelo FastAPI em `/api/docs`. Mantenha esta tabela alinhada a ela.

- Prefixo: `/api/v1`
- Rotas, parâmetros e campos JSON em **inglês** (ver [decisão 20](decisoes.md)), com os mesmos nomes do [modelo de dados](modelo-de-dados.md).
- Autenticação: `Authorization: Bearer <access token do Auth0>` em todas as rotas, exceto `/health` (ver [Autenticação](#autenticação))
- Erros: `{"detail": ...}`
- Um usuário nunca acessa dados de outro. Recursos de outro usuário retornam `404`.
- **Escopo por projeto:** as listagens marcadas com 🅿 exigem `?project_id=…`, e as criações recebem `project_id` no corpo. O backend confere se o projeto pertence ao usuário do token (senão, `404`). O frontend envia o projeto selecionado no cabeçalho da tela.

## Autenticação

O frontend faz login no Auth0 (Authorization Code + PKCE) e envia o **access token** em cada chamada. O backend ([`api/deps.py`](../backend/api/deps.py)) não consulta o Auth0 a cada requisição: baixa uma vez as chaves públicas do tenant (`https://<AUTH0_DOMAIN>/.well-known/jwks.json`, em cache) e confere o token localmente.

| Verificação | Valor esperado |
| --- | --- |
| Assinatura | RS256, com a chave do JWKS indicada pelo `kid` do token. O algoritmo é fixo no backend, nunca lido do token |
| `iss` | `https://<AUTH0_DOMAIN>/` (com a barra final) |
| `aud` | `AUTH0_AUDIENCE` (identificador da API no Auth0: `https://postpilot.jonas-rocha.com/api`) |
| `exp` | No futuro |
| `sub` | Presente; vira o `user_id` de todas as consultas |

| Situação | Resposta |
| --- | --- |
| Sem token, com `AUTH_DEV_USER` definido (só desenvolvimento local) | Segue como esse usuário |
| Sem token | `401` `{"detail": "Not authenticated"}` e `WWW-Authenticate: Bearer` |
| Token expirado, de outra API, de outro tenant ou com assinatura inválida | `401` `{"detail": "Invalid token"}` (sem dizer o motivo) |
| Auth0 inacessível ao baixar as chaves | `503` `{"detail": "Authentication provider unavailable"}` |

A API não sobe sem `AUTH0_DOMAIN` e `AUTH0_AUDIENCE`, a não ser que `AUTH_DEV_USER` esteja definido. Em produção, `AUTH_DEV_USER` fica vazio. A autorização vem do filtro por `user_id` em cada consulta: um usuário nunca vê dados de outro.

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Liveness: o processo responde. Não consulta o banco (sem autenticação) |
| GET | `/health/ready` | Readiness: o banco responde a um `SELECT 1` em até 2 s; senão, `503` (sem autenticação) |
| **Projects** | | |
| GET | `/projects` | Lista os projetos do usuário |
| POST | `/projects` | Cria |
| GET | `/projects/{id}` | Detalha |
| PUT | `/projects/{id}` | Atualiza |
| DELETE | `/projects/{id}` | Remove. `409` se ainda tiver subjects, documents ou images |
| **Subjects** | | |
| GET | `/subjects` 🅿 | Lista os assuntos do projeto |
| POST | `/subjects` | Cria (com `project_id`) |
| GET | `/subjects/{id}` | Detalha |
| PUT | `/subjects/{id}` | Atualiza |
| DELETE | `/subjects/{id}` | Remove. `409` se ainda tiver posts |
| **Posts** | | |
| GET | `/posts` 🅿 | Lista os posts do projeto (via subject), ordenados pelo título, cada um com **todas** as variações. Filtros: `subject_id`, e por variação `status`, `network` e período da `expected_date`, inclusivo (`?from=AAAA-MM-DD&to=AAAA-MM-DD`, usado pelo calendário). O post entra quando **uma mesma variação** atende a todos os filtros de variação; com período, variações sem data não contam |
| POST | `/posts` | Cria o post com as variações (corpo abaixo). `404` se o subject não for do usuário; `422` sem variações, com rede repetida, com imagem fora da biblioteca do projeto do subject ou se alguma variação quebrar as regras da rede (tabela abaixo) |
| GET | `/posts/{id}` | Detalha |
| PUT | `/posts/{id}` | Substitui o post e a lista de variações (mesmo corpo e validação do `POST`). A variação de cada rede que continua mantém o `id` |
| DELETE | `/posts/{id}` | Remove o post e as variações (`ON DELETE CASCADE`). As imagens continuam na biblioteca |
| **Images (biblioteca do projeto)** | | |
| GET | `/images` 🅿 | Imagens do projeto, das mais recentes para as mais antigas, cada uma com `url`: URL pré-assinada de leitura que expira em 15 minutos |
| POST | `/images/upload-url` | Corpo `{project_id, content_type, size_bytes}` (`image/png`, `image/jpeg` ou `image/webp`, até 5 MB; `422` se inválido). Responde `{key, upload_url}`; ainda não cria registro. A URL pré-assinada exige o mesmo `Content-Type` no PUT |
| POST | `/images` | Corpo `{project_id, key, content_type, description}`, depois do PUT no S3. `422` se a chave não for da biblioteca deste projeto, se o arquivo não foi enviado ou se passou de 5 MB (o objeto é apagado). Responde `201` com a Image |
| DELETE | `/images/{id}` | Remove a imagem e o objeto no S3. `409` se algum post (inclusive um carrossel) ainda usa a imagem |
| **Ideas** | | |
| GET | `/ideas` 🅿 | Ideias do projeto, das mais recentes para as mais antigas ([decisão 31](decisoes.md)) |
| GET | `/ideas/{id}` | Detalha (usado pelo formulário do post em `/posts/new?idea=…`) |
| POST | `/ideas` | Corpo `{project_id, title, notes, subject_id, networks}`. `subject_id` e `notes` opcionais (`null`); `networks` pode ser vazio. `source` é `manual` (o agente cria com `agent`). `422` se o título estiver vazio ou se o subject não for do projeto |
| PUT | `/ideas/{id}` | Mesmo corpo, sem `project_id`, mais `post_id` (o post criado a partir da ideia; `null` = aberta). `422` se o post não for do mesmo projeto |
| DELETE | `/ideas/{id}` | Remove a ideia. O post criado a partir dela continua |
| **Metrics e relatório** | | |
| POST | `/metrics/import` | Importa a exportação de uma rede de uma vez (corpo abaixo, [decisão 32](decisoes.md)). **Tudo ou nada:** `422` se alguma linha apontar para uma variação que não é do usuário, não é da rede informada ou não está `published`, se algum número for negativo ou se `collected_at` for antes de algum `published_at`. Responde `201` com `{created}` |
| GET | `/variations/{id}/metrics` | Coletas da variação, da mais recente para a mais antiga |
| POST | `/variations/{id}/metrics` | Registra uma coleta (corpo abaixo). `422` se o post não estiver `published`, se algum número for negativo, se `collected_at` for antes de `published_at` ou se alguma data estiver no futuro |
| DELETE | `/metrics/{id}` | Remove uma coleta (para corrigir um registro errado) |
| GET | `/reports/performance` 🅿 | Agregados do projeto por subject, rede, dia, horário e imagem |
| **Documents** | | |
| GET | `/documents` 🅿 | Lista os documentos do projeto (mais recentes primeiro), com status de processamento |
| POST | `/documents/upload-url` | Corpo `{project_id, name, type, size_bytes}`. Valida tipo (`pdf`, `docx`, `txt`) e tamanho (até 10 MB), cria o Document como `pending` e responde `{document, upload_url}`. A URL pré-assinada exige o `Content-Type` do tipo |
| POST | `/documents/{id}/process` | Avisa que o upload terminou: muda para `processing` e processa em segundo plano (extração, chunking, embeddings). Responde o Document |
| DELETE | `/documents/{id}` | Remove o documento, o objeto S3 e os chunks |
| **Agent** | | |
| POST | `/agent/runs` | Corpo `{project_id, mode, request}`. Cria a execução e **responde `202` na hora** com `status: "running"`; o loop roda em segundo plano |
| GET | `/agent/runs` 🅿 | Histórico de execuções do projeto (mais recentes primeiro) |
| GET | `/agent/runs/{id}` | Execução com os passos gravados até o momento. O frontend consulta a cada ~0,7 s enquanto `status = "running"` para mostrar os passos ao vivo |

## Corpo de `POST /posts` e `PUT /posts/{id}`

Mestre-detalhe ([decisão 30](decisoes.md)): o **post** é a ideia (título e assunto) e cada **variação** é o post adaptado para uma rede, com texto, formato, imagens, status e data próprios. Um único `POST`/`PUT` salva o post e todas as variações, numa transação.

```json
{
  "subject_id": "uuid",
  "title": "5 erros ao migrar para a nuvem",
  "variations": [
    {
      "network": "linkedin",
      "format": "text",
      "content": "Texto mais longo para o LinkedIn…",
      "status": "approved",
      "expected_date": "2026-11-20",
      "image_ids": []
    },
    {
      "network": "instagram",
      "format": "carousel",
      "content": "Legenda curta #nuvem",
      "status": "draft",
      "expected_date": "2026-11-21",
      "image_ids": ["uuid", "uuid"]
    }
  ]
}
```

- `variations`: **pelo menos uma** e **no máximo uma por rede** (rede repetida → `422`).
- `network`: `instagram`, `linkedin` ou `x`. `format`: `text`, `single` ou `carousel`.
- `status` (padrão `draft`): `draft`, `review`, `approved` ou `published`, **por variação**.
- `expected_date`: só a data (`AAAA-MM-DD`), **por variação**.
- `image_ids`: imagens da biblioteca do projeto do subject, **na ordem do carrossel**, sem repetir.
- **`PUT` substitui o post inteiro:** a lista `variations` enviada passa a ser a lista do post. Rede que sumiu da lista tem a variação apagada; rede que continua **mantém o `id` da variação** (as métricas ficam ligadas a ele); rede nova ganha uma variação nova.

Resposta (`GET`, `POST`, `PUT`): o post com `id`, `subject_id`, `title`, `created_at`, `updated_at` e `variations` (cada uma com `id`), **ordenadas por rede: LinkedIn, Instagram, X**.

**Regras por rede**, aplicadas a cada variação (`schemas/posts.py`; o frontend usa as mesmas em `features/posts/redes.ts`). Quebrar uma delas responde `422`:

| Rede | Formatos | Limite de texto | Máximo de imagens |
| --- | --- | --- | --- |
| `instagram` | `single`, `carousel` | 2.200 | 20 |
| `linkedin` | `text`, `single`, `carousel` | 3.000 | 20 |
| `x` | `text`, `single`, `carousel` (várias imagens) | 280 | 4 |

- `text` não tem imagem; `single` tem no máximo 1.
- Rascunhos podem ficar incompletos. Variação com status `approved` ou `published`: `single` precisa de 1 imagem e `carousel` de pelo menos 2.

## Imagens

Ficam numa **biblioteca por projeto** ([decisão 22](decisoes.md)); cada variação do post aponta para elas com `image_ids` (tabela `variation_images`, com a posição de cada uma). O envio vai direto do navegador para o S3:

1. `POST /images/upload-url` → `{key, upload_url}`
2. `PUT upload_url` com o arquivo e o mesmo `Content-Type`
3. `POST /images` com a `key` → cria o registro

**Image** (item de `GET /images`):

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "content_type": "image/png",
  "description": "Checklist de segurança",
  "url": "http://localhost:4566/postpilot-dev/users/…?X-Amz-Signature=…",
  "created_at": "2026-11-03T12:00:00Z",
  "updated_at": "2026-11-03T12:00:00Z"
}
```

- O banco guarda só a chave S3 (`users/{user_id}/projects/{project_id}/images/{uuid}.png`); a `url` é gerada a cada listagem e a chave nunca sai na API.

## Métricas

**Corpo de `POST /metrics/import`** (página `/metrics`): o navegador lê o CSV exportado da rede, associa cada linha a uma variação publicada daquela rede (pela data, ou o usuário escolhe) e envia só as linhas associadas.

```json
{
  "network": "linkedin",
  "collected_at": "2026-11-06T12:00:00Z",
  "rows": [
    {
      "variation_id": "uuid",
      "published_at": "2026-11-02T12:00:00Z",
      "impressions": 2720,
      "likes": 65,
      "comments": 13,
      "shares": 9,
      "clicks": 22
    }
  ]
}
```

- Cada linha vira um registro de `Metric` com o `collected_at` do corpo. As datas vão ao meio-dia UTC para continuarem no mesmo dia em qualquer fuso.
- O frontend já filtra: só envia linhas sem erro, associadas e com `published_at` até a data da coleta.

**Corpo de `POST /variations/{id}/metrics`:**

```json
{
  "published_at": "2026-10-19T18:00:00Z",
  "collected_at": "2026-10-26T18:00:00Z",
  "impressions": 2720,
  "likes": 65,
  "comments": 13,
  "shares": 9,
  "clicks": 22
}
```

- Os números são o **total acumulado** no momento da coleta (o que a rede mostra), não a diferença desde a coleta anterior. A coleta mais recente é a que vale.
- Taxa de engajamento = (likes + comments + shares + clicks) ÷ impressions. Mesma regra no frontend (`features/metricas/calculo.ts`) e no relatório.

## Resposta de `GET /agent/runs/{id}`

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "mode": "creation",
  "request": "Post sobre o checklist de segurança",
  "status": "completed",
  "response": "Pronto! Escrevi o post…",
  "post_id": "uuid",
  "iterations": 7,
  "started_at": "2026-10-27T22:51:00Z",
  "finished_at": "2026-10-27T22:51:05Z",
  "steps": [
    {
      "id": "uuid",
      "step_number": 1,
      "tool": "search_documents",
      "arguments": { "query": "checklist de segurança" },
      "result_summary": "4 trechos relevantes de auditoria.pdf",
      "duration_ms": 380,
      "error": null
    }
  ]
}
```

- `status`: `running`, `completed`, `error` (uma tool falhou e o agente parou) ou `limit_reached` (8 iterações sem resposta final).
- `result_summary` é um texto curto para a tela; o resultado completo da tool fica só no banco e nos logs.
- `iterations` conta as voltas do loop: várias tools pedidas pelo LLM na mesma resposta contam como uma.
- `post_id` é preenchido quando o agente salva um rascunho (modo `creation`).
