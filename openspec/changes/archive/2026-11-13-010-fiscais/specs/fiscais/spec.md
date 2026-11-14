# Spec Delta

## Purpose

Cadastro de Fiscais: a aplicação SHALL manter os registros de `fiscais` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## ADDED Requirements

### Requirement: Listar Fiscais
O sistema SHALL exibir em `/fiscais` uma lista paginada de Fiscais com busca e as colunas: `busca`, `pessoaFisicaCpf`, `suplente`, `presidente`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/fiscais`
- **THEN** vê a tabela com as colunas `busca`, `pessoaFisicaCpf`, `suplente`, `presidente`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Fiscais
O sistema SHALL permitir criar um registro de Fiscais em `/fiscais/new` com os campos, nesta ordem: `busca`, `pessoaFisicaCpf`, `suplente`, `presidente`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `fiscais` e a lista o exibe

### Requirement: Editar Fiscais
O sistema SHALL permitir editar um registro existente de Fiscais em `/fiscais/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Fiscais
O sistema SHALL permitir excluir um registro de Fiscais após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `fiscais` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Fiscais
O sistema SHALL rejeitar a gravação de Fiscais sem os campos obrigatórios: `pessoaFisicaCpf`, `suplente`, `presidente`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `pessoaFisicaCpf` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: Entrada formatada em Fiscais
O formulário de Fiscais SHALL aplicar as máscaras e os serviços de endereço da fundação (`locale-and-formats`) aos seus campos: `busca` `###.###.###-##`, `pessoaFisicaCpf` `###.###.###-##`.

#### Scenario: `busca` é digitado
- **WHEN** o usuário digita em `busca`
- **THEN** o valor é formatado como `###.###.###-##`

#### Scenario: `pessoaFisicaCpf` é digitado
- **WHEN** o usuário digita em `pessoaFisicaCpf`
- **THEN** o valor é formatado como `###.###.###-##`

