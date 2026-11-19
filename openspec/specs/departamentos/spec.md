# departamentos Specification

## Purpose
Cadastro de Departamentos: a aplicação SHALL manter os registros de `departamentos` como o sistema legado mantinha — listar, criar, editar e excluir — aplicando as regras de negócio extraídas do legado.

## Requirements

### Requirement: Listar Departamentos
O sistema SHALL exibir em `/departamentos` uma lista paginada de Departamentos com busca e as colunas: `diretoriaId`.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/departamentos`
- **THEN** vê a tabela com as colunas `diretoriaId`, paginada
- **AND** pode filtrar pela busca

### Requirement: Criar Departamentos
O sistema SHALL permitir criar um registro de Departamentos em `/departamentos/new` com os campos, nesta ordem: `codigo`, `diretoriaId`, `id`, `deDepartamento`, `deLogradouro`, `deComplemento`, `deBairro`, `deCidade`, `cep`, `municipioId`.

#### Scenario: Salvar um registro válido
- **WHEN** o operador preenche o formulário e salva
- **THEN** o registro é gravado em `departamentos` e a lista o exibe

### Requirement: Editar Departamentos
O sistema SHALL permitir editar um registro existente de Departamentos em `/departamentos/[id]/edit`, com o formulário pré-preenchido.

#### Scenario: Alterar um registro
- **WHEN** o operador abre um registro da lista, altera um campo e salva
- **THEN** o registro é atualizado e a lista reflete a alteração

### Requirement: Excluir Departamentos
O sistema SHALL permitir excluir um registro de Departamentos após confirmação explícita.

#### Scenario: Excluir com confirmação
- **GIVEN** um registro aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o registro é removido de `departamentos` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

### Requirement: Campos obrigatórios de Departamentos
O sistema SHALL rejeitar a gravação de Departamentos sem os campos obrigatórios: `diretoriaId`, `id`, `deDepartamento`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `diretoriaId` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: `diretoriaId` referencia Diretorias
O campo `diretoriaId` de Departamentos SHALL ser escolhido entre os registros de Diretorias (lista de `/api/diretorias`) e gravar o id do registro escolhido.

#### Scenario: Escolher um registro relacionado
- **WHEN** o operador abre o campo `diretoriaId`
- **THEN** vê os registros de Diretorias e, ao escolher um, o id é gravado em `diretoriaId`

### Requirement: Entrada formatada em Departamentos
O formulário de Departamentos SHALL aplicar as máscaras e os serviços de endereço da fundação (`locale-and-formats`) aos seus campos: `cep` `#####-###`.

#### Scenario: `cep` é digitado
- **WHEN** o usuário digita em `cep`
- **THEN** o valor é formatado como `#####-###`
