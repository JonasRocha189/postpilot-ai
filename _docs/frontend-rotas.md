# Rotas do frontend

> Status: **em implementação**. Atualize esta página sempre que uma rota for criada, alterada ou removida.
>
> **Implementadas:** todas as rotas planejadas. `/login`, `/cadastro`, `/erro`, `/`, `/projetos`, `/assuntos` e `/posts` (lista, novo e edição; posts com o mestre-detalhe das variações), o seletor de projeto no cabeçalho, `/calendario` (com os posts), `/documentos` (upload e status), `/agente`, `/agente/execucoes` e `/agente/execucoes/:id` (passos ao vivo), `/dashboard` (ainda com dados de exemplo), `/perfil` e `*`.
>
> **Dados de exemplo:** sem `VITE_API_URL`, o `npm run dev` usa uma API fictícia no navegador (`lib/api/mockDb.ts`, guardada no `localStorage`), com as mesmas regras da API real (`404`, `409`). Com `VITE_API_URL`, as mesmas telas chamam o backend.
>
> Todas as telas estão em **português e inglês**. O seletor de idioma fica no cabeçalho (entre o tema e o usuário) e no rodapé das telas de login e cadastro.
> As páginas de demonstração do TailAdmin ficam em `/template/*` só como referência visual e devem ser removidas antes da entrega.

Roteamento com React Router. Páginas carregadas sob demanda (`React.lazy`) para reduzir o bundle inicial.

## Públicas

| Rota | Página | Observação |
| --- | --- | --- |
| `/login` | Tela de entrada com o botão **Entrar** e link para `/cadastro` | Redireciona para o Auth0 (Universal Login) e é também o `redirect_uri` de volta do Auth0 |
| `/cadastro` | Tela de cadastro com o botão **Criar conta** | Abre o Auth0 direto na tela de cadastro (`screen_hint=signup`). Mantida como garantia, mesmo que o fluxo principal comece em `/login` |
| `/erro` | Página de erro com botão "tentar novamente" | Recebe erros do Auth0 (`?error=…&error_description=…`, ex.: acesso negado). O mesmo componente é o `errorElement` do roteador, exibido em falhas inesperadas |
| `*` | Página não encontrada (404) | Reaproveita o `NotFound` do template. Renderizada na própria URL digitada, sem redirecionar |

## Protegidas

Dentro do `AppLayout`. Sem sessão, o usuário é redirecionado para `/login`.

**Projeto atual:** um seletor no cabeçalho (no lugar da busca do template) define o projeto em que o usuário está trabalhando (como em Vercel ou Linear). As rotas de conteúdo não mudam; elas mostram só os dados do projeto selecionado, e as chamadas à API enviam o `projeto_id`. A escolha fica salva no navegador. Sem nenhum projeto cadastrado, as telas de conteúdo mostram um convite para criar o primeiro projeto.

