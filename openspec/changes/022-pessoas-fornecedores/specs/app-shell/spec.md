# Spec Delta

## MODIFIED Requirements

### Requirement: Dados de referência somente leitura
As tabelas de referência (`diretorias`, `pessoas_fisicas`, `pessoas`, `prestadores_servicos`, `groups_users`, `pagamento_arquivos`, `groups`) SHALL ter apenas API de lista (`GET /api/<tabela>`) e aparecer como opções de dropdown ou busca nas entidades que as usam; o sistema SHALL NOT oferecer tela de criação, edição ou exclusão para elas.

Mudou (022): busca remota além do dropdown.

#### Scenario: Carregar um dropdown
- **WHEN** um formulário com campo que referencia `diretorias` é aberto
- **THEN** as opções vêm de `GET /api/diretorias` e nenhuma rota de edição existe para `diretorias`

#### Scenario: Nenhuma escrita em pessoas físicas e fornecedores
- **WHEN** um usuário logado envia `POST`, `PUT` ou `DELETE` para `/api/pessoas_fisicas` ou `/api/prestadores_servicos`
- **THEN** a resposta é `405` e nada é gravado

#### Scenario: Projeção enxuta de pessoas físicas
- **WHEN** um usuário logado chama `GET /api/pessoas_fisicas`
- **THEN** cada item tem só `id`, `idPessoaFisica`, `cpf` e `deNome`
- **AND** campos como `deEndereco`, `deNomeMae` e `dtNascimento` não aparecem

#### Scenario: Seed recusado em produção
- **WHEN** o operador roda `scripts/seed-referencia.mjs` com `NODE_ENV=production`
- **THEN** o script termina com erro e não grava nenhuma linha

## ADDED Requirements

### Requirement: Origem dos dados de referência
Os dados das tabelas de referência SHALL entrar só pela carga do banco `global` do legado (change 025) ou, fora de produção, pelo seed de desenvolvimento `scripts/seed-referencia.mjs`, que MUST recusar rodar com `NODE_ENV=production`.

#### Scenario: Seed em produção
- **WHEN** alguém roda `scripts/seed-referencia.mjs` com `NODE_ENV=production`
- **THEN** o script termina com erro e nada é gravado

### Requirement: Colunas devolvidas pelas APIs de pessoas e fornecedores
`GET /api/pessoas_fisicas` SHALL devolver só `id`, `idPessoaFisica`, `cpf` e `deNome`, e `GET /api/prestadores_servicos` SHALL devolver só `id`, `cnpj` e `deRazaoSocial`.

#### Scenario: Ler pessoas físicas
- **WHEN** uma sessão válida consulta `GET /api/pessoas_fisicas`
- **THEN** cada item tem apenas `id`, `idPessoaFisica`, `cpf` e `deNome`

### Requirement: CPF e CNPJ nas tabelas de referência
`pessoas_fisicas` SHALL ter a coluna `cpf` (opcional, única, 11 dígitos sem pontuação) e `prestadores_servicos` SHALL ter a coluna `cnpj` (opcional, única, 14 dígitos sem pontuação), as chaves do legado (`PessoaFisica.CPF`, `PrestadorServico.CNPJ`, `docs/legado/chaves-pessoas-fornecedores.md`). Toda tela SHALL exibir CPF como `###.###.###-##` e CNPJ como `##.###.###/####-##`.

#### Scenario: CPF repetido
- **GIVEN** uma pessoa física com `cpf` `52998224725`
- **WHEN** outra linha de `pessoas_fisicas` é gravada com o mesmo `cpf`
- **THEN** o banco recusa a gravação pelo índice único

#### Scenario: Exibir documentos
- **WHEN** uma tela mostra a pessoa com `cpf` `52998224725` e o fornecedor com `cnpj` `11222333000181`
- **THEN** exibe `529.982.247-25` e `11.222.333/0001-81`

### Requirement: Busca por nome ou documento nas APIs de referência
`GET /api/pessoas_fisicas` SHALL aceitar `q` e devolver as pessoas cujo `deNome` contém `q` ou, quando `q` tem 3 ou mais dígitos, cujo `cpf` começa com os dígitos de `q` (com ou sem máscara). `GET /api/prestadores_servicos` SHALL fazer o mesmo com `deRazaoSocial` e `cnpj`. O valor de `q` SHALL ser sempre parametrizado.

#### Scenario: Buscar pessoa por nome
- **GIVEN** as pessoas "Maria Gestora" (`52998224725`) e "João Suplente" (`11144477735`)
- **WHEN** um usuário logado chama `GET /api/pessoas_fisicas?q=maria`
- **THEN** a resposta traz só "Maria Gestora"

