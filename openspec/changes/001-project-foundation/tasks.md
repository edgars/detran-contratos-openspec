# Tasks

## 1. Scaffold

- [x] 1.1 Criar o frontend nextjs + shadcn/ui e o backend nextjs com prisma conforme `design.md`; o app sobe vazio com `docker compose up --build`.
- [x] 1.2 Instalar e configurar a biblioteca de UI shadcn/ui: npx shadcn@latest init && npx shadcn@latest add button input textarea select command popover calendar switch table pagination alert-dialog sonner form sidebar breadcrumb dropdown-menu. Layout base com navegação.
- [x] 1.3 Banco sqlite com migrações versionadas; migração inicial vazia aplicada no start.

## 2. Convenções

- [x] 2.1 Contrato REST: `/api/<entidade>` com `GET` paginado (`page`, `size`, `q`), `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id`; erro de validação `400` com mensagem por campo.
- [x] 2.2 Navegação principal com um item por entidade gerenciada (Departamentos, TipoContratos, ContratoStatus, Users, Pagamentos, Modalidades, PrestacaoContas, Fases, Fiscais, Status, Historicos, AnexosFiscais, SituacaoContratuals, AnexosPublicacaos, Penalidades, Contratos); teste que cada item abre a rota.
- [x] 2.3 `.env.example` com toda variável lida pelo app; CORS só para a origem do frontend.

## 3. Dados de referência

- [x] 3.1 Tabela `diretorias` (Diretorias) com migração e API `GET /api/diretorias` somente leitura; teste listando a tabela.
- [x] 3.2 Tabela `pessoas_fisicas` (PessoasFisicas) com migração e API `GET /api/pessoas_fisicas` somente leitura; teste listando a tabela.
- [x] 3.3 Tabela `pessoas` (Pessoas) com migração e API `GET /api/pessoas` somente leitura; teste listando a tabela.
- [x] 3.4 Tabela `prestadores_servicos` (PrestadoresServicos) com migração e API `GET /api/prestadores_servicos` somente leitura; teste listando a tabela.
- [x] 3.5 Tabela `groups_users` (GroupsUsers) com migração e API `GET /api/groups_users` somente leitura; teste listando a tabela.
- [x] 3.6 Tabela `pagamento_arquivos` (PagamentoArquivos) com migração e API `GET /api/pagamento_arquivos` somente leitura; teste listando a tabela.
- [x] 3.7 Tabela `groups` (Groups) com migração e API `GET /api/groups` somente leitura; teste listando a tabela.

## 4. Regras transversais

