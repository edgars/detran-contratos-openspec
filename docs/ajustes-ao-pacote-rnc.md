# Ajustes ao pacote gerado pela RNC

Este repositório começou como cópia do pacote OpenSpec de
[`edgars/detran-rj-contratos`](https://github.com/edgars/detran-rj-contratos), gerado pela RNC em 12/11/2026.
A revisão contra a análise da RNC (segurança, regras e modelo de dados) encontrou lacunas que
reproduziriam falhas do legado. As mudanças abaixo foram feitas antes de qualquer change ser aplicada.

> Regenerar o pacote pela RNC sobrescreve `openspec/changes/` e desfaz estes ajustes. A partir de
> agora, este repositório é a fonte do plano.

| Arquivo | Ajuste | Motivo |
|---|---|---|
| `openspec/changes/001b-security-baseline/` (novo) | Change de segurança: login, sessão, rotas protegidas, schema estrito, upload de PDF, autoria pela sessão, consultas parametrizadas, `Decimal` | Nota de segurança do legado 55/100, com 6 achados críticos; a autenticação estava em aberto no pacote |
| `openspec/config.yaml` | Diretivas do autor: ordem de build, sessão, hash de senha, `Decimal`, schema estrito, `savePdf()`, filtros de pesquisa não são colunas | Precedência máxima no próprio pacote |
| `001-project-foundation/design.md` | Valores monetários `Float` → `Decimal`; `users.password` → `passwordHash`, sem colunas `passwordold`/`passwordnew`/`passwordconfirm`; filtros de pesquisa removidos do modelo `contratos`; relações de `departamentoId` e `parentId`; questão de autenticação resolvida | Dinheiro em ponto flutuante perde precisão; `busca`, `campo`, `ordenar` e afins eram campos da tela de pesquisa |
| `001-project-foundation/proposal.md` | 11 regras de contratos saíram de "fora de escopo" | São regras do cadastro de contratos, agora em `017-contratos` |
| `001-project-foundation/tasks.md` | Tarefas de troca de senha apontam o ponto de uso em `005-users` | A tela de troca de senha só existe em `005-users` |
| `003-tipo-contratos/*` | `RK-79134600b4be` ("Informe o tipo de contrato") movida para `017-contratos` | A regra vale no contrato (`contratos.tipo_contrato_id`), não no cadastro de tipos |
| `005-users/*` | Senhas fora da lista e da API; criação com senha e confirmação; tela `/conta/senha` | O pacote listava `passwordold`, `passwordnew` e `passwordconfirm` como colunas |
| `017-contratos/*` | Cadastro reescrito: 16 campos reais e 3 anexos, filtros da lista, aditivos, anexos e 12 regras `RK-…` | O pacote capturou só a tela de pesquisa e nenhuma regra do cadastro |
| `AGENTS.md`, `CLAUDE.md`, `README.md` | Ordem com `001b`, comandos da OpenSpec 2.x, descrição deste repositório | Refletir os ajustes |

Validação: `openspec validate --all --strict` passa nas 19 changes (CLI 2.0.0), e arquivar as 19
em ordem numa cópia de teste gera 21 specs válidas.
