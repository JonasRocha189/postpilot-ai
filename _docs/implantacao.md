# Implantação, CI/CD e IaC

> Status: **em produção** desde 08/11 em https://postpilot.jonas-rocha.com. Plataformas definidas na [decisão 28](decisoes.md) (substitui a VPS com k3s): Vercel (frontend), Render (backend, `postpilot-apit.onrender.com`), Neon (PostgreSQL) e AWS pelo Terraform. Cada merge na `main` passa pelo pipeline completo (lint, testes, imagem, deploy e smoke test). O banco tem backup diário no S3. Não altere recursos em produção sem revisar antes o `terraform plan`.

## Modelo de implantação

```mermaid
flowchart TB
    dev["💻 Desenvolvedor"]
    browser["👤 Navegador"]

    subgraph github["GitHub"]
        repo["Repositório (monorepo)"]
        actions["GitHub Actions"]
        ghcr["GHCR<br/><i>imagem do backend</i>"]
    end

    subgraph vercel["Vercel"]
        front["Frontend estático<br/><i>postpilot.jonas-rocha.com</i><br/>rewrite /api/* → Render"]
    end

    subgraph render["Render"]
        back["Web service Docker<br/><i>FastAPI</i><br/>health check /api/v1/health/ready"]
    end

    subgraph neon["Neon"]
        pg[("PostgreSQL 18<br/>+ pgvector")]
    end

    subgraph aws["AWS"]
        s3["S3 (privado, SSE-S3)"]
        iam["Usuário IAM<br/><i>menor privilégio</i>"]
        budget["Budget + alerta"]
    end

    auth0["Auth0"]

    dev -- "git push" --> repo
    repo --> actions
    actions -- "build + push" --> ghcr
    actions -- "Deploy Hook" --> back
    actions -- "vercel deploy --prod" --> front
    actions -- "backup agendado (pg_dump)" --> s3
    back -- "pull" --> ghcr
    browser -- "HTTPS" --> front
    front -- "/api/*" --> back
    browser -- "Login (PKCE)" --> auth0
    browser -- "Upload/download<br/>(URL pré-assinada)" --> s3
    back --> pg
    back --> s3
    back -- "JWKS" --> auth0
```

- **Uma só origem:** o domínio aponta para a Vercel, que repassa `/api/*` para a Render. O navegador não faz chamadas entre origens, então o CORS da API fica vazio em produção.
- **Render gratuita:** dorme depois de cerca de 15 minutos sem uso, e a primeira requisição leva de 30 a 60 s. Antes de uma apresentação, abra o app (ou chame `/api/v1/health`) um minuto antes.
- **Neon gratuito:** pouco armazenamento e pausa sem uso; usar a connection string com SSL nas variáveis da Render.

## Pipeline (GitHub Actions)

Um só arquivo, `.github/workflows/ci-cd.yml`, com seis jobs:

```mermaid
flowchart LR
    backend["backend<br/><i>Ruff, mypy, pytest<br/>unidade + integração</i>"]
    frontend["frontend<br/><i>ESLint, tsc, Vitest, build</i>"]
    e2e["e2e<br/><i>Playwright com a API fictícia</i>"]
    image["image<br/><i>build e push no GHCR</i>"]
    deploy["deploy<br/><i>Deploy Hook da Render<br/>vercel deploy --prod</i>"]
    smoke["smoke<br/><i>health check e páginas<br/>no ambiente publicado</i>"]

    backend --> image
    frontend --> image
    e2e --> image
    image --> deploy --> smoke
```

| Job | O que faz |
| --- | --- |
| `backend` | `uv sync --locked` (Python 3.12, o mesmo da imagem), `ruff check`, `ruff format --check`, `mypy`, testes de unidade e de integração (Testcontainers sobe o `pgvector/pgvector` no próprio runner) |
| `frontend` | `npm ci`, ESLint, `tsc -b`, Vitest e `vite build` |
| `e2e` | Playwright (Chromium) contra o frontend com a API e o login fictícios; em caso de falha, o relatório fica como artefato por 7 dias |
| `image` | Build do `backend/Dockerfile` e push para `ghcr.io/jonasrocha189/postpilot-backend` com as tags do SHA do commit e `latest` (cache das camadas no GitHub Actions) |
| `deploy` | Chama o Deploy Hook da Render com `imgURL` apontando para a imagem do SHA (não para `latest`) e depois `vercel deploy --prod` (a Vercel faz o build com as variáveis `VITE_*` do painel). Roda no environment `production` do GitHub, um deploy por vez |
| `smoke` | Espera até 10 min o `/api/v1/health/ready` responder (pull da imagem, migrations, Render acordando) e confere que `/`, `/posts` e `/login` devolvem o app |

