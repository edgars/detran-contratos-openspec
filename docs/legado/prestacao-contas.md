# Legado — prestação de contas (`prestacao_contas_controller.php`, `models/prestacao_conta.php`)

Fonte: RNC (`getSourceFile`), 13/11/2026.

**Pendentes / realizadas (`prestacao`)**
- Contratos com `tipo_contrato_id IN PrestacaoConta::tiposContratos` (produção: 3,4,5,6,7,8,9,10,11,13 — lista fixa no código; no app novo vira configuração, ex.: flag no tipo de contrato), `parent_id IS NULL`, **vencidos** (`data_termino < hoje`) e `valor_total > 650.000`.
- Alterna entre **pendentes** (`contratos.prestacao_realizada = 0`) e **realizadas** (`= 1`).
- Busca por coluna: UN Gestora, Gestor, Contratada, Nº contrato, Nº processo, Objeto. Ordenação: Contratada, Vencimento, Valor (asc/desc), UN Gestora, Gestor. Filtros de tipo e modalidade. 10 por página.
- Colunas: processo, contrato, vencimento, objeto, dias (desde o vencimento), valor total, contratada, UN gestora.

**Fluxo (`fluxo`, `manterPrestacao`, `prestacaoAjax`)**
- Para um contrato, mostra as **fases** cujo `periodo` = prazo escolhido (`fases.periodo`), com descrição e "atendido".
- Gravar uma fase cria registro em `prestacao_contas` (fase, contrato, usuário, descrição, atendido).
- Quando a fase gravada tem `periodo == 30` e `atendido == 1`, o contrato passa a `prestacao_realizada = 1` (prestação concluída).
- O painel do contrato mostra dias desde o vencimento e meses desde o início (`PERIOD_DIFF(now, data_inicio)`).
- Acesso controlado (`Util->verificaPermissao()`; grupo `PrestacaoConta` no ACL).
