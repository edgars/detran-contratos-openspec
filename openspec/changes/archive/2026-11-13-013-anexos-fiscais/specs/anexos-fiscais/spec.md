# Spec Delta

## Purpose

Cadastro de AnexosFiscais: a aplicação SHALL manter os registros de `anexos_fiscais` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar AnexosFiscais
O sistema SHALL exibir em `/anexos_fiscais` uma lista paginada de AnexosFiscais com busca e as colunas: `anexo`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/anexos_fiscais`
- **THEN** vê a tabela com as colunas `anexo`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar AnexosFiscais
O sistema SHALL permitir criar um registro de AnexosFiscais em `/anexos_fiscais/new` com os campos, nesta ordem: `anexo`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `anexos_fiscais` e a lista o exibe

### Requirement: Editar AnexosFiscais
O sistema SHALL permitir editar um registro existente de AnexosFiscais em `/anexos_fiscais/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir AnexosFiscais
O sistema SHALL permitir excluir um registro de AnexosFiscais após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `anexos_fiscais` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de AnexosFiscais
O sistema SHALL rejeitar a gravação de AnexosFiscais sem os campos obrigatórios: `anexo`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `anexo` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