#### Scenario: Buscar pessoa por CPF mascarado
- **WHEN** um usuário logado chama `GET /api/pessoas_fisicas?q=529.982`
- **THEN** a resposta traz "Maria Gestora", cujo `cpf` começa com `529982`

#### Scenario: Buscar fornecedor por CNPJ
- **GIVEN** o fornecedor "Limpa Tudo Ltda" com `cnpj` `11222333000181`
- **WHEN** um usuário logado chama `GET /api/prestadores_servicos?q=11.222.333`
- **THEN** a resposta traz "Limpa Tudo Ltda"

#### Scenario: Sem sessão
- **WHEN** uma requisição sem sessão chama `GET /api/pessoas_fisicas?q=maria`
- **THEN** a resposta é `401` e nenhum dado é devolvido

### Requirement: Filtro exato e ordem nas APIs de referência
`GET /api/pessoas_fisicas` SHALL aceitar o filtro exato `cpf` e `comCpf=1` (só pessoas com CPF); `GET /api/prestadores_servicos` SHALL aceitar os filtros exatos `id` e `cnpj`. As duas SHALL ordenar por nome ou razão social e SHALL ignorar parâmetros fora dessa lista.

#### Scenario: Resolver o valor gravado
- **WHEN** um usuário logado chama `GET /api/pessoas_fisicas?cpf=529.982.247-25`
- **THEN** a resposta traz exatamente a pessoa com `cpf` `52998224725`

#### Scenario: Só pessoas com CPF, em ordem alfabética
- **GIVEN** as pessoas "Maria Gestora" (`52998224725`), "Ana Sem Documento" (sem `cpf`) e "João Suplente" (`11144477735`)
- **WHEN** um usuário logado chama `GET /api/pessoas_fisicas?comCpf=1&deEndereco=x`
- **THEN** a resposta traz "João Suplente" e "Maria Gestora", nessa ordem, e o parâmetro `deEndereco` não filtra nada

### Requirement: Campo de busca remota
Os campos e filtros que referenciam `pessoas_fisicas` ou `prestadores_servicos` SHALL usar o componente de busca remota do kit (shadcn/ui `Popover` + `Command`), que SHALL consultar `GET <api>?q=<texto>&size=20` 300 ms depois da última tecla, cancelar a consulta anterior, mostrar cada opção como "<nome> — <documento formatado>", avisar quando há mais resultados do que os exibidos e mostrar o rótulo do valor já gravado ao abrir uma edição.

#### Scenario: Digitar parte do nome
- **GIVEN** 500 pessoas físicas cadastradas, entre elas "Maria Gestora"
- **WHEN** o operador digita "Maria Ges" no campo de busca
- **THEN** o componente consulta `GET /api/pessoas_fisicas?q=Maria%20Ges&size=20` uma única vez após a pausa
- **AND** mostra "Maria Gestora — 529.982.247-25" entre as opções

#### Scenario: Mais resultados do que cabem
- **GIVEN** 35 pessoas cujo nome contém "Silva"
- **WHEN** o operador digita "Silva"
- **THEN** o componente mostra 20 opções e o aviso "Mostrando 20 de 35 — continue digitando para refinar"

#### Scenario: Abrir uma edição
- **GIVEN** um contrato com `pessoaFisicaId` `52998224725`
- **WHEN** o operador abre `/contratos/[id]/edit`
- **THEN** o campo Gestor mostra "Maria Gestora — 529.982.247-25" sem que o operador digite nada

### Requirement: Dígito verificador não bloqueia referência existente
O sistema SHALL oferecer a conferência de dígito verificador de CPF e CNPJ (`isCpfValido`, `isCnpjValido`) e SHALL NOT recusar a escolha de uma pessoa física ou fornecedor que existe na referência por causa do dígito verificador, porque essas tabelas vêm do banco `global` e são somente leitura no app; o DV inválido SHALL ser reportado como aviso na carga do legado (025).

#### Scenario: Conferir DV
- **WHEN** `isCpfValido("52998224725")`, `isCpfValido("52998224724")`, `isCpfValido("11111111111")` e `isCnpjValido("11222333000181")` são chamados
- **THEN** os resultados são `true`, `false`, `false` e `true`

#### Scenario: Pessoa do global com DV inválido
- **GIVEN** uma pessoa física com `cpf` `52998224724` (DV inválido) na referência
- **WHEN** o operador a escolhe como gestor de um contrato e salva
- **THEN** o contrato é gravado com `pessoaFisicaId` `52998224724`
