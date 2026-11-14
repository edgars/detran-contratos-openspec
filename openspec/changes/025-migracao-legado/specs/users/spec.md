# Spec Delta

## ADDED Requirements

### Requirement: Definir senha e ativar usuário migrado
O sistema SHALL permitir que um usuário com perfil Administrador defina a senha de outro usuário em `/users/[id]/senha`, com os campos `password` e `passwordconfirm` (a confirmação SHALL ser igual à senha). Ao salvar, o servidor SHALL gravar só o hash da senha, `senhaRedefinir = false` e `inativo = 0`. Usuário com `senhaRedefinir = true` SHALL NOT conseguir entrar. A senha e o hash SHALL NOT aparecer em resposta, lista ou log.

#### Scenario: Ativar usuário vindo do legado
- **GIVEN** o usuário `joao`, carregado do legado com `inativo = 1` e `senhaRedefinir = true`
- **WHEN** um Administrador abre `/users/<id de joao>/senha`, informa a mesma senha nos dois campos e salva
- **THEN** `joao` consegue entrar com a nova senha e a resposta da API não contém `password` nem `passwordHash`

#### Scenario: Confirmação diferente
- **WHEN** o Administrador salva com `password` diferente de `passwordconfirm`
- **THEN** o formulário mostra erro no campo de confirmação e nada é alterado

#### Scenario: Sem perfil Administrador
- **WHEN** um usuário sem o perfil Administrador envia `POST /api/users/<id>/senha`
- **THEN** a resposta é `403` e nada é alterado
