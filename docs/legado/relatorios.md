# Legado — relatórios (`legado/app/controllers/relatorios_controller.php`)

Fonte: RNC, workspace `48771946-086d-43f2-821f-f172b5870257`, lido em 13/11/2026 com `getSourceFile`.
Todas as consultas usam só contratos originais (`parent_id IS NULL`). Joins legados:
`PessoaFisica.CPF = Contrato.pessoa_fisica_id`, `PrestadorServico.CNPJ = Contrato.prestador_servico_id`,
`Departamento.id = Contrato.departamento_id`. Exportação em PDF (TCPDF, `criaPdf`) e Excel (`criaExcel`).

| Relatório (tela) | Filtros | Regra | Colunas | Saídas |
|---|---|---|---|---|
| Contratos por gestor (`gestores`) | Gestor (lista de pessoas que são gestoras de algum contrato), Unidade gestora | Agrupa por gestor, tipo e unidade: `COUNT(id)`, `SUM(valor_total)` | Qtde, Tipo, Valor acumulado, Gestor, UN Gestora | Tela, PDF ("Contratos acumulados pelo gestor"), Excel |
| Contratos vencendo (`vencendo`) | Dias (vencendo em X dias), período de vencimento (data início/fim) | `data_termino - hoje > 0` e `< Dias`; se período informado, `data_termino BETWEEN início AND fim`; ordenação escolhida | Contratada, Gestor, UN Gestora, Tipo, Contrato, Processo, Objeto, Valor total, Vencimento | Tela, PDF paisagem ("Contratos vencendo em N dias"), Excel |
| Contratos vencidos (`vencidos`) | Período (data início e data fim, obrigatórios) | `data_termino BETWEEN início AND fim` | Mesmas do vencendo | Tela, PDF paisagem ("Contratos vencidos - Período de: … até …"), Excel |
| Cadastro incompleto (`cadastro`) | — | Contratos do tipo "Contrato" (`tipo_contrato_id = Contrato::tipoContratoId`, 10 em produção), vigentes (`data_termino > hoje`) e com `anexo IS NULL` OU `projeto_basico IS NULL` | Nº processo, Nº contrato, Contratada, Objeto, Tem contrato (anexo), Tem projeto básico | Tela |
| Acompanhamento de meta (`meta`) | — | Três listas de contratos originais: **total** (tipo "Contrato", vigentes), **vencidos** (tipo "Contrato", `data_termino < hoje`, ordem por contratada) e **em prorrogação/risco** (tipos com `indicativo_meta_risco = 1`, vencendo em até **180 dias**). Campos: id, valor_total, processo, contrato, data_termino, `na_presidencia`, objeto, dias para vencer, UN gestora, contratada, gestor | Tela (`meta.ctp`): tipo, valor total, nº de termos | Tela, impressão |
| Acerto de valor (`acertoValor`) | Busca por objeto | Lista contratos originais com `valor_inicial IS NULL` (20 por vez, ordem nº contrato) e permite **informar e gravar o valor inicial** de cada um (formato `1.234,56`) | Nº processo, Nº contrato, Objeto, UN Gestora, Contratada, Valor inicial (editável) | Tela com gravação |

Observações:
- `tipoContratoId` está fixo no código (2 em desenvolvimento, 10 em produção): no app novo vira configuração (tipo de contrato marcado como "Contrato", ex.: coluna/flag ou variável de ambiente), nunca id fixo.
- Decisão do autor (13/11/2026): vencimento considera **só a data do próprio contrato** (como o legado, que filtra `parent_id IS NULL` e usa `data_termino` do original).
- Decisão do autor: o Acompanhamento de Meta deve ser **igual ao legado**.