- **Em pull requests**, só `backend`, `frontend` e `e2e`; os outros aparecem como *skipped*. Na `main`, todos, nessa ordem.
- O deploy automático da Vercel e da Render fica **desligado**: só o pipeline publica, e só com lint e testes passando.
- **Rollback:** cada imagem tem o SHA do commit na tag, então voltar uma versão é chamar o Deploy Hook com a imagem anterior (ou redeploy pelo painel da Render).
- **Segredos do pipeline** (GitHub → Settings → Secrets and variables → Actions): `RENDER_DEPLOY_HOOK_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (`orgId` e `id` do projeto em `.vercel/repo.json`, criado na raiz pela Vercel CLI, ou em Settings → General no painel da Vercel). O push no GHCR usa o `GITHUB_TOKEN` da própria execução.
- **Pacote no GHCR público**, para a Render baixar a imagem sem credenciais; a imagem não tem segredos (o `.dockerignore` exclui o `.env`).
- **Limite do smoke test:** confere que a API e as páginas respondem, não qual versão está no ar. O aceite completo com Playwright no ambiente publicado precisa de um usuário de teste no Auth0 (próximo passo).

## Artefatos de IaC

| Ferramenta | Pasta | Responsabilidade |
| --- | --- | --- |
| Terraform | `infra/terraform/` | **AWS:** bucket S3 do app (Block Public Access, SSE-S3, CORS com `GET`, `HEAD` e `PUT` só para o domínio de produção e `localhost:5173`, lifecycle de uploads incompletos), usuário IAM do backend com menor privilégio, AWS Budget com alerta por e-mail. Estado remoto no S3 |
| GitHub Actions | `.github/workflows/` | Pipeline e backup agendado (`pg_dump` do Neon para o S3) |

**Vercel, Render e Neon** foram configurados pelo painel de cada plataforma, não pelo Terraform: são poucos recursos, criados uma vez, e os providers dessas plataformas pediriam mais tokens e tempo a poucos dias do prazo. Fica no roadmap trazê-los para o Terraform.

### Terraform

| Arquivo | Conteúdo |
| --- | --- |
| `versions.tf` | Terraform ≥ 1.10, provider `hashicorp/aws ~> 6.0` e o backend `s3` |
| `providers.tf` | Região e tags padrão (`Project`, `ManagedBy`) em todos os recursos |
| `variables.tf` | `region`, `app_origins` (CORS), `budget_limit_usd` (5) e `budget_email` |
| `s3.tf` | Bucket `postpilot-prod-<conta>` com Block Public Access, SSE-S3, CORS e lifecycle |
| `iam.tf` | Usuário `postpilot-backend`: `GetObject`, `PutObject` e `DeleteObject` nos objetos do bucket e `ListBucket` no bucket; chave de acesso para a Render |
| `budget.tf` | US$ 5 por mês: e-mail com 80% gasto e com previsão de passar de 100% |
| `outputs.tf` | Bucket, região e a chave do backend (o segredo é `sensitive`) |

- **Estado remoto:** bucket `postpilot-tfstate-<conta>` (versionado, privado), criado uma vez pela AWS CLI, porque o Terraform não guarda o estado num bucket que ele mesmo ainda vai criar. A trava usa o lockfile nativo do S3 (`use_lockfile`), sem DynamoDB.
- **`ListBucket`:** sem ela, um `HEAD` num objeto que não existe responde `403` em vez de `404`, e o `POST /images` responderia `500` em vez de "Image was not uploaded".
- **Segredo da chave do backend:** fica no estado (bucket privado e criptografado) e só sai com `terraform output -raw backend_secret_access_key`, direto para as variáveis da Render.
- No Git vão os `.tf` e o `.terraform.lock.hcl`; `.terraform/`, `*.tfstate` e `tfplan` ficam no `.gitignore`.

```powershell
cd infra/terraform
terraform init
terraform plan -var "budget_email=<e-mail>" -out tfplan   # revisar
terraform apply tfplan
terraform output
```

## Configuração e segredos

- Configuração só por variáveis de ambiente (pydantic-settings). O `.env.example` lista todas.
- Em produção, os segredos ficam nas variáveis de ambiente da Render e da Vercel (definidas no painel de cada uma). No pipeline, em GitHub Secrets (tokens da Vercel e da Render, Deploy Hook, credenciais da AWS).
- `AUTH_DEV_USER` fica **vazio** em produção, para a API sempre exigir token.
- Nunca commitar `.env` ou chaves.

## Vercel (`frontend/vercel.json`)

O projeto da Vercel usa Root Directory `frontend` e o preset Vite (`npm run build`, saída `dist`). O `vercel.json` define:

| Regra | Efeito |
| --- | --- |
| `/api/:path*` → `https://postpilot-apit.onrender.com/api/:path*` | A Vercel repassa as chamadas da API para a Render (caminho, query string, cabeçalhos como `Authorization` e corpo). O navegador só fala com `postpilot.jonas-rocha.com` |
| `/(.*)` → `/index.html` | Fallback da SPA: arquivos que existem (`/assets/*`, `favicon`) são servidos antes; as outras rotas (`/posts`, `/login`, retorno do Auth0) caem no `index.html` e o React Router assume |
| Cabeçalho `Cache-Control` em `/assets/*` | Cache de um ano (`immutable`): o Vite põe um hash no nome desses arquivos. O `index.html` não fica em cache, então um deploy novo aparece na hora |
| `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` | Cabeçalhos de segurança em todas as respostas (o `DENY` impede embutir o app num iframe; o Auth0 redireciona a página inteira, então não é afetado) |

- Em produção, `VITE_API_URL` fica **vazio**: o cliente HTTP chama `/api/v1` na mesma origem.
- **Variáveis da Vercel (Production), todas públicas:** `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` (`https://postpilot.jonas-rocha.com/api`) e `VITE_AUTH0_DB_CONNECTION` (`Username-Password-Authentication`, o nome da conexão de usuários do Auth0, **não** o Postgres). Tipo **Config**: a Vercel avisa que o prefixo `VITE_` expõe o valor, e aqui isso é o esperado.
- **Aplicação no Auth0 (Settings):** o Auth0 só redireciona para endereços cadastrados. **Allowed Callback URLs** e **Allowed Web Origins**: `https://postpilot.jonas-rocha.com, http://localhost:5173`; **Allowed Logout URLs**: `https://postpilot.jonas-rocha.com/login, http://localhost:5173/login`. Sem a URL de logout, sair da conta para numa página de erro do Auth0 em vez de voltar ao login.
- **Nunca coloque segredo numa variável `VITE_*`:** o Vite grava o valor no JavaScript público, e qualquer um lê pelo DevTools; deployments antigos da Vercel continuam servindo o bundle antigo. Segredos ficam só na Render (backend) e no GitHub Secrets (pipeline). Se um segredo vazar num bundle, troque-o na origem (ex.: senha do Neon), não basta corrigir a variável. Para conferir o bundle publicado: baixar o `/assets/index-*.js` e procurar `npg_` ou `postgres`.
- Uma variável **Sensitive** da Vercel não volta a ser Config: remova e crie de novo (`vercel env add <nome> --environment production --type config --value <valor>`, que evita colar da área de transferência).
- **Limite com a Render gratuita:** se o backend estiver dormindo, a primeira chamada pelo rewrite pode estourar o tempo de espera da Vercel; as seguintes funcionam (o TanStack Query tenta de novo).
- Deploy manual, a partir de `frontend/`: `npx vercel@latest login` (uma vez) e `npx vercel@latest deploy --prod`. A pasta `.vercel/` (ligação com o projeto) fica no `.gitignore`.

## Render (backend)

