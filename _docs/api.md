# API

> Status: **planejada**. A referência oficial é o OpenAPI gerado pelo FastAPI em `/api/docs`. Mantenha esta tabela alinhada a ela.

- Prefixo: `/api/v1`
- Autenticação: `Authorization: Bearer <JWT do Auth0>` em todas as rotas, exceto `/health`
- Erros: `{"detail": ...}`
- Um usuário nunca acessa dados de outro. Recursos de outro usuário retornam `404`.
- **Escopo por projeto:** as listagens marcadas com 🅿 exigem `?projeto_id=…`, e as criações recebem `projeto_id` no corpo. O backend confere se o projeto pertence ao usuário do token (senão, `404`). O frontend envia o projeto selecionado no cabeçalho da tela.

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Verificação de saúde (sem autenticação) |
| **Projetos** | | |
| GET | `/projetos` | Lista os projetos do usuário |
| POST | `/projetos` | Cria |
| GET | `/projetos/{id}` | Detalha |
| PUT | `/projetos/{id}` | Atualiza |
| DELETE | `/projetos/{id}` | Remove. `409` se ainda tiver assuntos ou documentos |
| **Assuntos** | | |
| GET | `/assuntos` 🅿 | Lista os assuntos do projeto |
| POST | `/assuntos` | Cria (com `projeto_id`) |
| GET | `/assuntos/{id}` | Detalha |
| PUT | `/assuntos/{id}` | Atualiza |
| DELETE | `/assuntos/{id}` | Remove. `409` se ainda tiver posts |
| **Posts (mestre-detalhe)** | | |
| GET | `/posts` 🅿 | Lista os posts do projeto (via assunto), já com as variações, ordenados pela `data_prevista` (mais recentes primeiro). Filtros: `assunto_id`, `status` e período (`?de=AAAA-MM-DD&ate=AAAA-MM-DD`, usado pelo calendário) |
| POST | `/posts` | Cria o post com suas variações (corpo abaixo). `422` se o assunto não for de um projeto do usuário |
| GET | `/posts/{id}` | Detalha o post com as variações |
| PUT | `/posts/{id}` | Atualiza o post e **substitui** as variações pelas enviadas. A variação de uma rede que continua **mantém o `id`** (e as imagens e métricas); a de uma rede que não vier é removida junto com as imagens e métricas |
| DELETE | `/posts/{id}` | Remove o post, as variações, as imagens (e os objetos no S3) e as métricas |
| **Imagens** | | |
| GET | `/variacoes/{id}/imagens` | Imagens da variação (mais antigas primeiro), cada uma com `url`: URL pré-assinada de leitura que expira em 15 minutos |
| POST | `/variacoes/{id}/imagens/upload-url` | Corpo `{tipo, tamanho_bytes}` (`png`, `jpeg` ou `webp`, até 5 MB). `422` se inválido ou se a variação já tiver 10 imagens. Responde `{chave, upload_url}`; ainda não cria registro |
| POST | `/variacoes/{id}/imagens` | Corpo `{chave, formato}`, depois do PUT no S3. Confere se a chave é desta variação e se o objeto existe, e cria a Imagem (`prompt: null`) |
| DELETE | `/imagens/{id}` | Remove a imagem e o objeto no S3 |
| **Métricas e relatório** | | |
| GET | `/variacoes/{id}/metricas` | Coletas da variação, da mais recente para a mais antiga |
| POST | `/variacoes/{id}/metricas` | Registra uma coleta (corpo abaixo). `422` se o post não estiver `publicado`, se algum número for negativo, se `coletado_em` for antes de `publicado_em` ou se alguma data estiver no futuro |
| DELETE | `/metricas/{id}` | Remove uma coleta (para corrigir um registro errado) |
| GET | `/relatorio/desempenho` 🅿 | Agregados do projeto por assunto, rede, dia, horário e imagem |
| **Documentos** | | |
| GET | `/documentos` 🅿 | Lista os documentos do projeto (mais recentes primeiro), com status de processamento |
| POST | `/documentos/upload-url` | Corpo `{projeto_id, nome, tipo, tamanho_bytes}`. Valida tipo (`pdf`, `docx`, `txt`) e tamanho (até 10 MB), cria o Documento como `pendente` e responde `{documento, upload_url}`. A URL pré-assinada exige o `Content-Type` do tipo |
| POST | `/documentos/{id}/processar` | Avisa que o upload terminou: muda para `processando` e processa em segundo plano (extração, chunking, embeddings). Responde o Documento |
| DELETE | `/documentos/{id}` | Remove o documento, o objeto S3 e os chunks |
| **Agente** | | |
| POST | `/agente/execucoes` | Corpo `{projeto_id, modo, pedido}`. Cria a execução e **responde `202` na hora** com `status: "executando"`; o loop roda em segundo plano |
| GET | `/agente/execucoes` 🅿 | Histórico de execuções do projeto (mais recentes primeiro) |
| GET | `/agente/execucoes/{id}` | Execução com os passos gravados até o momento. O frontend consulta a cada ~0,7 s enquanto `status = "executando"` para mostrar os passos ao vivo |

