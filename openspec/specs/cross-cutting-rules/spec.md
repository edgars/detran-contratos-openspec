# cross-cutting-rules Specification

## Purpose
Regras de negócio do legado que valem para mais de uma entidade ou cuja entidade não foi determinada; cada uma SHALL ser aplicada onde o design da fundação decidir.

## Requirements

### Requirement: DeDiretoria is required
O sistema SHALL aplicar a regra `RK-db6786831c50`: DeDiretoria is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeDiretoria`
- **WHEN** a condição `DeDiretoria IS NOT NULL` se verifica
- **THEN** DeDiretoria is required

### Requirement: Codigo is required
O sistema SHALL aplicar a regra `RK-4b678b1a2fb6`: Codigo is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `Codigo`
- **WHEN** a condição `Codigo IS NOT NULL` se verifica
- **THEN** Codigo is required

### Requirement: IdPessoaFisica is required
O sistema SHALL aplicar a regra `RK-32ab70ab3174`: IdPessoaFisica is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `IdPessoaFisica`
- **WHEN** a condição `IdPessoaFisica IS NOT NULL` se verifica
- **THEN** IdPessoaFisica is required

### Requirement: DtNascimento is required
O sistema SHALL aplicar a regra `RK-fcc74046a0bd`: DtNascimento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DtNascimento`
- **WHEN** a condição `DtNascimento IS NOT NULL` se verifica
- **THEN** DtNascimento is required

### Requirement: DeDepartamento is required
O sistema SHALL aplicar a regra `RK-4e6358dbafbf`: DeDepartamento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeDepartamento`
- **WHEN** a condição `DeDepartamento IS NOT NULL` se verifica
- **THEN** DeDepartamento is required

### Requirement: DeRazaoSocial is required
O sistema SHALL aplicar a regra `RK-afd830d80ecf`: DeRazaoSocial is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeRazaoSocial`
- **WHEN** a condição `DeRazaoSocial IS NOT NULL` se verifica
- **THEN** DeRazaoSocial is required

### Requirement: IdPessoaFisica is required (2)
O sistema SHALL aplicar a regra `RK-fa60f5d06b79`: IdPessoaFisica is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `IdPessoaFisica`
- **WHEN** a condição `IdPessoaFisica IS NOT NULL` se verifica
- **THEN** IdPessoaFisica is required

### Requirement: DtNascimento is required (2)
O sistema SHALL aplicar a regra `RK-94d8b17e5a88`: DtNascimento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DtNascimento`
- **WHEN** a condição `DtNascimento IS NOT NULL` se verifica
- **THEN** DtNascimento is required

### Requirement: arquivo is required
O sistema SHALL aplicar a regra `RK-77287deac605`: arquivo is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `arquivo`
- **WHEN** a condição `arquivo IS NOT NULL` se verifica
- **THEN** arquivo is required

### Requirement: Por favor,Preencher o campo NOME !
O sistema SHALL aplicar a regra `RK-82de63b47e64`: Por favor,Preencher o campo NOME !

#### Scenario: Regra aplicada
- **GIVEN** os campos `nome`
- **WHEN** a condição `empty(nome)` se verifica
- **THEN** Por favor,Preencher o campo NOME !

### Requirement: gerenciamento is required
O sistema SHALL aplicar a regra `RK-2509b78bd0e0`: gerenciamento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `gerenciamento`
- **WHEN** a condição `gerenciamento IS NOT NULL` se verifica
- **THEN** gerenciamento is required

### Requirement: Descricao is derived before saving
O sistema SHALL aplicar a regra `RK-f0ce91a53de9`: Descricao is derived before saving

#### Scenario: Regra aplicada
- **GIVEN** os campos `descricao`
- **WHEN** a condição `descricao := str_replace("\"", "'", descricao)` se verifica
- **THEN** Descricao is derived before saving

### Requirement: Senha atual não confere!
O sistema SHALL aplicar a regra `RK-9187b7b464f8`: Senha atual não confere!

#### Scenario: Regra aplicada
- **GIVEN** os campos `passwordold`
- **WHEN** a condição `Security::hash(passwordold, null, true) <> usuario.password` se verifica
- **THEN** Senha atual não confere!

### Requirement: A nova senha não confere!
O sistema SHALL aplicar a regra `RK-dcfcd941a4d6`: A nova senha não confere!

#### Scenario: Regra aplicada
- **GIVEN** os campos `passwordnew`, `passwordconfirm`
- **WHEN** a condição `passwordnew <> passwordconfirm` se verifica
- **THEN** A nova senha não confere!

### Requirement: username is required
O sistema SHALL aplicar a regra `RK-d76edbb42dbe`: username is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `username`
- **WHEN** a condição `username IS NOT NULL` se verifica
- **THEN** username is required

### Requirement: password is required
O sistema SHALL aplicar a regra `RK-3e9d7e57ae65`: password is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `password`
- **WHEN** a condição `password IS NOT NULL` se verifica
- **THEN** password is required

### Requirement: competencia is required
O sistema SHALL aplicar a regra `RK-774f44ed6df9`: competencia is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `competencia`
- **WHEN** a condição `competencia IS NOT NULL` se verifica
- **THEN** competencia is required

### Requirement: objeto is required
O sistema SHALL aplicar a regra `RK-879233539305`: objeto is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `objeto`
- **WHEN** a condição `objeto IS NOT NULL` se verifica
- **THEN** objeto is required

### Requirement: nome is required
O sistema SHALL aplicar a regra `RK-13dd23ce5afd`: nome is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `nome`
- **WHEN** a condição `nome IS NOT NULL` se verifica
- **THEN** nome is required

### Requirement: periodo is required
O sistema SHALL aplicar a regra `RK-877afa57a9f9`: periodo is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `periodo`
- **WHEN** a condição `periodo IS NOT NULL` se verifica
- **THEN** periodo is required

### Requirement: suplente is required
O sistema SHALL aplicar a regra `RK-0f7caf172fab`: suplente is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `suplente`
- **WHEN** a condição `suplente IS NOT NULL` se verifica
- **THEN** suplente is required

### Requirement: presidente is required
O sistema SHALL aplicar a regra `RK-6b60cd49b7ed`: presidente is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `presidente`
- **WHEN** a condição `presidente IS NOT NULL` se verifica
- **THEN** presidente is required

### Requirement: Erro ao incluir O arquivo anexo deve ser do tipo PDF!
O sistema SHALL aplicar a regra `RK-01658245d11b`: Erro ao incluir O arquivo anexo deve ser do tipo PDF!

#### Scenario: Regra aplicada
- **GIVEN** os campos `anexo`
- **WHEN** a condição `anexo.type <> 'application/pdf'` se verifica
- **THEN** Erro ao incluir O arquivo anexo deve ser do tipo PDF!

### Requirement: Erro ao incluir Não existe arquivo para anexar!
O sistema SHALL aplicar a regra `RK-23cdd0c37c3c`: Erro ao incluir Não existe arquivo para anexar!

#### Scenario: Regra aplicada
- **GIVEN** os campos `anexo`
- **WHEN** a condição `NOT (is_uploaded_file(anexo.tmp_name))` se verifica
- **THEN** Erro ao incluir Não existe arquivo para anexar!

### Requirement: anexo is required
O sistema SHALL aplicar a regra `RK-9da08201400b`: anexo is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `anexo`
- **WHEN** a condição `anexo IS NOT NULL` se verifica
- **THEN** anexo is required

### Requirement: DeDepartamento is required (2)
O sistema SHALL aplicar a regra `RK-52fdc2d97389`: DeDepartamento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeDepartamento`
- **WHEN** a condição `DeDepartamento IS NOT NULL` se verifica
- **THEN** DeDepartamento is required

### Requirement: Informe o nome do grupo!
O sistema SHALL aplicar a regra `RK-3424ea0367fa`: Informe o nome do grupo!

#### Scenario: Regra aplicada
- **GIVEN** os campos `name`
- **WHEN** a condição `name IS NOT EMPTY` se verifica
- **THEN** Informe o nome do grupo!

### Requirement: name is required
O sistema SHALL aplicar a regra `RK-f6b71997ac15`: name is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `name`
- **WHEN** a condição `name IS NOT NULL` se verifica
- **THEN** name is required

### Requirement: Erro ao incluir O arquivo anexo deve ser do tipo PDF! (2)
O sistema SHALL aplicar a regra `RK-9aa2ad64672e`: Erro ao incluir O arquivo anexo deve ser do tipo PDF!

#### Scenario: Regra aplicada
- **GIVEN** os campos `anexo`
- **WHEN** a condição `anexo.type <> 'application/pdf'` se verifica
- **THEN** Erro ao incluir O arquivo anexo deve ser do tipo PDF!

### Requirement: Erro ao incluir Não existe arquivo para anexar! (2)
O sistema SHALL aplicar a regra `RK-e2b53b79c3c2`: Erro ao incluir Não existe arquivo para anexar!

#### Scenario: Regra aplicada
- **GIVEN** os campos `anexo`
- **WHEN** a condição `NOT (is_uploaded_file(anexo.tmp_name))` se verifica
- **THEN** Erro ao incluir Não existe arquivo para anexar!

### Requirement: Erro ao incluir O arquivo anexo deve ser do tipo PDF! (3)
O sistema SHALL aplicar a regra `RK-174d58601890`: Erro ao incluir O arquivo anexo deve ser do tipo PDF!

#### Scenario: Regra aplicada
- **GIVEN** os campos `arquivo`
- **WHEN** a condição `arquivo.type <> 'application/pdf'` se verifica
- **THEN** Erro ao incluir O arquivo anexo deve ser do tipo PDF!

### Requirement: Erro ao incluir Não existe arquivo para anexar! (3)
O sistema SHALL aplicar a regra `RK-abb6ac79fad7`: Erro ao incluir Não existe arquivo para anexar!

#### Scenario: Regra aplicada
- **GIVEN** os campos `arquivo`
- **WHEN** a condição `NOT (is_uploaded_file(arquivo.tmp_name))` se verifica
- **THEN** Erro ao incluir Não existe arquivo para anexar!

### Requirement: DeDiretoria is required (2)
O sistema SHALL aplicar a regra `RK-7bc5e0466e28`: DeDiretoria is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeDiretoria`
- **WHEN** a condição `DeDiretoria IS NOT NULL` se verifica
- **THEN** DeDiretoria is required

### Requirement: Codigo is required (2)
O sistema SHALL aplicar a regra `RK-7a6417845e4d`: Codigo is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `Codigo`
- **WHEN** a condição `Codigo IS NOT NULL` se verifica
- **THEN** Codigo is required

### Requirement: Erro ao incluir O arquivo anexo deve ser do tipo PDF! (4)
O sistema SHALL aplicar a regra `RK-ed7bc4aaba15`: Erro ao incluir O arquivo anexo deve ser do tipo PDF!

#### Scenario: Regra aplicada
- **WHEN** a condição `nomeArquivo.type <> 'application/pdf'` se verifica
- **THEN** Erro ao incluir O arquivo anexo deve ser do tipo PDF!

### Requirement: Erro ao incluir O anexo deve ser do tipo PDF!
O sistema SHALL aplicar a regra `RK-d2c51245ec1e`: Erro ao incluir O anexo deve ser do tipo PDF!

#### Scenario: Regra aplicada
- **WHEN** a condição `anexo.type <> 'application/pdf'` se verifica
- **THEN** Erro ao incluir O anexo deve ser do tipo PDF!

### Requirement: objeto is required (2)
O sistema SHALL aplicar a regra `RK-ee6cd831c2d4`: objeto is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `objeto`
- **WHEN** a condição `objeto IS NOT NULL` se verifica
- **THEN** objeto is required

### Requirement: DeRazaoSocial is required (2)
O sistema SHALL aplicar a regra `RK-08a8c7c1e5ea`: DeRazaoSocial is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeRazaoSocial`
- **WHEN** a condição `DeRazaoSocial IS NOT NULL` se verifica
- **THEN** DeRazaoSocial is required

### Requirement: DeDepartamento is required (3)
O sistema SHALL aplicar a regra `RK-ecfa90099032`: DeDepartamento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeDepartamento`
- **WHEN** a condição `DeDepartamento IS NOT NULL` se verifica
- **THEN** DeDepartamento is required

### Requirement: IdPessoaFisica is required (3)
O sistema SHALL aplicar a regra `RK-b053f93a0c93`: IdPessoaFisica is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `IdPessoaFisica`
- **WHEN** a condição `IdPessoaFisica IS NOT NULL` se verifica
- **THEN** IdPessoaFisica is required

### Requirement: DtNascimento is required (3)
O sistema SHALL aplicar a regra `RK-76de6c0f44c8`: DtNascimento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DtNascimento`
- **WHEN** a condição `DtNascimento IS NOT NULL` se verifica
- **THEN** DtNascimento is required

### Requirement: anexo is required (2)
O sistema SHALL aplicar a regra `RK-0e70b6c81ee9`: anexo is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `anexo`
- **WHEN** a condição `anexo IS NOT NULL` se verifica
- **THEN** anexo is required

### Requirement: gerenciamento is required (2)
O sistema SHALL aplicar a regra `RK-4564e4e322b6`: gerenciamento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `gerenciamento`
- **WHEN** a condição `gerenciamento IS NOT NULL` se verifica
- **THEN** gerenciamento is required

### Requirement: DeRazaoSocial is required (3)
O sistema SHALL aplicar a regra `RK-528cec3828cf`: DeRazaoSocial is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DeRazaoSocial`
- **WHEN** a condição `DeRazaoSocial IS NOT NULL` se verifica
- **THEN** DeRazaoSocial is required

### Requirement: Senha atual não confere! (2)
O sistema SHALL aplicar a regra `RK-304882e7bdc8`: Senha atual não confere!

#### Scenario: Regra aplicada
- **GIVEN** os campos `passwordold`
- **WHEN** a condição `Security::hash(passwordold, null, true) <> usuario.password` se verifica
- **THEN** Senha atual não confere!

### Requirement: A nova senha não confere! (2)
O sistema SHALL aplicar a regra `RK-96cbe7d6e198`: A nova senha não confere!

#### Scenario: Regra aplicada
- **GIVEN** os campos `passwordnew`, `passwordconfirm`
- **WHEN** a condição `passwordnew <> passwordconfirm` se verifica
- **THEN** A nova senha não confere!

### Requirement: username is required (2)
O sistema SHALL aplicar a regra `RK-39dd9b2d1419`: username is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `username`
- **WHEN** a condição `username IS NOT NULL` se verifica
- **THEN** username is required

### Requirement: password is required (2)
O sistema SHALL aplicar a regra `RK-38821207df73`: password is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `password`
- **WHEN** a condição `password IS NOT NULL` se verifica
- **THEN** password is required

### Requirement: IdPessoaFisica is required (4)
O sistema SHALL aplicar a regra `RK-b33fcd808e28`: IdPessoaFisica is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `IdPessoaFisica`
- **WHEN** a condição `IdPessoaFisica IS NOT NULL` se verifica
- **THEN** IdPessoaFisica is required

### Requirement: DtNascimento is required (4)
O sistema SHALL aplicar a regra `RK-06d8ff662d9a`: DtNascimento is required

#### Scenario: Regra aplicada
- **GIVEN** os campos `DtNascimento`
- **WHEN** a condição `DtNascimento IS NOT NULL` se verifica
- **THEN** DtNascimento is required
