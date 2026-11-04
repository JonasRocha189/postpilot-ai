# Rotas do frontend

> Status: **em implementação**. Atualize esta página sempre que uma rota for criada, alterada ou removida.
>
> **Implementadas:** `/login`, `/signup`, `/error`, `/`, `/projects`, `/subjects` e `/posts` (lista, novo e edição), `/images` (biblioteca de imagens do projeto), o seletor de projeto no cabeçalho, `/calendar`, `/documents`, `/agent`, `/agent/runs` e `/agent/runs/:id`, `/dashboard` (ainda com dados de exemplo), `/profile` e `*`.
>
> **Ligadas à API real:** projetos, assuntos, posts e imagens. Documentos, agente e dashboard ainda usam a API fictícia.
>
> **Dados de exemplo:** sem `VITE_API_URL`, o `npm run dev` usa uma API fictícia no navegador (`lib/api/mockDb.ts`, guardada no `localStorage`), com as mesmas regras da API real (`404`, `409`, `422`). Com `VITE_API_URL`, as mesmas telas chamam o backend.
>
> Todas as telas estão em **português e inglês**. O seletor de idioma fica no cabeçalho (entre o tema e o usuário) e no rodapé das telas de login e cadastro.
> As páginas de demonstração do TailAdmin ficam em `/template/*` só como referência visual e devem ser removidas antes da entrega.

Roteamento com React Router. **As URLs das páginas ficam em inglês**, como as rotas da API (ver [decisão 21](decisoes.md), que revê a decisão 20); só os textos da interface ficam em português (e inglês, via i18n). Páginas carregadas sob demanda (`lazy`) para reduzir o bundle inicial.

## Públicas

| Rota | Página | Observação |
| --- | --- | --- |
| `/login` | Tela de entrada com o botão **Entrar** e link para `/signup` | Redireciona para o Auth0 (Universal Login) e é também o `redirect_uri` de volta do Auth0 |
| `/signup` | Tela de cadastro com o botão **Criar conta** | Abre o Auth0 direto na tela de cadastro (`screen_hint=signup`) |
| `/error` | Página de erro com botão "tentar novamente" | Recebe erros do Auth0 (`?error=…&error_description=…`, ex.: acesso negado). O mesmo componente é o `errorElement` do roteador, exibido em falhas inesperadas |
| `*` | Página não encontrada (404) | Renderizada na própria URL digitada, sem redirecionar |

## Protegidas

Dentro do `AppLayout`. Sem sessão, o usuário é redirecionado para `/login`.

**Projeto atual:** um seletor no cabeçalho define o projeto em que o usuário está trabalhando (como em Vercel ou Linear). As rotas de conteúdo mostram só os dados do projeto selecionado, e as chamadas à API enviam o `project_id`. A escolha fica salva no navegador. Sem nenhum projeto cadastrado, as telas de conteúdo mostram um convite para criar o primeiro projeto.

| Rota | Página | API usada | Requisito do TCC |
| --- | --- | --- | --- |
| `/` | Redireciona para `/dashboard` | | |
| `/dashboard` | Posts por status, próximos posts previstos, últimas execuções do agente e métricas de desempenho (por assunto, rede, dia e horário) | `GET /posts`, `GET /agent/runs`, `GET /reports/performance` | Relatório de desempenho |
| `/projects` | Lista de projetos (marca própria ou clientes) | `GET /projects`, `DELETE /projects/{id}` | CRUD |
| `/projects/new` | Cadastro de projeto: nome, descrição, público-alvo e tom de voz padrão | `POST /projects` | CRUD |
| `/projects/:id` | Edição de projeto | `GET`, `PUT /projects/{id}` | CRUD |
| `/subjects` | Lista de assuntos | `GET /subjects`, `DELETE /subjects/{id}` | CRUD |
| `/subjects/new` | Cadastro de assunto | `POST /subjects` | CRUD |
| `/subjects/:id` | Edição de assunto | `GET`, `PUT /subjects/{id}` | CRUD |
| `/posts` | Lista de posts, com filtros na URL (`?status=draft&subject=…`) | `GET /posts`, `DELETE /posts/{id}` | CRUD |
| `/posts/new` | Cadastro de post: título, assunto, status, data prevista, conteúdo e **imagem escolhida na biblioteca** do projeto | `POST /posts`, `GET /images` | CRUD |
| `/posts/:id` | Edição do post (mesmo formulário) | `GET`, `PUT /posts/{id}` | CRUD |
| `/images` | **Biblioteca de imagens do projeto**: envio direto para o S3 (vários arquivos, com progresso), ampliação com os posts que usam a imagem e exclusão (`409` se algum post a usa) | `GET /images`, `POST /images/upload-url`, `POST /images`, `DELETE /images/{id}` | |
| `/calendar` | Posts no calendário pela `expected_date`, com cor por status. Busca só o mês visível (`?from=…&to=…`) e mantém o mês anterior na tela enquanto carrega o próximo. Clicar em um post abre um modal com link para `/posts/:id` | `GET /posts?from&to` | |
| `/documents` | Lista com status de processamento e upload na mesma tela | `/documents/*` | IA (RAG) |
| `/agent` | Conversa com o agente, com troca de modo (`?mode=ideation` ou `creation`) | `POST /agent/runs` | IA |
| `/agent/runs` | Histórico de execuções | `GET /agent/runs` | |
| `/agent/runs/:id` | Uma execução com seus passos (tool, argumentos, duração, erro) | `GET /agent/runs/{id}` | |
| `/profile` | Dados do usuário (Auth0) e botão de alterar senha | Auth0 | Ciclo de vida do usuário |

## Menu lateral

```
[Projeto atual ▾]   ← seletor no cabeçalho
Dashboard
Projetos
Assuntos
Posts
Imagens
Calendário
─────────
Documentos
Agente
Execuções
─────────
Perfil
```

Os divisores vêm da propriedade `divider` dos itens em `layout/AppSidebar.tsx`.

## Decisões

- **Sem formulários próprios de login e cadastro.** `/login` e `/signup` só levam ao Auth0, que hospeda login, cadastro e redefinição de senha.
- **Modo de desenvolvimento sem Auth0.** Sem `VITE_AUTH0_DOMAIN` e `VITE_AUTH0_CLIENT_ID`, o `npm run dev` entra com um usuário fictício (ver `frontend/.env.example`). No build de produção isso nunca acontece: sem configuração, o login fica indisponível.
- **Roteador com data router** (`createBrowserRouter`), necessário para o `errorElement` e para o carregamento sob demanda (`lazy`) de cada página.
- **Imagens numa biblioteca por projeto** ([decisão 22](decisoes.md)). O post aponta para uma imagem da biblioteca (`image_id`); o seletor do formulário abre a biblioteca num modal renderizado fora do `<form>` (`components/common/Portal.tsx`).
- **Posts sem variações por rede, por enquanto.** O backend ainda não tem `post_variations`; o post tem um único `content`. As telas de variações e métricas por variação voltam quando o backend as tiver.
- **"Novo" e "editar" usam o mesmo formulário**: `/new` começa vazio e `/:id` carrega os dados. Um schema Zod por entidade.
- **Filtros na query string**, não em estado do componente: links compartilháveis, botão voltar funciona e os testes Playwright abrem a lista já filtrada.
- **Calendário reaproveita o do template** (FullCalendar). Mostra os posts como eventos de dia inteiro (a `expected_date` é só a data), com cor por status.
- **Sem rota `/404`.** O `*` mostra o 404 na URL que o usuário digitou. Erros de verdade (Auth0, falhas inesperadas) vão para `/error`.
- **Sem rota `/relatorio`.** As métricas de desempenho ficam no `/dashboard` (por enquanto).

## Ordem de implementação

1. Auth0 + layout protegido + `/login` + `/profile`
2. `/projects` e o seletor de projeto no cabeçalho
3. `/subjects`
4. `/posts` e `/posts/:id`, `/images`, depois `/calendar`
5. `/documents` e `/agent`
6. `/dashboard`
