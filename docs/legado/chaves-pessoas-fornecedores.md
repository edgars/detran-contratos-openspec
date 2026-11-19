# Legado — chaves de pessoas e fornecedores

Fonte: RNC (`getModuleScreens` de contratos e relatórios; `relatorios_controller.php`; `models/contrato.php`), 13/11/2026.

- `contratos.pessoa_fisica_id` e `contratos.suplente_id` guardam o **CPF** (`PessoaFisica.CPF = Contrato.pessoa_fisica_id`; campos de tela "Gestor"/"Gestor Suplente", maxLength 11, com busca "Busca (CPF ou Nome)").
- `contratos.prestador_servico_id` guarda o **CNPJ** (`PrestadorServico.CNPJ = Contrato.prestador_servico_id`; tela "Fornecedor", maxLength 14, referência `prestadores_servicos.CNPJ`, exibição `DeRazaoSocial`).
- `fiscais.pessoa_fisica_CPF` também é CPF (HABTM `Fiscais` via `pessoa_fisica_CPF`).
- As tabelas ficam no banco `global` (`global.pessoas_fisicas`, `global.prestadores_servicos`, `global.departamentos`), compartilhado com outros sistemas do DETRAN-RJ.

Lacuna no app novo: o modelo atual (`prisma/schema.prisma`) não tem `pessoas_fisicas.cpf` nem `prestadores_servicos.cnpj`; `contratos.prestadorServicoId` é Int (id) e `pessoaFisicaId` guarda `idPessoaFisica` como texto (Open Question da 017).
