# Spec Delta

## Purpose

Cadastro de TipoContratos: a aplicação SHALL manter os registros de `tipo_contrato` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar TipoContratos
O sistema SHALL exibir em `/tipo_contratos` uma lista paginada de TipoContratos com busca e as colunas: `nome`, `gerenciamento`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/tipo_contratos`
- **THEN** vê a tabela com as colunas `nome`, `gerenciamento`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar TipoContratos
O sistema SHALL permitir criar um registro de TipoContratos em `/tipo_contratos/new` com os campos, nesta ordem: `nome`, `gerenciamento`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `tipo_contrato` e a lista o exibe

### Requirement: Editar TipoContratos
O sistema SHALL permitir editar um registro existente de TipoContratos em `/tipo_contratos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir TipoContratos
O sistema SHALL permitir excluir um registro de TipoContratos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `tipo_contrato` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de TipoContratos
O sistema SHALL rejeitar a gravação de TipoContratos sem os campos obrigatórios: `gerenciamento`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `gerenciamento` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: Informe o tipo de contrato
O sistema SHALL aplicar a regra `RK-79134600b4be`: Informe o tipo de contrato

#### Scenario: Regra aplicada
- **GIVEN** os campos `tipo_contrato_id`
- **WHEN** a condição `tipo_contrato_id IS NOT EMPTY` se verifica
- **THEN** Informe o tipo de contrato

