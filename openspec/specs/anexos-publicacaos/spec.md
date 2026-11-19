# anexos-publicacaos Specification

## Purpose
Cadastro de AnexosPublicacaos: a aplicação SHALL manter os registros de `anexos_publicacao` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar AnexosPublicacaos
O sistema SHALL exibir em `/anexos_publicacaos` uma lista paginada de AnexosPublicacaos com busca e as colunas: `anexo`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/anexos_publicacaos`
- **THEN** vê a tabela com as colunas `anexo`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar AnexosPublicacaos
O sistema SHALL permitir criar um registro de AnexosPublicacaos em `/anexos_publicacaos/new` com os campos, nesta ordem: `anexo`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `anexos_publicacao` e a lista o exibe

### Requirement: Editar AnexosPublicacaos
O sistema SHALL permitir editar um registro existente de AnexosPublicacaos em `/anexos_publicacaos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir AnexosPublicacaos
O sistema SHALL permitir excluir um registro de AnexosPublicacaos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `anexos_publicacao` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada
