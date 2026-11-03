# Implantação, CI/CD e IaC

> Status: **planejada**. Não altere recursos em produção sem revisar antes o `terraform plan` ou o `helm template`.

## Modelo de implantação

```mermaid
flowchart TB
    dev["💻 Desenvolvedor"]

    subgraph github["GitHub"]
        repo["Repositório"]
        actions["GitHub Actions"]
        ghcr["GHCR<br/><i>imagens Docker</i>"]
    end

    subgraph vps["VPS Hostinger · Ubuntu 24.04 · 2 vCPU · 8 GB"]
        subgraph k3s["k3s"]
            traefik["Traefik + cert-manager<br/><i>projeto.jonas-rocha.com</i>"]
            front["Deployment frontend<br/><i>nginx</i>"]
            back["Deployment backend<br/><i>FastAPI × 2</i>"]
            pg[("StatefulSet PostgreSQL<br/>+ PVC")]
            cron["CronJob backup"]
            secrets["Secrets"]
        end
    end

    subgraph aws["AWS"]
        s3["S3 (privado, SSE-S3)"]
        iam["Usuário IAM<br/><i>menor privilégio</i>"]
        budget["Budget + alerta"]
    end

    le["Let's Encrypt"]

    dev -- "git push" --> repo
    repo --> actions
    actions -- "build + push" --> ghcr
    actions -- "helm upgrade --install" --> k3s
    k3s -- "pull" --> ghcr
    traefik --> front & back
    back --> pg
    back --> s3
    cron -- "pg_dump" --> s3
    traefik -. "certificado" .- le
```

Todo Deployment define `requests` e `limits` de CPU e memória.

## Pipeline (GitHub Actions)

```mermaid
flowchart LR
    lint["1. Lint e typecheck<br/><i>Ruff, mypy, ESLint, tsc</i>"]
    test["2. Testes<br/><i>unidade + integração</i>"]
    build["3. Build e push<br/><i>GHCR, só na main</i>"]
    deploy["4. Deploy<br/><i>helm upgrade --install</i>"]
    e2e["5. Aceite<br/><i>Playwright no ambiente publicado</i>"]

    lint --> test --> build --> deploy --> e2e
```

## Artefatos de IaC

| Ferramenta | Pasta | Responsabilidade |
| --- | --- | --- |
| Terraform | `infra/terraform/` | Bucket S3 (Block Public Access, SSE-S3, CORS só para o domínio de produção e `localhost`, lifecycle de uploads incompletos), usuário IAM (`GetObject`, `PutObject`, `DeleteObject` neste bucket), AWS Budget, estado remoto |
| Ansible | `infra/ansible/` | Provisionamento da VPS: usuários, firewall, instalação do k3s |
| Helm | `infra/helm/postpilot/` | Chart da aplicação: Deployments, StatefulSet, Ingress, CronJob, Secrets |

## Configuração e segredos

- Configuração só por variáveis de ambiente (pydantic-settings). O `.env.example` lista todas.
- Em produção, os segredos ficam em Secrets do Kubernetes. No pipeline, em GitHub Secrets.
- Nunca commitar `.env`, chaves ou kubeconfig.

## Logs

JSON no stdout (structlog), com `request_id` e `usuario_id` quando houver. Sem arquivos de log. Tokens, chaves e conteúdo completo de documentos nunca são registrados.

## Backup

CronJob com `pg_dump` enviando o dump para o S3.
