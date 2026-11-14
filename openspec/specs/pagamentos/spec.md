# pagamentos Specification

## Purpose
Cadastro de Pagamentos: a aplicação SHALL manter os registros de `pagamentos` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar Pagamentos
O sistema SHALL exibir em `/pagamentos` uma lista paginada de Pagamentos com busca e as colunas: `numeroProcesso`, `ano`, `notaFiscal`, `empenho`, `notaLiquidacao`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/pagamentos`
- **THEN** vê a tabela com as colunas `numeroProcesso`, `ano`, `notaFiscal`, `empenho`, `notaLiquidacao`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Pagamentos
O sistema SHALL permitir criar um registro de Pagamentos em `/pagamentos/new` com os campos, nesta ordem: `numeroProcesso`, `ano`, `notaFiscal`, `empenho`, `notaLiquidacao`, `ordemBancaria`, `valor`, `valorGlosa`, `mes`, `glosa`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `pagamentos` e a lista o exibe

### Requirement: Editar Pagamentos
O sistema SHALL permitir editar um registro existente de Pagamentos em `/pagamentos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Pagamentos
O sistema SHALL permitir excluir um registro de Pagamentos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `pagamentos` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Pagamentos
O sistema SHALL rejeitar a gravação de Pagamentos sem os campos obrigatórios: `numeroProcesso`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `numeroProcesso` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo
