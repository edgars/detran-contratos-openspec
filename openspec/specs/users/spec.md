# users Specification

## Purpose
Cadastro de usuários: a aplicação SHALL manter os registros de `users` como o sistema legado mantinha — listar, criar, editar, excluir e trocar a própria senha — sem nunca expor senhas.

## Requirements

### Requirement: Listar Users
O sistema SHALL exibir em `/users` uma lista paginada de usuários com busca e as colunas `username` e Perfis (rótulos dos perfis do usuário, separados por vírgula); nenhum campo de senha SHALL aparecer na lista. A lista SHALL ser acessível só ao Administrador.

Alterado por 023-perfis-acesso: acrescenta a coluna Perfis e a restrição ao Administrador.

#### Scenario: Abrir a lista
- **WHEN** o operador abre `/users`
- **THEN** vê a tabela com as colunas `username` e Perfis, paginada, sem colunas de senha
- **AND** pode filtrar pela busca

#### Scenario: Lista sem perfil Administrador
- **GIVEN** um usuário logado sem o perfil Administrador
- **WHEN** ele abre `/users`
- **THEN** vê "Você não tem permissão para acessar esta página." e nenhum usuário é listado

### Requirement: Criar Users
O sistema SHALL permitir ao Administrador criar um usuário em `/users/new` com os campos `username`, `password`, `passwordconfirm` e `perfis` (um ou mais de Administrador, Gestor de contrato, Fiscal, Financeiro e Consulta, escolhidos em caixas de seleção), gravando só o hash da senha e os perfis escolhidos.

Alterado por 023-perfis-acesso: acrescenta o campo obrigatório `perfis` e a restrição ao Administrador.

#### Scenario: Salvar um usuário válido
- **WHEN** o operador preenche usuário, senha e confirmação iguais, marca o perfil Fiscal e salva
- **THEN** o usuário é gravado em `users` com `passwordHash`, com o perfil Fiscal em `user_perfis`, e a lista o exibe com "Fiscal" na coluna Perfis

#### Scenario: Confirmação diferente
- **WHEN** o operador salva com `password` diferente de `passwordconfirm`
- **THEN** o formulário mostra erro no campo de confirmação e nada é gravado

#### Scenario: Sem perfil
- **WHEN** o operador salva um usuário sem marcar nenhum perfil
- **THEN** o formulário mostra "Informe ao menos um perfil" no campo `perfis` e a API responde `400`

### Requirement: Editar Users
O sistema SHALL permitir ao Administrador editar o `username` e os `perfis` de um usuário existente em `/users/[id]/edit`, com o formulário pré-preenchido e sem campos de senha; a mudança de perfis SHALL valer a partir da próxima requisição do usuário editado.

Alterado por 023-perfis-acesso: acrescenta a edição dos perfis e a restrição ao Administrador.

#### Scenario: Alterar um usuário
- **WHEN** o operador abre um usuário da lista, altera `username` e salva
- **THEN** o usuário é atualizado e a lista reflete a alteração

#### Scenario: Acrescentar um perfil
- **GIVEN** um usuário com o perfil Fiscal
- **WHEN** o Administrador marca também Financeiro e salva
- **THEN** o usuário passa a ter os perfis Fiscal e Financeiro e a lista mostra "Fiscal, Financeiro"

### Requirement: Excluir Users
O sistema SHALL permitir ao Administrador excluir um usuário após confirmação explícita, removendo junto os perfis do usuário, e SHALL recusar com `409` a exclusão do próprio usuário logado.

Alterado por 023-perfis-acesso: acrescenta a remoção dos perfis, a restrição ao Administrador e a trava do próprio usuário (já implementada em `removeUser`, agora na spec).

#### Scenario: Excluir com confirmação
- **GIVEN** um usuário aberto para edição
- **WHEN** o operador aciona *Excluir* e confirma
- **THEN** o usuário é removido de `users`, seus perfis são removidos de `user_perfis` e a lista não o exibe
- **AND** cancelar a confirmação não altera nada

#### Scenario: Excluir o próprio usuário
- **WHEN** o Administrador logado tenta excluir o próprio usuário
- **THEN** a resposta é `409` com "Não é possível excluir o próprio usuário logado" e nada é removido

### Requirement: Campos obrigatórios de Users
O sistema SHALL rejeitar a gravação de um usuário sem `username`.

#### Scenario: Salvar sem um campo obrigatório
- **WHEN** o operador salva com `username` vazio
- **THEN** o formulário mostra erro inline no campo e nada é gravado
- **AND** a API responde `400` com a mensagem do campo

### Requirement: Trocar a própria senha
O sistema SHALL permitir que o usuário logado troque a própria senha em `/conta/senha`, aplicando as regras `RK-9187b7b464f8` e `RK-304882e7bdc8` (senha atual confere) e `RK-dcfcd941a4d6` e `RK-96cbe7d6e198` (nova senha igual à confirmação).

#### Scenario: Senha atual errada
- **WHEN** o usuário informa uma senha atual que não confere
- **THEN** vê "Senha atual não confere!" e a senha não muda

#### Scenario: Confirmação diferente
- **WHEN** o usuário informa nova senha e confirmação diferentes
- **THEN** vê "A nova senha não confere!" e a senha não muda

#### Scenario: Troca válida
- **WHEN** o usuário informa a senha atual correta e nova senha igual à confirmação
- **THEN** o novo hash é gravado e o próximo login aceita só a nova senha
