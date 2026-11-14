# Spec Delta

## MODIFIED Requirements

### Requirement: Gestor e suplente referenciam PessoasFisicas
Os campos `pessoaFisicaId` e `suplenteId` de Contratos SHALL ser escolhidos por busca remota, por nome ou CPF, entre as PessoasFisicas com CPF (`/api/pessoas_fisicas?comCpf=1`) e gravar o CPF escolhido com 11 dígitos, sem pontuação, como o legado (`PessoaFisica.CPF = Contrato.pessoa_fisica_id`, `docs/legado/chaves-pessoas-fornecedores.md`).

Mudou (022): grava o CPF (antes, `idPessoaFisica`) e a busca é remota.

#### Scenario: Buscar o gestor
- **WHEN** o operador digita parte do nome no campo `pessoaFisicaId`
- **THEN** vê as pessoas correspondentes e, ao escolher uma, o CPF é gravado em `pessoaFisicaId`

#### Scenario: Buscar o gestor pelo CPF
- **GIVEN** a pessoa "Maria Gestora" com `cpf` `52998224725`
- **WHEN** o operador digita `529.982.247` no campo `pessoaFisicaId`, escolhe "Maria Gestora — 529.982.247-25" e salva
- **THEN** o contrato é gravado com `pessoaFisicaId` igual a `52998224725`

### Requirement: `prestadorServicoId` referencia PrestadoresServicos
O campo `prestadorServicoId` de Contratos SHALL ser escolhido por busca remota, por razão social ou CNPJ, entre os PrestadoresServicos (`/api/prestadores_servicos`) e gravar o id escolhido, mostrando razão social e CNPJ formatado (`##.###.###/####-##`); a chave do fornecedor no legado é `PrestadorServico.CNPJ = Contrato.prestador_servico_id`.

Mudou (022): busca remota e exibição do CNPJ.

#### Scenario: Escolher o fornecedor
- **WHEN** o operador abre o campo `prestadorServicoId`
- **THEN** vê os fornecedores e, ao escolher um, o id é gravado em `prestadorServicoId`

#### Scenario: Buscar o fornecedor pelo CNPJ
- **GIVEN** o fornecedor "Limpa Tudo Ltda" com `cnpj` `11222333000181`
- **WHEN** o operador digita `11.222.333` no campo `prestadorServicoId`
- **THEN** vê a opção "Limpa Tudo Ltda — 11.222.333/0001-81" e, ao escolhê-la e salvar, o id desse fornecedor é gravado

## ADDED Requirements

### Requirement: CPF de gestor e suplente conferido pela API
A API de Contratos SHALL aceitar `pessoaFisicaId` e `suplenteId` com ou sem máscara, SHALL recusar com `400` valor sem 11 dígitos e, na criação ou quando o valor muda, SHALL recusar com `400` CPF que não existe em `pessoas_fisicas` ("Gestor não encontrado em pessoas físicas" / "Gestor suplente não encontrado em pessoas físicas"); valor inalterado na edição SHALL NOT ser reconferido.

#### Scenario: CPF com máscara pela API
- **WHEN** um `POST /api/contratos` válido chega com `suplenteId` igual a `111.444.777-35` de uma pessoa existente
- **THEN** o contrato é gravado com `suplenteId` igual a `11144477735`

#### Scenario: CPF que não existe
- **WHEN** um `POST /api/contratos` chega com `pessoaFisicaId` igual a `39053344705`, que não está em `pessoas_fisicas`
- **THEN** a resposta é `400` com `pessoaFisicaId: "Gestor não encontrado em pessoas físicas"` e nada é gravado

#### Scenario: CPF incompleto
- **WHEN** um `POST /api/contratos` chega com `suplenteId` igual a `1114447773`
- **THEN** a resposta é `400` no campo `suplenteId` e nada é gravado

#### Scenario: Gestor do legado fora da referência
- **GIVEN** um contrato carregado do legado com `pessoaFisicaId` `39053344705`, que não está em `pessoas_fisicas`
- **WHEN** o operador edita só o `objeto` e salva
- **THEN** o contrato é atualizado e `pessoaFisicaId` continua `39053344705`

### Requirement: Fornecedor inexistente recusado
A API de Contratos SHALL recusar com `400` e "Fornecedor não encontrado" um `prestadorServicoId` que não existe em `prestadores_servicos`; o obrigatório continua sendo `RK-37f294a3dc8e` ("Informe o fornecedor").

#### Scenario: Fornecedor inexistente
- **WHEN** um `POST /api/contratos` chega com `prestadorServicoId` igual a um id que não existe
- **THEN** a resposta é `400` com `prestadorServicoId: "Fornecedor não encontrado"` e nada é gravado

