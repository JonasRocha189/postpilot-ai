# Changelog

Funcionalidades entregues, da mais recente para a mais antiga. Atualize a cada push de funcionalidade nova, junto com os documentos afetados em [`docs/`](README.md).

Formato de cada entrada:

```
## AAAA-MM-DD
### Adicionado | Alterado | Corrigido | Removido
- Descrição curta (commit ou PR)
```

---

## 2026-11-05

### Adicionado

- Backend: **autenticação com Auth0** (decisão 29). Toda rota da API exige `Authorization: Bearer <access token>`; o backend confere a assinatura RS256 com as chaves públicas do tenant (JWKS, em cache), o emissor (`iss`), a audiência (`aud`) e a validade (`exp`), e usa o `sub` do token como `user_id`. Token ausente ou inválido responde `401`; Auth0 fora do ar responde `503`. Novas variáveis `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` e `AUTH_DEV_USER` (só local).
- Backend: **verificação de saúde** sem autenticação: `GET /api/v1/health` (o processo responde) e `GET /api/v1/health/ready` (o banco responde a um `SELECT 1` em até 2 s; senão, `503`), para o health check da plataforma de hospedagem.
- Frontend: **logo do PostPilot**: avião de papel com rastro e um brilho (a IA), no azul da marca. Aparece no menu lateral (só o símbolo quando recolhido), nas telas de login e cadastro e como favicon (`favicon.svg`).

### Alterado

- Implantação planejada: **Vercel** (frontend), **Render** (backend) e **Neon** (PostgreSQL), no lugar da VPS com k3s (decisão 28). Deploy só pelo GitHub Actions, depois do lint e dos testes.
- `.gitignore` ignora `node_modules/` em qualquer pasta (antes, só na raiz).

### Corrigido

- Backend: o download das chaves públicas do Auth0 (JWKS) usa o repositório de certificados do sistema operacional (`truststore`). Com o OpenSSL padrão do Python, falhava com `certificate has expired` (resposta `503`) atrás de antivírus com inspeção de HTTPS, por causa de raízes vencidas no repositório do Windows.

### Testes

- Backend: **pytest** com testes de unidade da autenticação (validação do JWT com chaves RSA geradas no teste, sem rede) e da verificação de saúde, e testes de integração de **Projects** com **Testcontainers** (PostgreSQL + pgvector de verdade, esquema pelas migrations), incluindo autorização entre usuários. Documentado em [testes](testes.md).

### Removido

- `frontend/public/favicon.png` (era um PNG declarado como SVG no `index.html`).

## 2026-11-04

### Adicionado

- Frontend: **editor de arte** para post de imagem única (decisão 26). Abre pelo botão "Criar arte" do formulário do post, com a arte no tamanho da rede (Instagram 1080 × 1350 ou 1080 × 1080; LinkedIn 1200 × 1200, 1080 × 1350 ou 1200 × 627; X 1600 × 900 ou 1080 × 1080). O fundo pode ser uma cor ou uma imagem da biblioteca, recortada para cobrir a arte sem distorcer, com zoom, ajuste da parte visível (arrastando ou pelos controles) e escurecimento. O texto tem fonte, cor, alinhamento e posição fixa (topo, meio, base), e a fonte diminui sozinha quando o texto não cabe. "Usar no post" exporta a arte (PNG, ou JPEG quando o fundo é foto), envia para a biblioteca do projeto pelo fluxo de upload que já existia e a escolhe como imagem do post. Sem mudança no backend.
- Frontend: **carrossel no editor de arte**. Com o formato carrossel, o editor cria vários slides no mesmo tamanho, cada um com o próprio fundo e texto: novo slide (mesmo visual, sem texto), duplicar, remover e mudar a ordem, com miniaturas. "Usar no post" envia os slides para a biblioteca, um a um e na ordem, e os coloca no fim do carrossel, respeitando o máximo da rede (20 no Instagram e no LinkedIn, 4 no X). Se um envio falhar, tentar de novo não reenvia os slides que já foram. "Baixar slides" baixa um arquivo numerado por slide.
- Frontend: botão **Baixar imagem** no editor de arte, para quem só quer a imagem (publicar fora do PostPilot): baixa o arquivo (`postpilot-{rede}-{largura}x{altura}.png` ou `.jpg`) sem salvar nada na biblioteca.
- Frontend: o envio de imagem aceita uma descrição. A arte é salva com o próprio texto, que vira o texto alternativo.
- Testes: unidade dos cálculos da arte (quebra de linha, ajuste da fonte, recorte), integração do editor no formulário do post e aceite com o canvas de verdade (cores dos pixels, recorte da foto, exportação e upload), nos dois modos.

