# API

> Status: **em implementação**. Pronto: **Projects**. Até a integração com o Auth0, todas as rotas usam um usuário fixo (`dev-user`). A referência oficial é o OpenAPI gerado pelo FastAPI em `/api/docs`. Mantenha esta tabela alinhada a ela.

- Prefixo: `/api/v1`
- Rotas, parâmetros e campos JSON em **inglês** (ver [decisão 20](decisoes.md)), com os mesmos nomes do [modelo de dados](modelo-de-dados.md).
- Autenticação: `Authorization: Bearer <JWT do Auth0>` em todas as rotas, exceto `/health`
- Erros: `{"detail": ...}`
- Um usuário nunca acessa dados de outro. Recursos de outro usuário retornam `404`.
- **Escopo por projeto:** as listagens marcadas com 🅿 exigem `?project_id=…`, e as criações recebem `project_id` no corpo. O backend confere se o projeto pertence ao usuário do token (senão, `404`). O frontend envia o projeto selecionado no cabeçalho da tela.

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Verificação de saúde (sem autenticação) |
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
| GET | `/posts` 🅿 | Lista os posts do projeto (via subject), ordenados pelo título. Filtros: `subject_id`, `status` e período da `expected_date`, inclusivo (`?from=AAAA-MM-DD&to=AAAA-MM-DD`, usado pelo calendário; com período, posts sem data ficam de fora) |
| POST | `/posts` | Cria (corpo abaixo). `404` se o subject não for do usuário; `422` se alguma imagem não for da biblioteca do projeto do subject ou se o post quebrar as regras da rede (tabela abaixo) |
| GET | `/posts/{id}` | Detalha |
| PUT | `/posts/{id}` | Atualiza só os campos enviados; `image_ids` substitui a lista inteira (na nova ordem). O resultado é validado como no `POST` |
| DELETE | `/posts/{id}` | Remove o post. A imagem continua na biblioteca |
| **Images (biblioteca do projeto)** | | |
| GET | `/images` 🅿 | Imagens do projeto, das mais recentes para as mais antigas, cada uma com `url`: URL pré-assinada de leitura que expira em 15 minutos |
| POST | `/images/upload-url` | Corpo `{project_id, content_type, size_bytes}` (`image/png`, `image/jpeg` ou `image/webp`, até 5 MB; `422` se inválido). Responde `{key, upload_url}`; ainda não cria registro. A URL pré-assinada exige o mesmo `Content-Type` no PUT |
| POST | `/images` | Corpo `{project_id, key, content_type, description}`, depois do PUT no S3. `422` se a chave não for da biblioteca deste projeto, se o arquivo não foi enviado ou se passou de 5 MB (o objeto é apagado). Responde `201` com a Image |
| DELETE | `/images/{id}` | Remove a imagem e o objeto no S3. `409` se algum post (inclusive um carrossel) ainda usa a imagem |
| **Metrics e relatório** | | |
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

```json
{
  "subject_id": "uuid",
  "title": "5 erros ao migrar para a nuvem",
  "content": "Texto do post…",
  "status": "draft",
  "network": "instagram",
  "format": "carousel",
  "expected_date": "2026-11-20",
  "image_ids": ["uuid", "uuid"]
}
```

- `status`: `draft`, `review`, `approved` ou `published` (padrão `draft`).
- `network`: `instagram`, `linkedin` ou `x` (uma rede por post). `format`: `text`, `single` ou `carousel`.
- `expected_date` é só a data (`AAAA-MM-DD`).
- `image_ids`: imagens da biblioteca do projeto do subject, **na ordem do carrossel**, sem repetir.
- No `PUT`, só os campos enviados mudam; `title`, `status`, `subject_id`, `network`, `format` e `image_ids` não aceitam `null`.
- **Planejado:** variações por rede no mesmo post (`variations`).

**Regras por rede** (`schemas/posts.py`; o frontend usa as mesmas em `features/posts/redes.ts`). Quebrar uma delas responde `422`:

| Rede | Formatos | Limite de texto | Máximo de imagens |
| --- | --- | --- | --- |
| `instagram` | `single`, `carousel` | 2.200 | 20 |
| `linkedin` | `text`, `single`, `carousel` | 3.000 | 20 |
| `x` | `text`, `single`, `carousel` (várias imagens) | 280 | 4 |

- `text` não tem imagem; `single` tem no máximo 1.
- Rascunhos podem ficar incompletos. Com status `approved` ou `published`, `single` precisa de 1 imagem e `carousel` de pelo menos 2.

## Imagens

Ficam numa **biblioteca por projeto** ([decisão 22](decisoes.md)); o post aponta para elas com `image_ids` (tabela `post_images`, com a posição de cada uma). O envio vai direto do navegador para o S3:

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

## Métricas (planejado)

Dependem das variações por rede, que ainda não existem no backend.

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
