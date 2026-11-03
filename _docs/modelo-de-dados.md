# Modelo de dados

> Status: **planejado**. Toda mudança de modelo vem com migration Alembic revisada à mão. Atualize este diagrama junto.

Todas as entidades do usuário têm `usuario_id` (o `sub` do Auth0), `criado_em` e `atualizado_em`. Todas as consultas filtram por `usuario_id`.

O **Projeto** (a marca do próprio usuário ou um cliente) é o topo da hierarquia: assuntos, documentos e execuções do agente pertencem a um projeto, e os posts pertencem a ele através do assunto. Assim, o conteúdo e os documentos de um cliente nunca se misturam com os de outro.

## Diagrama de classes

```mermaid
classDiagram
    direction LR

    class Projeto {
        +UUID id
        +str usuario_id
        +str nome
        +str descricao
        +str publico_alvo
        +str tom_de_voz
    }

    class Assunto {
        +UUID id
        +str usuario_id
        +UUID projeto_id
        +str nome
        +str descricao
        +str? publico_alvo
        +str? tom_de_voz
    }

    class Post {
        +UUID id
        +str usuario_id
        +UUID assunto_id
        +str titulo
        +StatusPost status
        +date data_prevista
    }

    class VariacaoPost {
        +UUID id
        +UUID post_id
        +Rede rede
        +str texto
        +list~str~ hashtags
        +int contagem_caracteres
    }

    class Imagem {
        +UUID id
        +UUID variacao_id
        +str chave_s3
        +str? prompt
        +FormatoImagem formato
    }

    class Metrica {
        +UUID id
        +UUID variacao_id
        +datetime publicado_em
        +int impressoes
        +int curtidas
        +int comentarios
        +int compartilhamentos
        +int cliques
        +datetime coletado_em
    }

    class Documento {
        +UUID id
        +str usuario_id
        +UUID projeto_id
        +str nome
        +str chave_s3
        +str tipo
        +int tamanho_bytes
        +StatusDocumento status
        +str? mensagem_erro
        +int? total_chunks
    }

    class Chunk {
        +UUID id
        +UUID documento_id
        +str conteudo
        +vector embedding
        +tsvector busca_texto
    }

    class ExecucaoAgente {
        +UUID id
        +str usuario_id
        +UUID projeto_id
        +ModoAgente modo
        +str pedido
        +str? resposta
        +UUID? post_id
        +int iteracoes
        +StatusExecucao status
        +datetime iniciada_em
        +datetime? finalizada_em
    }

    class PassoAgente {
        +UUID id
        +UUID execucao_id
        +int ordem
        +str tool
        +json argumentos
        +json resultado
        +str? resultado_resumo
        +int duracao_ms
        +str? erro
    }

    class StatusPost {
        <<enumeration>>
        rascunho
        aprovado
        publicado
    }

    class Rede {
        <<enumeration>>
        linkedin
        instagram
        x
    }

    class StatusDocumento {
        <<enumeration>>
        pendente
        processando
        pronto
        erro
    }

    class FormatoImagem {
        <<enumeration>>
        1:1
        4:5
        16:9
    }

    class ModoAgente {
        <<enumeration>>
        ideacao
        criacao
    }

    class StatusExecucao {
        <<enumeration>>
        executando
        concluida
        erro
        limite_atingido
    }

    Projeto "1" --> "*" Assunto
    Projeto "1" --> "*" Documento
    Projeto "1" --> "*" ExecucaoAgente
    Assunto "1" --> "*" Post
    Post "1" *-- "*" VariacaoPost : mestre-detalhe
    VariacaoPost "1" *-- "*" Imagem
    VariacaoPost "1" *-- "*" Metrica
    Documento "1" *-- "*" Chunk : ON DELETE CASCADE
    ExecucaoAgente "1" *-- "*" PassoAgente
```

## Regras

| Entidade | Regra |
| --- | --- |
| Projeto | CRUD completo. Define o público-alvo e o tom de voz padrão. Só pode ser excluído quando não tem assuntos nem documentos (a API responde `409` caso contrário), para evitar apagar conteúdo e arquivos no S3 por engano. |
| Assunto | CRUD completo (requisito do TCC). Pertence a um projeto. `publico_alvo` e `tom_de_voz` são opcionais: quando vazios, valem os do projeto. Só pode ser excluído sem posts (`409` caso contrário). |
| Post | CRUD completo. O agente só cria com status `rascunho`; aprovar e publicar é ação do usuário. Não tem `projeto_id`: o projeto vem do assunto (`post → assunto → projeto`), evitando dados duplicados que podem ficar inconsistentes. |
| VariacaoPost | Editada na mesma tela do Post (mestre-detalhe, requisito do TCC). No máximo uma variação por rede em cada post, e pelo menos uma. Ao salvar o post, a variação de uma rede que continua mantém o `id` (as imagens e métricas ficam ligadas a ele). `contagem_caracteres` conta texto + hashtags e não pode passar do limite da rede (LinkedIn 3000, Instagram 2200, X 280). |
| Imagem | Guarda só a chave S3 (ex.: `usuarios/{id}/projetos/{id}/posts/{id}/{uuid}.png`), nunca a URL. `prompt` preenchido quando gerada pelo agente, `null` quando enviada pelo usuário. PNG, JPEG ou WebP até 5 MB; no máximo 10 por variação. Apagada (com o objeto no S3) junto com a variação. |
| Metrica | Uma coleta registrada manualmente pelo usuário, só com o post `publicado`. Os números são totais acumulados no momento da coleta; a mais recente é a que vale. `coletado_em` não pode ser antes de `publicado_em` nem no futuro. Taxa de engajamento = (curtidas + comentários + compartilhamentos + cliques) ÷ impressões. Apagada junto com a variação. |
| Documento | Pertence a um projeto e só é usado pelo RAG desse projeto. O status acompanha o processamento: `pendente` → `processando` → `pronto` ou `erro`. Chave S3: `usuarios/{id}/projetos/{id}/documentos/{uuid}.{ext}`. |
| Chunk | Apagado em cascata com o Documento. A dimensão do `embedding` vem da configuração; trocar o modelo de embeddings exige reprocessar tudo. Índices: HNSW no `embedding` e GIN no `tsvector`. |
| ExecucaoAgente | Criada como `executando` e atualizada pelo loop em segundo plano. `post_id` aponta para o rascunho salvo pelo agente (modo criação). |
| PassoAgente | Um registro por tool chamada, gravado assim que a tool termina (é o que a tela mostra ao vivo). `resultado` guarda a saída completa; `resultado_resumo` é o texto curto exibido. |
