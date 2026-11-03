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
| DELETE | `/projects/{id}` | Remove. `409` se ainda tiver subjects ou documents |
| **Subjects** | | |
| GET | `/subjects` 🅿 | Lista os assuntos do projeto |
| POST | `/subjects` | Cria (com `project_id`) |
| GET | `/subjects/{id}` | Detalha |
| PUT | `/subjects/{id}` | Atualiza |
| DELETE | `/subjects/{id}` | Remove. `409` se ainda tiver posts |
| **Posts (mestre-detalhe)** | | |
| GET | `/posts` 🅿 | Lista os posts do projeto (via subject), já com as variações, ordenados pela `expected_date` (mais recentes primeiro). Filtros: `subject_id`, `status` e período (`?from=AAAA-MM-DD&to=AAAA-MM-DD`, usado pelo calendário) |
| POST | `/posts` | Cria o post com suas variações (corpo abaixo). `422` se o subject não for de um projeto do usuário |
| GET | `/posts/{id}` | Detalha o post com as variações |
| PUT | `/posts/{id}` | Atualiza o post e **substitui** as variações pelas enviadas. A variação de uma rede que continua **mantém o `id`** (e as imagens e métricas); a de uma rede que não vier é removida junto com as imagens e métricas |
| DELETE | `/posts/{id}` | Remove o post, as variações, as imagens (e os objetos no S3) e as métricas |
| **Images** | | |
| GET | `/variations/{id}/images` | Imagens da variação (mais antigas primeiro), cada uma com `url`: URL pré-assinada de leitura que expira em 15 minutos |
| POST | `/variations/{id}/images/upload-url` | Corpo `{type, size_bytes}` (`png`, `jpeg` ou `webp`, até 5 MB). `422` se inválido ou se a variação já tiver 10 imagens. Responde `{key, upload_url}`; ainda não cria registro |
| POST | `/variations/{id}/images` | Corpo `{key, format}`, depois do PUT no S3. Confere se a chave é desta variação e se o objeto existe, e cria a Image (`prompt: null`) |
| DELETE | `/images/{id}` | Remove a imagem e o objeto no S3 |
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
  "status": "draft",
  "expected_date": "2026-11-03T12:00:00.000Z",
  "variations": [
    { "network": "linkedin", "text": "…", "hashtags": ["nuvem", "pme"] },
    { "network": "x", "text": "…", "hashtags": ["nuvem"] }
  ]
}
```

- No máximo uma variação por rede (`linkedin`, `instagram`, `x`) e pelo menos uma.
- `hashtags` sem o `#`. O backend calcula `char_count` do texto final (texto, linha em branco e hashtags com `#`) e responde `422` se passar do limite da rede: LinkedIn 3000, Instagram 2200, X 280. O frontend usa a mesma regra (`features/posts/redes.ts`).

## Imagens e métricas

Ficam na aba de cada variação do post e são gravadas na hora, fora do `PUT /posts/{id}` (dependem do `id` da variação já salva).

**Image** (item de `GET /variations/{id}/images`):

```json
{
  "id": "uuid",
  "variation_id": "uuid",
  "format": "4:5",
  "prompt": "ilustração sobre checklist de segurança, sem texto",
  "url": "https://bucket.s3.amazonaws.com/users/…?X-Amz-Signature=…",
  "created_at": "2026-10-28T12:00:00Z"
}
```

- `format`: `1:1`, `4:5` ou `16:9`. No envio, o frontend escolhe o mais próximo das dimensões da imagem.
- `prompt` é preenchido quando a imagem foi gerada pelo agente (`generate_image`) e fica `null` quando o usuário enviou.
- O banco guarda só a chave S3 (`s3_key`); a `url` é gerada a cada listagem.

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
