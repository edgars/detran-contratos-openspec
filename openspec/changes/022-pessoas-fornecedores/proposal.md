# Pessoas e fornecedores: chaves CPF/CNPJ do legado e busca remota

Depende de: `001-project-foundation` (tabelas de referência, `app-shell`), `010-fiscais` e `017-contratos` (todas arquivadas). **As changes `019-relatorios`, `020-contratos-complementos` e `025` (carga do legado) dependem desta** e devem ser aplicadas depois dela, mesmo quando numeradas antes (ver design.md › Open Questions).

## Why

No legado, gestor, suplente e fiscal de um contrato são identificados pelo **CPF** e o fornecedor pelo **CNPJ** (`docs/legado/chaves-pessoas-fornecedores.md`): `PessoaFisica.CPF = Contrato.pessoa_fisica_id`, `PrestadorServico.CNPJ = Contrato.prestador_servico_id`, `fiscais.pessoa_fisica_CPF`. O app novo não tem essas chaves: `pessoas_fisicas` não tem `cpf`, `prestadores_servicos` não tem `cnpj`, `contratos.pessoaFisicaId` guarda `idPessoaFisica` como texto (decisão provisória registrada em Open Questions da 017) e `fiscais.pessoaFisicaCpf` é um texto mascarado digitado à mão, sem ligação com nenhuma pessoa. Além disso, os campos de referência carregam só as 100 primeiras linhas (`src/components/crud/use-options.ts`, `size=100`) e não filtram pelo texto digitado — com a tabela global de pessoas físicas do DETRAN-RJ, o operador não consegue achar o gestor. Sem essas chaves, os relatórios (019) não juntam gestor e fornecedor como o legado e a carga do dump (025) não tem onde gravar CPF/CNPJ.

## What Changes

- Coluna `cpf` (11 dígitos, única, opcional) em `pessoas_fisicas` e `cnpj` (14 dígitos, única, opcional) em `prestadores_servicos`; ambas gravadas só com dígitos e exibidas com máscara (`###.###.###-##`, `##.###.###/####-##`).
- `contratos.pessoaFisicaId` e `contratos.suplenteId` passam a guardar o **CPF** (11 dígitos) da pessoa física, como o legado; a gravação confere que o CPF existe em `pessoas_fisicas`.
- `contratos.prestadorServicoId` **continua FK por `id`** para `prestadores_servicos` (decisão em design.md); o fornecedor passa a ser buscado e exibido por razão social **e CNPJ**, e a carga 025 traduz o CNPJ do legado para o `id`.
- `fiscais.pessoaFisicaCpf` deixa de ser texto livre mascarado: é escolhido entre as pessoas físicas por busca e guarda o CPF em 11 dígitos; a lista de Fiscais mostra nome e CPF.
- Componente de busca remota no kit de CRUD (`src/components/crud/remote-lookup.tsx`, shadcn/ui `Popover` + `Command`), que consulta `?q=` na API enquanto o operador digita; usado em gestor, suplente, fiscal e fornecedor, no formulário e nos filtros da lista de Contratos.
- APIs de referência `GET /api/pessoas_fisicas` e `GET /api/prestadores_servicos` aceitam `q` por nome/razão social **ou** CPF/CNPJ (com ou sem máscara), filtro exato pela chave (`cpf`, `cnpj`, `id`) para resolver o valor já gravado, e devolvem só as colunas necessárias ao lookup.
- Funções de dígito verificador de CPF/CNPJ (`src/lib/documento.ts`); o DV **não bloqueia** a escolha de uma pessoa ou fornecedor que existe na referência (justificativa em design.md) e é usado como checagem de qualidade na carga 025 e no seed de desenvolvimento.
- Migração Prisma `022_pessoas_fornecedores`: colunas e índices únicos, tabela `migracao_pendencias`, CPF de `fiscais` sem máscara, e os gestores gravados como `idPessoaFisica` movidos para pendência e resolvidos para CPF pelo script `scripts/resolver-cpf-gestores.mjs` quando `pessoas_fisicas.cpf` estiver preenchido.
- Os dados de referência continuam somente leitura: em produção entram pela carga do banco `global` na 025; em desenvolvimento, pelo seed `scripts/seed-referencia.mjs` (dados fictícios, recusa rodar em produção).

## Capabilities

### New Capabilities

_nenhuma_

### Modified Capabilities

- `app-shell`: dados de referência ganham `cpf`/`cnpj`, busca por documento ou nome, projeção enxuta e o componente de busca remota; regra de dígito verificador.
- `contratos`: gestor e suplente gravam CPF; fornecedor buscado e exibido por razão social e CNPJ; filtros da lista por busca remota; conversão dos gestores já gravados.
- `fiscais`: CPF do fiscal escolhido entre pessoas físicas, gravado sem máscara, lista com nome do fiscal.

## Impact

- `prisma/schema.prisma` (`PessoaFisica.cpf`, `PrestadorServico.cnpj`, `MigracaoPendencia`) e nova migração em `prisma/migrations/`.
- `src/lib/reference/tables.ts`, `src/lib/reference/route.ts`, novo `src/lib/reference/pessoas.ts`, novo `src/lib/documento.ts`, `src/lib/mask.ts`, `src/lib/format.ts`.
- `src/components/crud/types.ts`, `use-options.ts`, `entity-form.tsx`, `entity-list.tsx`, `format-cell.tsx`, novo `remote-lookup.tsx`.
- `src/lib/entities/contratos.ts`, `contratos.server.ts`, `fiscais.ts`, `fiscais.server.ts`, `src/app/(app)/contratos/[id]/page.tsx`.
- Novos scripts `scripts/seed-referencia.mjs` e `scripts/resolver-cpf-gestores.mjs`.
- Testes: `tests/contratos.test.ts` e `tests/fiscais.test.ts` (fixtures de gestor passam de `"1001"` para CPF), novos `tests/documento.test.ts`, `tests/referencia.test.ts`, `tests/migracao-022.test.ts`.
- Consumidores: `019-relatorios` (junta gestor por CPF com `pessoasPorCpf` e fornecedor pela relação `prestadorServico`, com `cnpj`), `020-contratos-complementos` (formulário de contratos com os novos campos de busca) e `025` (grava `cpf`/`cnpj` na carga, traduz CNPJ → `id` e roda o resolvedor de gestores).

## Fora de escopo

- Tela de criação, edição ou exclusão de pessoas físicas ou fornecedores (referência somente leitura, diretiva do `config.yaml`).
- Sincronização contínua com o banco `global` do DETRAN-RJ; a 025 entrega a carga e pode ser executada de novo para atualizar.
- A carga do dump em si (loader, mapeamento de colunas do `global`, relatório de checagens): é da 025; aqui só se define o contrato de dados que ela precisa cumprir.
- Ligar usuário (`users.pessoaId`) a pessoa física por CPF, e a tabela `pessoas` (`cpf`/`cnpj`): ficam para `023-perfis-acesso` ou change própria.
- Coluna de CNPJ ou de gestor na lista de Contratos e ordenação por fornecedor/gestor (relatórios e prestação de contas tratam disso nas changes 019/021).
- Busca sem acento (`José` ≈ `Jose`) e busca fonética de nomes.
