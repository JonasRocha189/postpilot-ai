# Rotas do frontend

> Status: **em implementação**. Atualize esta página sempre que uma rota for criada, alterada ou removida.
>
> **Implementadas:** `/login`, `/signup`, `/error`, `/`, `/projects`, `/subjects` e `/posts` (lista, novo e edição), `/images` (biblioteca de imagens do projeto), o seletor de projeto no cabeçalho, `/calendar`, `/best-practices` (guia de boas práticas por rede), `/documents`, `/agent`, `/agent/runs` e `/agent/runs/:id`, `/dashboard`, `/profile` e `*`.
>
> **Ligadas à API real:** todas as páginas. A API fictícia (`lib/api/mockDb.ts`) só é usada no modo de demonstração e nos testes de aceite.
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
| `/dashboard` | Variações por status, próximos posts previstos (data prevista a partir de hoje, ainda não publicados), últimas 5 execuções do agente e desempenho: engajamento por rede, melhor dia e horário (madrugada, manhã, tarde, noite) e desempenho por assunto, com "amostra insuficiente" abaixo de 5 posts. Sem métricas, um convite para importar em `/metrics`. Agregação em `features/dashboard/aggregate.ts` | `GET /posts`, `GET /subjects`, `GET /agent/runs`, `GET /reports/performance` | Relatório de desempenho |
| `/projects` | Lista de projetos (marca própria ou clientes) | `GET /projects`, `DELETE /projects/{id}` | CRUD |
| `/projects/new` | Cadastro de projeto: nome, descrição, público-alvo e tom de voz padrão | `POST /projects` | CRUD |
| `/projects/:id` | Edição de projeto | `GET`, `PUT /projects/{id}` | CRUD |
| `/subjects` | Lista de assuntos | `GET /subjects`, `DELETE /subjects/{id}` | CRUD |
| `/subjects/new` | Cadastro de assunto | `POST /subjects` | CRUD |
| `/subjects/:id` | Edição de assunto | `GET`, `PUT /subjects/{id}` | CRUD |
| `/posts` | Lista de posts, com filtros na URL (`?status=draft&subject=…`) | `GET /posts`, `DELETE /posts/{id}` | CRUD |
| `/posts/new` | Cadastro de post: título, assunto, status, **data no calendário** (flatpickr, dd/mm/aaaa em pt-BR), **rede** e **formato** (só texto, imagem única, carrossel), **editor de texto** (emoji, marcador, hashtag, contador pelo limite da rede e prévia cortada no “ver mais”) e **imagens da biblioteca** na ordem do carrossel. O botão **Criar arte** abre o editor (decisão 26): arte no tamanho da rede com fundo de cor ou foto da biblioteca e texto, salva na biblioteca e escolhida para o post (no carrossel, vários slides que entram no fim do carrossel, na ordem), ou só baixada ("Baixar imagem"). O texto do post vem depois da imagem | `POST /posts`, `GET /images` | CRUD |
| `/posts/:id` | Edição do post (mesmo formulário) | `GET`, `PUT /posts/{id}` | CRUD |
| `/ideas` | **Ideias**: cartões com título, anotações, assunto, redes sugeridas e origem ("Sugerida pelo agente"); filtro Abertas / Viraram post / Todas (`?show=used` ou `all`); criar e editar num modal; excluir. **Criar post** abre `/posts/new?idea=…` com título, assunto e uma variação por rede sugerida; depois de salvar, a ideia vira "Virou post" com link para ele | `GET`, `POST /ideas`, `PUT`, `DELETE /ideas/{id}` | |
| `/metrics` | **Importação de métricas** por rede (`?network=instagram` ou `x`; LinkedIn por padrão): instruções de exportação, modelo de CSV para baixar, envio do arquivo e data da coleta, prévia com erros por linha e associação de cada linha a uma variação publicada da rede (automática pela data, editável). Importa tudo de uma vez | `GET /posts?network&status=published`, `POST /metrics/import` | Relatório de desempenho |
| `/images` | **Biblioteca de imagens do projeto**: envio direto para o S3 (vários arquivos, com progresso), ampliação com os posts que usam a imagem e exclusão (`409` se algum post a usa) | `GET /images`, `POST /images/upload-url`, `POST /images`, `DELETE /images/{id}` | |
| `/calendar` | Posts no calendário pela `expected_date`, com cor por status. Busca só o mês visível (`?from=…&to=…`) e mantém o mês anterior na tela enquanto carrega o próximo. Clicar em um post abre um modal com link para `/posts/:id` | `GET /posts?from&to` | |
| `/best-practices` | **Guia de boas práticas** (só leitura, sem CRUD e sem projeto): princípios gerais e uma aba por rede (`?network=instagram`, `linkedin` ou `x`) com formatos e tamanhos (único, carrossel, vertical), limite de texto, hashtags, o que funciona, quando publicar, métricas e fontes de inspiração. Textos no i18n (`bestPractices`); limites de caracteres vêm de `features/posts/redes.ts` | | |
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
Boas práticas
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
- **Saída por inatividade.** O `RequireAuth` monta o `IdleLogout` (`lib/auth/useIdleLogout.ts`): 30 minutos sem atividade em nenhuma aba encerram a sessão (`logout` do Auth0), com aviso e contagem regressiva no último minuto. Como o refresh token fica no `localStorage`, sem isso a sessão continuaria aberta por dias num computador compartilhado. O login marca o início da sessão; o logout limpa o registro.
- **Modo de desenvolvimento sem Auth0.** Sem `VITE_AUTH0_DOMAIN` e `VITE_AUTH0_CLIENT_ID`, o `npm run dev` entra com um usuário fictício (ver `frontend/.env.example`). No build de produção isso nunca acontece: sem configuração, o login fica indisponível.
- **Roteador com data router** (`createBrowserRouter`), necessário para o `errorElement` e para o carregamento sob demanda (`lazy`) de cada página.
- **Imagens numa biblioteca por projeto** ([decisão 22](decisoes.md)). O post aponta para imagens da biblioteca, em ordem (`image_ids`); o seletor do formulário abre a biblioteca num modal renderizado fora do `<form>` (`components/common/Portal.tsx`).
- **Post com variações por rede na mesma tela** ([decisão 30](decisoes.md)): uma aba por rede marcada, salvas junto com o post (`POST`/`PUT /posts` com `variations`).
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