Web service criado pelo painel a partir da imagem do GHCR (**Existing Image**: `ghcr.io/jonasrocha189/postpilot-backend:latest`, pacote público), plano **Free**, região **Virginia (US East)**, a mesma do S3 e do Neon. Endereço: `https://postpilot-apit.onrender.com` (o "apit" veio de um erro de digitação na criação; o subdomínio não muda ao renomear o serviço, e o usuário nunca o vê, porque fica atrás do rewrite da Vercel).

- **Health check:** `/api/v1/health/ready` (confere o banco). Deploy automático desligado; o pipeline publica pelo **Deploy Hook**, passando a imagem do commit em `imgURL`.
- **Variáveis de ambiente** (definidas no painel, nunca a partir do `.env` local, que tem valores de desenvolvimento):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | Connection string **direta** (sem pooling) do Neon, no formato `postgresql+asyncpg://<usuário>:<senha>@<host>/<banco>?ssl=require` |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` | Tenant do Auth0 e `https://postpilot.jonas-rocha.com/api` |
| `S3_BUCKET`, `S3_REGION` | `postpilot-prod-<conta>` e `us-east-1` (saídas do Terraform) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Chave do usuário IAM `postpilot-backend` (`terraform output -raw backend_secret_access_key \| clip`, sem mostrar na tela) |
| `CORS_ORIGINS` | `[]` (mesma origem pela Vercel) |
| `LOG_JSON` | `true` |
| `OPENAI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY` | Chaves dos provedores de IA (chat, fallback, embeddings, imagem e busca web) |
| `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` | `true`, chave criada só para este projeto (Settings → API Keys no LangSmith) e `postpilot`. Lidas direto do ambiente pela biblioteca `langsmith`, não pelo `Settings`. Cada execução do agente aparece como `agent-run-{id}`, com a tag do modo (`creation` ou `ideation`) |

- **Ficam de fora:** `S3_ENDPOINT_URL` (vazio = AWS de verdade), `AUTH_DEV_USER` (o padrão vazio exige token) e `PORT` (a Render define).
- **Atenção ao `DATABASE_URL`:** o Neon entrega `postgresql://...?sslmode=require&channel_binding=require`. O driver asyncpg não aceita `sslmode` nem `channel_binding` (`TypeError: connect() got an unexpected keyword argument 'sslmode'`), então troque o prefixo por `postgresql+asyncpg://` e deixe só `?ssl=require`, com um único `?`.
- **Conferência:** `/api/v1/health/ready` responde `{"status":"ok","checks":{"database":"ok"}}`, `/api/v1/projects` sem token responde `401` e toda resposta traz o cabeçalho `X-Request-ID`.

## Imagem do backend

`backend/Dockerfile`, em dois estágios:

1. **Build:** `python:3.12-slim` com o `uv` da imagem oficial; `uv sync --locked --no-dev` instala exatamente o `uv.lock`, sem as dependências de desenvolvimento. O `pyproject.toml` e o `uv.lock` são copiados antes do código, então a camada das dependências fica em cache enquanto o lockfile não muda.
2. **Execução:** só o Python, o `.venv` e o código, com o usuário `app` (não root). Cerca de 105 MB compactada.

- **Comando:** `alembic upgrade head && exec uvicorn main:app --port $PORT --proxy-headers`. As migrations rodam a cada deploy, antes da API; se uma falhar, o contêiner não sobe e a Render mantém a versão anterior. O plano gratuito da Render não tem comando de pré-deploy, por isso elas ficam no início do contêiner.
- **`.dockerignore`:** fora da imagem ficam `.venv/` (o local é do Windows), `.env` (segredos), testes e caches.
- **Teste local:** dentro do contêiner, `127.0.0.1` é o próprio contêiner; para o Postgres e o LocalStack do `docker compose`, use `host.docker.internal`:

```powershell
cd backend
docker build -t postpilot-backend .
docker run --rm -p 8000:8000 --env-file .env `
  -e DATABASE_URL="postgresql+asyncpg://postpilot:postpilot@host.docker.internal:5433/postpilot" `
  -e S3_ENDPOINT_URL="http://host.docker.internal:4566" `
  postpilot-backend