- [x] 4.1 Enforce `RK-db6786831c50` — DeDiretoria is required; comentário `// RK-db6786831c50` no ponto do código onde a regra vale.
- [x] 4.2 Enforce `RK-4b678b1a2fb6` — Codigo is required; comentário `// RK-4b678b1a2fb6` no ponto do código onde a regra vale.
- [x] 4.3 Enforce `RK-32ab70ab3174` — IdPessoaFisica is required; comentário `// RK-32ab70ab3174` no ponto do código onde a regra vale.
- [x] 4.4 Enforce `RK-fcc74046a0bd` — DtNascimento is required; comentário `// RK-fcc74046a0bd` no ponto do código onde a regra vale.
- [x] 4.5 Enforce `RK-4e6358dbafbf` — DeDepartamento is required; comentário `// RK-4e6358dbafbf` no ponto do código onde a regra vale.
- [x] 4.6 Enforce `RK-afd830d80ecf` — DeRazaoSocial is required; comentário `// RK-afd830d80ecf` no ponto do código onde a regra vale.
- [x] 4.7 Enforce `RK-fa60f5d06b79` — IdPessoaFisica is required; comentário `// RK-fa60f5d06b79` no ponto do código onde a regra vale.
- [x] 4.8 Enforce `RK-94d8b17e5a88` — DtNascimento is required; comentário `// RK-94d8b17e5a88` no ponto do código onde a regra vale.
- [x] 4.9 Enforce `RK-77287deac605` — arquivo is required; comentário `// RK-77287deac605` no ponto do código onde a regra vale.
- [x] 4.10 Enforce `RK-82de63b47e64` — Por favor,Preencher o campo NOME !; comentário `// RK-82de63b47e64` no ponto do código onde a regra vale.
- [x] 4.11 Enforce `RK-2509b78bd0e0` — gerenciamento is required; comentário `// RK-2509b78bd0e0` no ponto do código onde a regra vale.
- [x] 4.12 Enforce `RK-f0ce91a53de9` — Descricao is derived before saving; comentário `// RK-f0ce91a53de9` no ponto do código onde a regra vale.
- [x] 4.13 Enforce `RK-9187b7b464f8` — Senha atual não confere!; nesta change, criar a validação compartilhada de troca de senha com teste unitário; o ponto de uso é a tela de troca de senha de `005-users`, com comentário `// RK-9187b7b464f8`.
- [x] 4.14 Enforce `RK-dcfcd941a4d6` — A nova senha não confere!; nesta change, criar a validação compartilhada de troca de senha com teste unitário; o ponto de uso é a tela de troca de senha de `005-users`, com comentário `// RK-dcfcd941a4d6`.
- [x] 4.15 Enforce `RK-d76edbb42dbe` — username is required; comentário `// RK-d76edbb42dbe` no ponto do código onde a regra vale.
- [x] 4.16 Enforce `RK-3e9d7e57ae65` — password is required; comentário `// RK-3e9d7e57ae65` no ponto do código onde a regra vale.
- [x] 4.17 Enforce `RK-774f44ed6df9` — competencia is required; comentário `// RK-774f44ed6df9` no ponto do código onde a regra vale.
- [x] 4.18 Enforce `RK-879233539305` — objeto is required; comentário `// RK-879233539305` no ponto do código onde a regra vale.
- [x] 4.19 Enforce `RK-13dd23ce5afd` — nome is required; comentário `// RK-13dd23ce5afd` no ponto do código onde a regra vale.
- [x] 4.20 Enforce `RK-877afa57a9f9` — periodo is required; comentário `// RK-877afa57a9f9` no ponto do código onde a regra vale.
- [x] 4.21 Enforce `RK-0f7caf172fab` — suplente is required; comentário `// RK-0f7caf172fab` no ponto do código onde a regra vale.
- [x] 4.22 Enforce `RK-6b60cd49b7ed` — presidente is required; comentário `// RK-6b60cd49b7ed` no ponto do código onde a regra vale.
- [x] 4.23 Enforce `RK-01658245d11b` — Erro ao incluir O arquivo anexo deve ser do tipo PDF!; comentário `// RK-01658245d11b` no ponto do código onde a regra vale.
- [x] 4.24 Enforce `RK-23cdd0c37c3c` — Erro ao incluir Não existe arquivo para anexar!; comentário `// RK-23cdd0c37c3c` no ponto do código onde a regra vale.
- [x] 4.25 Enforce `RK-9da08201400b` — anexo is required; comentário `// RK-9da08201400b` no ponto do código onde a regra vale.
- [x] 4.26 Enforce `RK-52fdc2d97389` — DeDepartamento is required; comentário `// RK-52fdc2d97389` no ponto do código onde a regra vale.
- [x] 4.27 Enforce `RK-3424ea0367fa` — Informe o nome do grupo!; comentário `// RK-3424ea0367fa` no ponto do código onde a regra vale.
- [x] 4.28 Enforce `RK-f6b71997ac15` — name is required; comentário `// RK-f6b71997ac15` no ponto do código onde a regra vale.
- [x] 4.29 Enforce `RK-9aa2ad64672e` — Erro ao incluir O arquivo anexo deve ser do tipo PDF!; comentário `// RK-9aa2ad64672e` no ponto do código onde a regra vale.
- [x] 4.30 Enforce `RK-e2b53b79c3c2` — Erro ao incluir Não existe arquivo para anexar!; comentário `// RK-e2b53b79c3c2` no ponto do código onde a regra vale.
- [x] 4.31 Enforce `RK-174d58601890` — Erro ao incluir O arquivo anexo deve ser do tipo PDF!; comentário `// RK-174d58601890` no ponto do código onde a regra vale.
- [x] 4.32 Enforce `RK-abb6ac79fad7` — Erro ao incluir Não existe arquivo para anexar!; comentário `// RK-abb6ac79fad7` no ponto do código onde a regra vale.
- [x] 4.33 Enforce `RK-7bc5e0466e28` — DeDiretoria is required; comentário `// RK-7bc5e0466e28` no ponto do código onde a regra vale.
- [x] 4.34 Enforce `RK-7a6417845e4d` — Codigo is required; comentário `// RK-7a6417845e4d` no ponto do código onde a regra vale.
- [x] 4.35 Enforce `RK-ed7bc4aaba15` — Erro ao incluir O arquivo anexo deve ser do tipo PDF!; comentário `// RK-ed7bc4aaba15` no ponto do código onde a regra vale.
- [x] 4.36 Enforce `RK-d2c51245ec1e` — Erro ao incluir O anexo deve ser do tipo PDF!; comentário `// RK-d2c51245ec1e` no ponto do código onde a regra vale.
- [x] 4.37 Enforce `RK-ee6cd831c2d4` — objeto is required; comentário `// RK-ee6cd831c2d4` no ponto do código onde a regra vale.
- [x] 4.38 Enforce `RK-08a8c7c1e5ea` — DeRazaoSocial is required; comentário `// RK-08a8c7c1e5ea` no ponto do código onde a regra vale.
- [x] 4.39 Enforce `RK-ecfa90099032` — DeDepartamento is required; comentário `// RK-ecfa90099032` no ponto do código onde a regra vale.
- [x] 4.40 Enforce `RK-b053f93a0c93` — IdPessoaFisica is required; comentário `// RK-b053f93a0c93` no ponto do código onde a regra vale.
- [x] 4.41 Enforce `RK-76de6c0f44c8` — DtNascimento is required; comentário `// RK-76de6c0f44c8` no ponto do código onde a regra vale.
- [x] 4.42 Enforce `RK-0e70b6c81ee9` — anexo is required; comentário `// RK-0e70b6c81ee9` no ponto do código onde a regra vale.
- [x] 4.43 Enforce `RK-4564e4e322b6` — gerenciamento is required; comentário `// RK-4564e4e322b6` no ponto do código onde a regra vale.
- [x] 4.44 Enforce `RK-528cec3828cf` — DeRazaoSocial is required; comentário `// RK-528cec3828cf` no ponto do código onde a regra vale.
- [x] 4.45 Enforce `RK-304882e7bdc8` — Senha atual não confere!; nesta change, criar a validação compartilhada de troca de senha com teste unitário; o ponto de uso é a tela de troca de senha de `005-users`, com comentário `// RK-304882e7bdc8`.
- [x] 4.46 Enforce `RK-96cbe7d6e198` — A nova senha não confere!; nesta change, criar a validação compartilhada de troca de senha com teste unitário; o ponto de uso é a tela de troca de senha de `005-users`, com comentário `// RK-96cbe7d6e198`.
- [x] 4.47 Enforce `RK-39dd9b2d1419` — username is required; comentário `// RK-39dd9b2d1419` no ponto do código onde a regra vale.
- [x] 4.48 Enforce `RK-38821207df73` — password is required; comentário `// RK-38821207df73` no ponto do código onde a regra vale.
- [x] 4.49 Enforce `RK-b33fcd808e28` — IdPessoaFisica is required; comentário `// RK-b33fcd808e28` no ponto do código onde a regra vale.
- [x] 4.50 Enforce `RK-06d8ff662d9a` — DtNascimento is required; comentário `// RK-06d8ff662d9a` no ponto do código onde a regra vale.

## 5. Locale, formatos e máscaras

- [x] 5.1 Locale `pt-BR`: um formatador de data (`dd/MM/yyyy`) e um de moeda (`R$`) compartilhados por toda lista e formulário; testar uma data e um valor.
- [x] 5.2 Input mascarado compartilhado (`#` dígito, `A` letra) para as máscaras de `design.md` (CPF `###.###.###-##`, CEP `#####-###`); testar que um valor fora da máscara é rejeitado.

## 6. Verificação

- [x] 6.1 `openspec validate 001-project-foundation --strict` passa; smoke test sobe o app e abre cada item da navegação.
