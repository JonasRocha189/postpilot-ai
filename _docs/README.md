# Documentação do PostPilot

Documentação técnica do projeto. A visão geral, como executar e os requisitos do TCC estão no [README principal](../README.md).

| Documento | Conteúdo |
| --- | --- |
| [Arquitetura (C4)](arquitetura.md) | Diagramas de contexto, contêineres e componentes |
| [Modelo de dados](modelo-de-dados.md) | Diagrama de classes e entidades |
| [Agente e RAG](agente-e-rag.md) | Loop do agente, tools, pipeline de documentos e busca híbrida |
| [API](api.md) | Endpoints REST em `/api/v1` |
| [Rotas do frontend](frontend-rotas.md) | Páginas, menu lateral e ordem de implementação |
| [Implantação](implantacao.md) | Modelo de implantação, CI/CD e IaC |
| [Decisões](decisoes.md) | Registro das decisões de arquitetura e o motivo de cada uma |
| [Changelog](changelog.md) | Funcionalidades entregues, por data |

> **Manutenção:** toda funcionalidade nova enviada ao GitHub deve vir acompanhada da atualização do [changelog](changelog.md) e dos documentos afetados.

Os diagramas usam [Mermaid](https://mermaid.js.org/), renderizado direto pelo GitHub.