# outro terminal: curl.exe http://127.0.0.1:8000/api/v1/health/ready
```

A documentação da API fica em `/api/docs` (e o OpenAPI em `/api/openapi.json`), porque em produção só `/api/*` chega ao backend.

## Logs

Um objeto JSON por linha no stdout (structlog), configurado em `backend/core/logs.py`. Os loggers padrão (uvicorn, Alembic e os `logging.getLogger(__name__)` dos routers) passam pelo mesmo formatador, então todas as linhas têm o mesmo formato. Sem arquivos de log.

- **`request_id`:** o middleware `api/middleware.py` reaproveita o cabeçalho `X-Request-ID` se for um id válido ou gera um novo, coloca em todas as linhas da requisição e devolve no cabeçalho da resposta, para o usuário poder informar.
- **`user_id`:** a dependência de autenticação (`get_current_user_id`) acrescenta o `sub` do token ao contexto. O middleware é ASGI puro (não `BaseHTTPMiddleware`) justamente para esse valor aparecer na linha final.
- **Uma linha por requisição:** `method`, `path` (sem a query string), `status` e `duration_ms`. O health check vai em `debug`, para não encher o log.
- **Nunca registrados:** tokens, chaves e conteúdo completo de documentos (há um teste que confere que o token não aparece).
- **Local:** `LOG_JSON=false` no `.env` troca o JSON por linhas coloridas e legíveis; `LOG_LEVEL` controla o nível.

```json
{"method": "GET", "path": "/api/v1/projects", "status": 200, "duration_ms": 82.1, "event": "request", "user_id": "auth0|123", "request_id": "52be3d57a25e4acd98bc6eb515d48c09", "level": "info", "logger": "api.request", "timestamp": "2026-11-07T17:16:54.399Z"}
```

## Backup

Um workflow agendado, `.github/workflows/backup.yml`, roda todo dia às 06:00 UTC (03:00 em São Paulo) e também pelo botão **Run workflow**:

1. `pg_dump` do Neon em formato *custom* (compactado), num contêiner `postgres:18-alpine` (o cliente precisa ser da mesma versão do servidor ou mais novo; o Neon roda o PostgreSQL 18).
2. Envio para `s3://<bucket>/backups/postpilot-AAAA-MM-DDTHHMMZ.dump`, com o AWS CLI do runner.

| Peça | Onde |
| --- | --- |
| Usuário IAM `postpilot-backup` | `infra/terraform/iam.tf`. Só `PutObject` em `backups/*`: uma chave vazada não lê, altera nem apaga os arquivos do app |
| Retenção de 30 dias | Regra `expire-backups` do lifecycle em `infra/terraform/s3.tf` |
| Criptografia | SSE-S3 do bucket (padrão para todo objeto) |

**GitHub Secrets do backup:**

| Secret | Valor |
| --- | --- |
| `BACKUP_DATABASE_URL` | A URL do Neon no formato do `psql`: `postgresql://USUÁRIO:SENHA@HOST/BANCO?sslmode=require` (a mesma da Render, sem `+asyncpg` e com `sslmode` no lugar de `ssl`) |
| `BACKUP_AWS_ACCESS_KEY_ID` | `terraform output backup_access_key_id` |
| `BACKUP_AWS_SECRET_ACCESS_KEY` | `terraform output -raw backup_secret_access_key` |
| `BACKUP_S3_BUCKET` | `terraform output -raw s3_bucket` |

**Restaurar** (com uma conta que possa ler o bucket, como a do Terraform):

```bash
aws s3 ls s3://<bucket>/backups/                       # escolha o arquivo
aws s3 cp s3://<bucket>/backups/postpilot-….dump .
# Num banco vazio (ex.: um branch novo no Neon), nunca direto em produção:
pg_restore --no-owner --no-privileges --dbname "postgresql://…?sslmode=require" postpilot-….dump
```

Depois de restaurar num branch novo, aponte o `DATABASE_URL` da Render para ele. O Neon também guarda um histórico curto para restauração *point-in-time* no plano gratuito, útil para desfazer um erro recente sem o dump.

> Workflows agendados só rodam na `main`, e o GitHub os desliga depois de 60 dias sem atividade no repositório.