### Alterado

- Formulário do post: o texto do post (editor) passa a vir depois da imagem e do botão "Criar arte", já que a arte costuma ser feita primeiro.

### Corrigido

- Testes do frontend: limite de tempo por teste de 15 s. Os fluxos longos de formulário passavam dos 5 s padrão quando todos os arquivos rodavam em paralelo.

## 2026-11-03

### Adicionado

- Post com rede e formato (decisão 25): `network` e `format` no post, carrossel com várias imagens em ordem (`post_images`, migration `post network, format and images`) e regras por rede validadas no backend e no formulário.
- Frontend: formulário de post com escolha de rede e formato, editor de texto (emoji, marcador, hashtag, contador e prévia no feed), data no calendário (flatpickr, no formato do idioma) e seleção de várias imagens com reordenação. Lista e calendário mostram a rede e o formato.
- Frontend: página `/best-practices` (menu "Boas práticas"), só leitura: princípios gerais e, para Instagram, LinkedIn e X, tamanhos de post único e carrossel, limites de texto, hashtags, boas práticas, frequência, métricas e fontes de inspiração (pt-BR e en). Revisada em novembro de 2026.
- Frontend: teste de traduções confere também o tamanho das listas nos dois idiomas.
- Testes do frontend (decisão 24, ver `testes.md`): 35 de unidade e 20 de integração (Vitest, Testing Library, MSW com API falsa) e 5 de aceite (Playwright, desktop e celular), rodando com a API fictícia ou contra a stack completa.
- API: filtros `status`, `from` e `to` em `GET /posts`. O calendário busca só o mês visível e o filtro de status da lista de posts passa a funcionar com a API real.
- Frontend: modais com `role="dialog"` e botão de fechar com rótulo (acessibilidade).
- API: biblioteca de imagens por projeto (`/api/v1/images`): URL pré-assinada de upload, registro depois do envio (confere chave, existência e tamanho no S3), listagem com URL de leitura e exclusão (`409` se algum post usa). Migration `image library per project`.
- API: `image_id` no post (imagem da biblioteca do projeto do assunto, `422` caso contrário) e `409` ao excluir projeto com imagens.
- Backend: cliente S3 (boto3) em `storage/s3.py` e variáveis `S3_*`; LocalStack no `docker-compose.yaml` como S3 local, com o bucket e o CORS criados por `infra/localstack/init-s3.sh` (decisão 23).
- Backend: CORS configurável (`CORS_ORIGINS`) para o Vite em desenvolvimento.
- Frontend: projetos, assuntos, posts e imagens ligados à API real (com `VITE_API_URL`).
- Frontend: página `/images` (biblioteca do projeto) e seletor de imagem no formulário do post (decisão 22). Status `review` nos posts.
- Frontend: menu reordenado (Dashboard, Projetos, Assuntos, Posts, Imagens, Calendário | Documentos, Agente, Execuções | Perfil).

- Backend: FastAPI, conexão assíncrona com o PostgreSQL (SQLAlchemy + asyncpg), configuração por `.env` (pydantic-settings) e Alembic com a primeira migration (`projects`, `subjects`, `posts`, `images`).
- API: CRUD de projetos (`/api/v1/projects`), filtrado pelo dono e com `409` ao excluir projeto com assuntos. Usuário fixo `dev-user` até a integração com o Auth0 (dependência `get_current_user_id`).
- Ambiente local: Postgres do Docker na porta `5433`, para não conflitar com um PostgreSQL instalado no Windows.

### Corrigido

- Frontend: rótulos "Conteúdo" do formulário de post (estavam em `calendar.details`) e textos que ainda falavam de variações.

### Alterado

- Frontend: URLs das páginas em inglês (`/projects`, `/subjects`, `/images`, `/calendar`, `/documents`, `/agent/runs`, `/profile`, `/signup`, `/error`) e campos, valores de enum e rotas da API em inglês, como o backend (decisão 21).
- Frontend: post sem variações por rede por enquanto (um `content` por post); imagens e métricas por variação saíram da tela do post.
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
