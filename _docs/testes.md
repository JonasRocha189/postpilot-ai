# Testes

> Status: **frontend coberto** (unidade, integração e aceite). Backend ainda sem pytest (próximo passo).

Requisito do TCC: testes de **unidade, integração e aceite**. Nenhum teste chama API paga nem depende de rede externa.

## Visão geral

| Tipo | Ferramenta | Onde | O que cobre | Comando |
| --- | --- | --- | --- | --- |
| Unidade | Vitest | `frontend/src/**/*.test.ts` | Funções puras: datas (`lib/format`), schema do post, hashtags e contagem de caracteres, tipos de imagem, cálculos da arte (quebra de linha, ajuste da fonte, recorte), cliente HTTP (`apiFetch`: erros, `204`, token) e paridade das traduções pt-BR/en | `cd frontend && npm run test` |
| Integração | Vitest + Testing Library + MSW | `frontend/src/test/integration/` | Páginas de verdade (TanStack Query, roteador, projeto atual) chamando os services `http` contra uma **API falsa em memória** (`src/test/fakeApi.ts`) com as mesmas regras do backend: escopo por projeto, `404`, `409`, `422` e upload para o S3 por URL pré-assinada | `cd frontend && npm run test` |
| Aceite (E2E) | Playwright | `e2e/tests/` | Fluxos completos no navegador: login, projeto → assunto → imagem → post com imagem → filtros → calendário → exclusões (com os `409`), validação de formulários e uso no celular | `cd e2e && npx playwright test` |

## Unidade e integração (Vitest)

- Configuração em `frontend/vitest.config.ts` (ambiente `jsdom`). O teste roda em modo **http**: `VITE_API_URL=http://api.test`, e o MSW responde (`onUnhandledFrame: "error"`, então qualquer chamada sem handler falha o teste).
- `src/test/fakeApi.ts`: handlers do MSW que imitam o FastAPI, com dados em memória, um **log das requisições** (para conferir URL, query string e corpo) e helpers para preparar dados (`addProject`, `addSubject`, `addPost`, `addImage`).
- `src/test/render.tsx`: `renderPage()` monta a página como no app (QueryClient novo por teste, `createMemoryRouter`, `ProjetoAtualProvider`, `ExigeProjeto`) e expõe a URL atual para conferir navegação.
- O jsdom não tem `<canvas>`: o teste de integração do editor de arte (`src/test/integration/art.test.tsx`) substitui só o módulo de desenho (`features/arte/canvas.ts`) e confere o resto (tamanho, escolhas, upload e corpo do post). Os cálculos (quebra de linha, ajuste da fonte, recorte) têm teste de unidade em `features/arte/layout.test.ts`, e o desenho real é conferido no aceite (`e2e/tests/artwork.spec.ts`, pela cor dos pixels), para imagem única e carrossel.
- Limite de 15 s por teste (`testTimeout`), porque os fluxos longos de formulário passam dos 5 s padrão quando os arquivos rodam em paralelo.
- O teste de traduções (`src/locales/locales.test.ts`) falha se uma chave existir só em um idioma ou se os `{placeholders}` forem diferentes.

## Aceite (Playwright)

Pasta `e2e/` com `package.json` próprio. Dois modos:

| Modo | Como rodar | O que testa |
| --- | --- | --- |
| **Isolado** (padrão) | `npx playwright test` | O Playwright sobe o frontend em `:5174` com a **API fictícia** e o login fictício. Não precisa de backend; resultado determinístico |
| **Stack completa** | `E2E_BASE_URL=http://localhost:5173 npx playwright test` | Os mesmos testes contra um app já rodando: frontend + FastAPI + Postgres + LocalStack (`docker compose up -d`, backend e `npm run dev` com `VITE_API_URL`). Valida a integração de verdade, inclusive o upload para o S3 |

- Projetos: `desktop` (Chrome) e `mobile` (Pixel 7, só `responsive.spec.ts`, que também confere que não há rolagem horizontal).
- Os testes criam dados com nomes únicos (`E2E …`) e apagam tudo no final, então podem rodar contra o banco de desenvolvimento.
- Sem Auth0 configurado, o botão **Entrar** abre a sessão fictícia. Contra o ambiente publicado (com Auth0), o login precisará de um usuário de teste (próximo passo, junto com o CI).
- Em caso de falha: `npx playwright show-report` (trace, screenshot e vídeo do passo que falhou).