#### Scenario: Salvar sem fornecedor
- **WHEN** um `POST /api/contratos` chega sem `prestadorServicoId`
- **THEN** a resposta é `400` com `prestadorServicoId: "Informe o fornecedor"` (`RK-37f294a3dc8e`) e nada é gravado

### Requirement: Filtros de gestor e fornecedor por busca
Os filtros `gestor` e `prestadorServicoId` da lista `/contratos` SHALL usar o campo de busca remota; o filtro `gestor` SHALL receber o CPF (com ou sem máscara) e mostrar os contratos em que esse CPF é `pessoaFisicaId` ou `suplenteId`.

#### Scenario: Filtrar pelo gestor
- **GIVEN** o contrato FLT-A com `pessoaFisicaId` `52998224725` e o contrato FLT-B com `suplenteId` `52998224725`
- **WHEN** o operador busca "Maria" no filtro Gestor ou suplente e escolhe "Maria Gestora — 529.982.247-25"
- **THEN** a lista chama `GET /api/contratos?gestor=52998224725` e mostra FLT-A e FLT-B

#### Scenario: Filtro com CPF mascarado na URL
- **WHEN** um usuário logado chama `GET /api/contratos?gestor=529.982.247-25`
- **THEN** o resultado é o mesmo de `gestor=52998224725`

### Requirement: Detalhe do contrato com nome e documento
A página `/contratos/[id]` SHALL mostrar gestor e suplente como "<nome> — <CPF formatado>" e o fornecedor como "<razão social> — <CNPJ formatado>"; um CPF gravado que não existe em `pessoas_fisicas` SHALL aparecer formatado seguido de "(não encontrado em pessoas físicas)".

#### Scenario: Gestor encontrado
- **GIVEN** um contrato com `pessoaFisicaId` `52998224725` e fornecedor "Limpa Tudo Ltda" (`11222333000181`)
- **WHEN** o operador abre `/contratos/[id]`
- **THEN** vê "Maria Gestora — 529.982.247-25" em Gestor e "Limpa Tudo Ltda — 11.222.333/0001-81" em Fornecedor

#### Scenario: Gestor órfão
- **GIVEN** um contrato com `suplenteId` `39053344705`, que não está em `pessoas_fisicas`
- **WHEN** o operador abre `/contratos/[id]`
- **THEN** vê "390.533.447-05 (não encontrado em pessoas físicas)" em Gestor suplente

### Requirement: Conversão do gestor gravado como idPessoaFisica
A migração `022_pessoas_fornecedores` SHALL mover para `migracao_pendencias` (com `origem` `022`, contrato, campo e valor antigo) todo `pessoaFisicaId` ou `suplenteId` já gravado que não é um CPF existente em `pessoas_fisicas`, e SHALL deixar o campo nulo, sem perder o valor antigo.

#### Scenario: Migrar gestor gravado como idPessoaFisica
- **GIVEN** um contrato com `pessoaFisicaId` `"1001"` (o `idPessoaFisica` de "Maria Gestora") antes da migração
- **WHEN** a migração roda
- **THEN** o contrato fica com `pessoaFisicaId` nulo e `migracao_pendencias` tem a linha (`contratos`, id do contrato, `pessoaFisicaId`, `1001`) sem `resolvidoEm`

### Requirement: Resolvedor de gestores pendentes
O script `scripts/resolver-cpf-gestores.mjs` SHALL trocar cada pendência aberta de `origem` `022` pelo CPF da pessoa cujo `idPessoaFisica` é o valor antigo, quando essa pessoa tiver `cpf` e o campo do contrato ainda estiver nulo, e SHALL marcar a pendência com `resolvidoEm`. O script SHALL ser idempotente e, com `--dry-run`, SHALL só listar sem gravar.

#### Scenario: Resolver depois da carga
- **GIVEN** a pendência (`contratos`, contrato X, `pessoaFisicaId`, `1001`) e "Maria Gestora" (`idPessoaFisica` 1001) já com `cpf` `52998224725`
- **WHEN** o resolvedor roda
- **THEN** o contrato X fica com `pessoaFisicaId` `52998224725` e a pendência tem `resolvidoEm`

#### Scenario: Pessoa ainda sem CPF
- **GIVEN** uma pendência com valor antigo `1002` e a pessoa de `idPessoaFisica` 1002 sem `cpf`
- **WHEN** o resolvedor roda duas vezes
- **THEN** a pendência continua aberta, o contrato não muda e a saída informa 1 pendência aberta nas duas execuções

#### Scenario: Simulação
- **GIVEN** a pendência resolvível de "Maria Gestora"
- **WHEN** o resolvedor roda com `--dry-run`
- **THEN** a saída lista a troca de `1001` por `52998224725` e nem o contrato nem a pendência mudam
