# Spec Delta

## Purpose

Cadastro de Fases: a aplicação SHALL manter os registros de `fases` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Fases
O sistema SHALL exibir em `/fases` uma lista paginada de Fases com busca e as colunas: `nome`, `periodo`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/fases`
- **THEN** vê a tabela com as colunas `nome`, `periodo`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Fases
O sistema SHALL permitir criar um registro de Fases em `/fases/new` com os campos, nesta ordem: `nome`, `periodo`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `fases` e a lista o exibe

### Requirement: Editar Fases
O sistema SHALL permitir editar um registro existente de Fases em `/fases/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Fases
O sistema SHALL permitir excluir um registro de Fases após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `fases` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Fases
O sistema SHALL rejeitar a gravação de Fases sem os campos obrigatórios: `nome`, `periodo`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `nome` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