## Corpo de `POST /posts` e `PUT /posts/{id}`

```json
{
  "assunto_id": "uuid",
  "titulo": "5 erros ao migrar para a nuvem",
  "status": "rascunho",
  "data_prevista": "2026-11-03T12:00:00.000Z",
  "variacoes": [
    { "rede": "linkedin", "texto": "…", "hashtags": ["nuvem", "pme"] },
    { "rede": "x", "texto": "…", "hashtags": ["nuvem"] }
  ]
}
```

- No máximo uma variação por rede (`linkedin`, `instagram`, `x`) e pelo menos uma.
- `hashtags` sem o `#`. O backend calcula `contagem_caracteres` do texto final (texto, linha em branco e hashtags com `#`) e responde `422` se passar do limite da rede: LinkedIn 3000, Instagram 2200, X 280. O frontend usa a mesma regra (`features/posts/redes.ts`).

## Imagens e métricas

Ficam na aba de cada variação do post e são gravadas na hora, fora do `PUT /posts/{id}` (dependem do `id` da variação já salva).

**Imagem** (item de `GET /variacoes/{id}/imagens`):

```json
{
  "id": "uuid",
  "variacao_id": "uuid",
  "formato": "4:5",
  "prompt": "ilustração sobre checklist de segurança, sem texto",
  "url": "https://bucket.s3.amazonaws.com/usuarios/…?X-Amz-Signature=…",
  "criado_em": "2026-10-28T12:00:00Z"
}
```

- `formato`: `1:1`, `4:5` ou `16:9`. No envio, o frontend escolhe o mais próximo das dimensões da imagem.
- `prompt` é preenchido quando a imagem foi gerada pelo agente (`gerar_imagem`) e fica `null` quando o usuário enviou.
- O banco guarda só a chave S3; a `url` é gerada a cada listagem.

**Corpo de `POST /variacoes/{id}/metricas`:**

```json
{
  "publicado_em": "2026-10-19T18:00:00Z",
  "coletado_em": "2026-10-26T18:00:00Z",
  "impressoes": 2720,
  "curtidas": 65,
  "comentarios": 13,
  "compartilhamentos": 9,
  "cliques": 22
}
```

- Os números são o **total acumulado** no momento da coleta (o que a rede mostra), não a diferença desde a coleta anterior. A coleta mais recente é a que vale.
- Taxa de engajamento = (curtidas + comentários + compartilhamentos + cliques) ÷ impressões. Mesma regra no frontend (`features/metricas/calculo.ts`) e no relatório.

## Resposta de `GET /agente/execucoes/{id}`

```json
{
  "id": "uuid",
  "projeto_id": "uuid",
  "modo": "criacao",
  "pedido": "Post sobre o checklist de segurança",
  "status": "concluida",
  "resposta": "Pronto! Escrevi o post…",
  "post_id": "uuid",
  "iteracoes": 7,
  "iniciada_em": "2026-10-27T22:51:00Z",
  "finalizada_em": "2026-10-27T22:51:05Z",
  "passos": [
    {
      "id": "uuid",
      "ordem": 1,
      "tool": "buscar_documentos",
      "argumentos": { "query": "checklist de segurança" },
      "resultado_resumo": "4 trechos relevantes de auditoria.pdf",
      "duracao_ms": 380,
      "erro": null
    }
  ]
}
```

- `status`: `executando`, `concluida`, `erro` (uma tool falhou e o agente parou) ou `limite_atingido` (8 iterações sem resposta final).
- `resultado_resumo` é um texto curto para a tela; o resultado completo da tool fica só no banco e nos logs.
- `iteracoes` conta as voltas do loop: várias tools pedidas pelo LLM na mesma resposta contam como uma.
- `post_id` é preenchido quando o agente salva um rascunho (modo criação).