| Rota | Página | API usada | Requisito do TCC |
| --- | --- | --- | --- |
| `/` | Redireciona para `/dashboard` | | |
| `/projetos` | Lista de projetos (marca própria ou clientes) | `GET /projetos`, `DELETE /projetos/{id}` | CRUD |
| `/projetos/novo` | Cadastro de projeto: nome, descrição, público-alvo e tom de voz padrão | `POST /projetos` | CRUD |
| `/projetos/:id` | Edição de projeto | `GET`, `PUT /projetos/{id}` | CRUD |
| `/dashboard` | Posts por status, próximos posts previstos, últimas execuções do agente e **todas as métricas de desempenho** (impressões e engajamento por assunto, rede, dia e horário) | `GET /posts`, `GET /agente/execucoes`, `GET /relatorio/desempenho` | Relatório de desempenho |
| `/assuntos` | Lista de assuntos | `GET /assuntos`, `DELETE /assuntos/{id}` | CRUD |
| `/assuntos/novo` | Cadastro de assunto | `POST /assuntos` | CRUD |
| `/assuntos/:id` | Edição de assunto | `GET`, `PUT /assuntos/{id}` | CRUD |
| `/posts` | Lista de posts, com filtros na URL (`?status=rascunho&assunto=…`) | `GET /posts`, `DELETE /posts/{id}` | CRUD |
| `/posts/novo` | Cadastro de post com suas variações. Depois de criar, abre `/posts/:id` para adicionar imagens | `POST /posts` | CRUD + mestre-detalhe |
| `/posts/:id` | **Mestre-detalhe**: dados do post no topo e uma aba por rede (LinkedIn, Instagram, X) com texto, hashtags e contador de caracteres pelo limite da rede, mais as **imagens** (envio direto para o S3; as geradas pelo agente mostram o prompt) e as **métricas** da variação (resumo, histórico de coletas e registro, só com o post publicado). Imagens e métricas são gravadas na hora e aparecem quando a variação já está salva | `GET`, `PUT /posts/{id}`, `/variacoes/{id}/imagens`, `/variacoes/{id}/metricas` | Mestre-detalhe |
| `/calendario` | Posts no calendário pela `data_prevista`, com cor por status. Clicar em um post abre um modal de detalhes com link para `/posts/:id` | `GET /posts` | |
| `/documentos` | Lista com status de processamento e upload na mesma tela | `/documentos/*` | IA (RAG) |
| `/agente` | Conversa com o agente, com troca de modo (`?modo=ideacao` ou `criacao`) | `POST /agente/execucoes` | IA |
| `/agente/execucoes` | Histórico de execuções | `GET /agente/execucoes` | |
| `/agente/execucoes/:id` | Uma execução com seus passos (tool, argumentos, duração, erro) | `GET /agente/execucoes/{id}` | |
| `/perfil` | Dados do usuário (Auth0) e botão de alterar senha | Auth0 | Ciclo de vida do usuário |

## Menu lateral

```
[Projeto atual ▾]   ← seletor no cabeçalho
Dashboard
Projetos
Conteúdo
  ├─ Posts
  ├─ Calendário
  ├─ Assuntos
  └─ Documentos
Agente
  ├─ Nova conversa
  └─ Histórico
─────────
Perfil · Sair
```

## Decisões

- **Sem formulários próprios de login e cadastro.** As páginas `/signin` e `/signup` do template saíram; `/login` e `/cadastro` só levam ao Auth0, que hospeda login, cadastro e redefinição de senha.
- **Modo de desenvolvimento sem Auth0.** Sem `VITE_AUTH0_DOMAIN` e `VITE_AUTH0_CLIENT_ID`, o `npm run dev` entra com um usuário fictício (ver `frontend/.env.example`). No build de produção isso nunca acontece: sem configuração, o login fica indisponível.
- **Roteador com data router** (`createBrowserRouter`), necessário para o `errorElement` e para o carregamento sob demanda (`lazy`) de cada página.
- **Imagens e métricas ficam no detalhe do post**, na aba de cada variação, pois pertencem a uma variação. São gravadas na hora (não esperam o "Salvar" do post), e os modais delas são renderizados fora do `<form>` do post (`components/common/Portal.tsx`). Remover uma variação salva que tem imagens ou métricas pede confirmação.
- **"Novo" e "editar" usam o mesmo formulário**: `/novo` começa vazio e `/:id` carrega os dados. Um schema Zod por entidade.
- **Filtros na query string**, não em estado do componente: links compartilháveis, botão voltar funciona e os testes Playwright abrem a lista já filtrada.
- **Calendário reaproveita o do template** (FullCalendar, já instalado). Mostra os posts no mês, com cor por status; não cria eventos próprios. Clicar num post abre um modal com os detalhes e o botão "Abrir post", que leva a `/posts/:id`.
- **Sem rota `/404`.** O `*` mostra o 404 na URL que o usuário digitou, preservando o endereço e o histórico. Erros de verdade (Auth0, falhas inesperadas) vão para `/erro`.
- **Sem rota `/relatorio`.** Desde 2026-10-27, todas as métricas de desempenho ficam no `/dashboard` (por enquanto). As métricas de cada variação continuam sendo registradas no detalhe do post.

## Ordem de implementação

1. Auth0 + layout protegido + `/login` + `/perfil`
2. `/projetos` e o seletor de projeto no cabeçalho
3. `/assuntos`
4. `/posts` e `/posts/:id`, depois `/calendario`
5. `/documentos` e `/agente`
6. `/dashboard`
