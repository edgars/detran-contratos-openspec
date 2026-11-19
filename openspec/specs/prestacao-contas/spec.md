# prestacao-contas Specification

## Purpose
Cadastro de PrestacaoContas: a aplicação SHALL manter os registros de `prestacao_contas` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar PrestacaoContas
O sistema SHALL exibir em `/prestacao_contas` uma lista paginada de PrestacaoContas com busca e as colunas: `descricao`, `atendido`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/prestacao_contas`
- **THEN** vê a tabela com as colunas `descricao`, `atendido`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar PrestacaoContas
O sistema SHALL permitir criar um registro de PrestacaoContas em `/prestacao_contas/new` com os campos, nesta ordem: `descricao`, `atendido`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `prestacao_contas` e a lista o exibe

### Requirement: Editar PrestacaoContas
O sistema SHALL permitir editar um registro existente de PrestacaoContas em `/prestacao_contas/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir PrestacaoContas
O sistema SHALL permitir excluir um registro de PrestacaoContas após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `prestacao_contas` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada
