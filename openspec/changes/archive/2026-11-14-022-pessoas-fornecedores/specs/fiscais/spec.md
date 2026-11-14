# Spec Delta

## MODIFIED Requirements

### Requirement: Entrada formatada em Fiscais
O formulário de Fiscais SHALL escolher `pessoaFisicaCpf` por busca remota (nome ou CPF), exibindo `###.###.###-##`, e gravar só os 11 dígitos, como o legado (`fiscais.pessoa_fisica_CPF`, `docs/legado/chaves-pessoas-fornecedores.md`); o filtro `busca` SHALL aceitar o CPF com ou sem máscara.

Mudou (022): `pessoaFisicaCpf` passa a ser escolhido entre as pessoas físicas e gravado sem pontuação.

#### Scenario: `busca` é digitado
- **WHEN** o usuário filtra a lista por `529.982.247-25` ou por `52998224725`
- **THEN** a lista mostra os fiscais com `pessoaFisicaCpf` `52998224725` nos dois casos

#### Scenario: `pessoaFisicaCpf` é digitado
- **WHEN** o usuário digita `529982` no campo `pessoaFisicaCpf`
- **THEN** vê a opção "Maria Gestora — 529.982.247-25" e, ao escolhê-la e salvar, `52998224725` é gravado

## ADDED Requirements

### Requirement: Fiscal escolhido entre pessoas físicas
A API de Fiscais SHALL aceitar `pessoaFisicaCpf` com ou sem máscara, gravar só os dígitos, recusar com `400` e "CPF incompleto: use o formato ###.###.###-##" um valor que não tem 11 dígitos e, na criação ou quando o valor muda, recusar com `400` e "Pessoa física não encontrada para o CPF informado" um CPF que não existe em `pessoas_fisicas`. As regras `RK-0f7caf172fab` (suplente) e `RK-6b60cd49b7ed` (presidente) continuam como estão.

#### Scenario: CPF inexistente
- **WHEN** um `POST /api/fiscais` chega com `pessoaFisicaCpf` `39053344705`, que não está em `pessoas_fisicas`
- **THEN** a resposta é `400` com `pessoaFisicaCpf: "Pessoa física não encontrada para o CPF informado"` e nada é gravado

#### Scenario: CPF mascarado de pessoa existente
- **WHEN** um `POST /api/fiscais` válido chega com `pessoaFisicaCpf` `529.982.247-25`
- **THEN** o fiscal é gravado com `pessoaFisicaCpf` `52998224725`

### Requirement: Lista de Fiscais com nome do fiscal
A lista `/fiscais` SHALL mostrar, além das colunas atuais, o nome do fiscal obtido de `pessoas_fisicas` pelo CPF, e SHALL exibir o CPF formatado; CPF sem pessoa correspondente SHALL mostrar o nome vazio e o CPF formatado.

#### Scenario: Abrir a lista
- **GIVEN** um fiscal com `pessoaFisicaCpf` `52998224725`
- **WHEN** o operador abre `/fiscais`
- **THEN** a linha mostra "Maria Gestora" na coluna Fiscal e `529.982.247-25` na coluna CPF

### Requirement: CPF dos fiscais já gravados sem máscara
A migração `022_pessoas_fornecedores` SHALL regravar todo `fiscais.pessoaFisicaCpf` existente sem pontos e hífen, e o script `scripts/resolver-cpf-gestores.mjs` SHALL listar, sem alterar, os fiscais cujo CPF não existe em `pessoas_fisicas`.

#### Scenario: Migrar fiscal mascarado
- **GIVEN** um fiscal gravado antes da migração com `pessoaFisicaCpf` `529.982.247-25`
- **WHEN** a migração roda
- **THEN** o fiscal fica com `pessoaFisicaCpf` `52998224725`

#### Scenario: Fiscal órfão listado
- **GIVEN** um fiscal com `pessoaFisicaCpf` `39053344705`, que não está em `pessoas_fisicas`
- **WHEN** o resolvedor roda
- **THEN** a saída lista esse fiscal como "CPF sem pessoa física" e o registro não muda
