# Legado — contratos: o que o app novo ainda não cobre

Fonte: RNC (`getModuleScreens` do módulo `contratos_controller.php`; `models/contrato.php`), 13/11/2026.

- **Projeto básico** (`projeto_basico`) é um **arquivo PDF** ("Projeto Básico (.pdf)") nas telas adicionar/editar. No app novo virou textarea (erro do pacote gerado). O relatório "Cadastro incompleto" depende de `projeto_basico IS NULL`.
- **Localizado na Presidência** (`na_presidencia`, BOOLEAN) na tela editar; usado no relatório de meta.
- **Número de fiscais** (`numeroFiscais`) na tela adicionar.
- **Impressão**: ações PRINT em `contratos/index` (lista em vigor), `visualizar`, `visualizar_restrito`.
- **Andamento** (`contratos/andamento`, `andamento_prestacao`): pesquisa de contratos "vencendo"/"vencidos" por contratada, unidade gestora e gestor; o app novo cobre parte disso com os filtros da lista.
- **Fluxo** (`contratos/fluxo`): registro de andamento do contrato por status (`contrato_status.descricao`, `atendido`), ligado a `status` (HABTM `Status` via `contrato_status`). No app novo existe só o cadastro solto de "Status do contrato".
- **Visualizar restrito / resumo**: visões de leitura reduzidas (ver docs/legado/perfis-acesso.md).
- Mensagens originais do cadastro: "Informe o tipo de contrato", "Informe o número do processo", "Informe o número do contrato", "Informe a data de início", "Informe a data de vencimento", "Informe o departamento(unidade gestora)", "Informe o fornecedor".
- Tamanhos máximos (telas): número de processo e de contrato 45, objeto 200, nº da modalidade 12.
