# Changelog

Funcionalidades entregues, da mais recente para a mais antiga. Atualize a cada push de funcionalidade nova, junto com os documentos afetados em [`docs/`](README.md).

Formato de cada entrada:

```
## AAAA-MM-DD
### Adicionado | Alterado | Corrigido | Removido
- Descrição curta (commit ou PR)
```

---

## 2026-11-03

### Adicionado

- Backend: FastAPI, conexão assíncrona com o PostgreSQL (SQLAlchemy + asyncpg), configuração por `.env` (pydantic-settings) e Alembic com a primeira migration (`projects`, `subjects`, `posts`, `images`).
- API: CRUD de projetos (`/api/v1/projects`), filtrado pelo dono e com `409` ao excluir projeto com assuntos. Usuário fixo `dev-user` até a integração com o Auth0 (dependência `get_current_user_id`).
- Ambiente local: Postgres do Docker na porta `5433`, para não conflitar com um PostgreSQL instalado no Windows.

### Alterado

- Código, banco e API em inglês; português só na interface (decisão 20). `modelo-de-dados.md`, `api.md`, `agente-e-rag.md`, `arquitetura.md`, `frontend-rotas.md` e `implantacao.md` atualizados com os novos nomes, e glossário domínio ↔ código no modelo de dados.
- Documentação movida de `docs/` para `_docs/`.
- Post ganhou o status `review` (aguardando revisão), entre `draft` e `approved`, como enum do Postgres (`post_status`). IDs passam a ser UUID.

## 2026-10-28

### Adicionado

- Frontend: imagens e métricas na aba de cada variação do post (`/posts/:id`). Imagens: envio direto para o S3 (PNG, JPG, WebP até 5 MB, até 10 por variação), formato pela proporção, ampliação com o prompt das geradas pelo agente e exclusão. Métricas: resumo da última coleta (impressões, interações, engajamento), histórico, registro com validação (só com o post publicado) e exclusão de coleta.
- Frontend: o rascunho salvo pelo agente fictício já vem com a imagem gerada em cada variação.
- Docs: contratos de imagens e métricas em `api.md` (decisão 19).

### Alterado

- Frontend: depois de criar um post, a tela abre o próprio post (para adicionar imagens) em vez da lista.
- API: no `PUT /posts/{id}`, a variação de uma rede que continua mantém o `id`; remover a variação apaga as imagens e métricas dela.

## 2026-10-27

### Adicionado

- Frontend: template TailAdmin em `frontend/`, com erros de lint corrigidos e dependências sem vulnerabilidades.
- Frontend: autenticação com Auth0 (`/login`, `/cadastro`, rotas protegidas, sair) e usuário fictício em desenvolvimento.
- Frontend: páginas `/dashboard` (resumo de posts, desempenho por rede, assunto, dia e horário, próximos posts e execuções do agente, com dados de exemplo), `/perfil` (dados do usuário e alteração de senha), `/erro` e 404 em português.
- Frontend: rotas carregadas sob demanda e marca PostPilot no lugar da TailAdmin.
- Frontend: interface em português e inglês, com seletor de idioma no cabeçalho (no lugar das notificações) e nas telas de login e cadastro.
- Frontend: página `/calendario` com os posts pela data prevista, cor por status e modal de detalhes (dados de exemplo).
- Frontend: CRUD de projetos (`/projetos`, `/projetos/novo`, `/projetos/:id`) com validação (React Hook Form + Zod), exclusão com confirmação e tratamento do `409`, e seletor de projeto no cabeçalho no lugar da busca. Telas de conteúdo mostram um convite quando não há projetos.
- Frontend: camada de API com TanStack Query, envio do token do Auth0 e API fictícia para desenvolvimento sem backend.
- Frontend: CRUD de assuntos (`/assuntos`) com voz da marca herdada do projeto quando os campos ficam vazios, e exclusão bloqueada (`409`) quando há posts.
- Frontend: CRUD de posts (`/posts`) com filtros por status e assunto na URL e **tela mestre-detalhe** (`/posts/novo`, `/posts/:id`): dados do post e uma variação por rede em abas, com contador e validação do limite de caracteres de cada rede.
- Frontend: calendário passa a mostrar os posts do projeto, e "Abrir post" leva ao formulário do post.
- Frontend: `/documentos` com upload por arrastar-e-soltar (PDF, DOCX, TXT até 10 MB) direto para o S3 via URL pré-assinada, barra de progresso e status de processamento atualizado automaticamente.
- Frontend: `/agente` (conversa nos modos Ideação e Criação, com os passos aparecendo ao vivo e link para o rascunho salvo), `/agente/execucoes` (histórico) e `/agente/execucoes/:id` (passo a passo com tools, argumentos, duração e erros).
- Docs: execução do agente em segundo plano com consulta periódica (decisão 18) e contratos de documentos e execuções em `api.md`.
- Documentação técnica em `docs/`: arquitetura C4, modelo de dados, agente e RAG, API, implantação, registro de decisões e este changelog.

### Alterado

- Modelo de dados: nova entidade **Projeto** (marca ou cliente) acima de assuntos, documentos e execuções do agente; API, agente, RAG e rotas atualizados nos documentos (decisões 14 a 16).
- Frontend passa a usar o template TailAdmin no lugar de shadcn/ui (ver [decisão 8](decisoes.md)).

## Versão inicial

### Adicionado

- README com visão geral, requisitos do TCC e plano de entregas.
- CLAUDE.md com stack, convenções e ordem de corte.
