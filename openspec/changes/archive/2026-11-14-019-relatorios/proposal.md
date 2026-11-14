# Relatórios gerenciais

Depende de: `017-contratos` (arquivada), `020-contratos-complementos` (projeto básico como PDF e `naPresidencia` 0/1 no cadastro de contratos), `021-prestacao-contas-fluxo` (marcação `tipo_contrato.prestacaoContas`, que substitui a lista fixa de tipos de prestação) e `022-pessoas-fornecedores` (gestor por CPF em `pessoas_fisicas.cpf`, fornecedor com `prestadores_servicos.cnpj`). **Aplicar depois de 020, 021 e 022**, mesmo sendo numerada antes (ver design.md › Open Questions).

## Why

O legado tem seis relatórios em `relatorios_controller.php` (docs/legado/relatorios.md) que a
gestão central usa para acompanhar vencimentos, cadastro e metas. O pacote gerado pela RNC os deixou
de fora (`017-contratos/proposal.md` › Fora de escopo; README › Decisões pendentes). Sem eles o app
novo não substitui o legado. Além disso, o legado fixa no código o id do tipo "Contrato"
(`Contrato::tipoContratoId`, 10 em produção) e a lista de tipos sujeitos a prestação de contas
(`PrestacaoConta::tiposContratos`, 3–11 e 13); no app novo isso vira configuração do tipo de contrato.

## What Changes

- Rota `/relatorios` (índice) e uma rota por relatório: `/relatorios/contratos-por-gestor`,
  `/relatorios/contratos-vencendo`, `/relatorios/contratos-vencidos`,
  `/relatorios/cadastro-incompleto`, `/relatorios/acompanhamento-meta`, `/relatorios/acerto-valor`.
- API somente leitura `GET /api/relatorios/<relatorio>` com os filtros do legado, e
  `PUT /api/relatorios/acerto-valor/:id` para gravar o valor inicial (única escrita da change).
- Filtros e colunas iguais aos do legado; só contratos originais (`parentId` nulo); vencimento só pela
  `dataTermino` do próprio contrato (diretiva do autor de 13/11/2026).
- Acompanhamento de meta igual ao legado (decisão do autor): três listas — total vigente, vencidos e em
  prorrogação/risco (180 dias).
- Exportação: PDF pela impressão do navegador com folha de estilo de impressão (títulos do legado,
  paisagem em vencendo/vencidos) e CSV compatível com Excel (`;`, UTF-8 com BOM) nos relatórios que
  tinham PDF/Excel no legado.
- Tipo de contrato ganha a marcação `S`/`N` `contratoPrincipal` ("é o tipo Contrato", no lugar do id fixo)
  e o formulário passa a mostrar `indicativoMetaRisco`, que já existe na tabela. A lista fixa de tipos de
  prestação vira a marcação `prestacaoContas`, criada pela `021-prestacao-contas-fluxo` (mesmo padrão `S`/`N`);
  esta change não a duplica.
- Item "Relatórios" no grupo "Gestão de contratos" do menu.

## Capabilities

### New Capabilities

- `relatorios`: os seis relatórios gerenciais do legado, filtros, exportação CSV, impressão/PDF e gravação do valor inicial (acerto de valor)

### Modified Capabilities

- `tipo-contratos`: lista e formulário passam a ter as marcações `contratoPrincipal` e `indicativoMetaRisco`
- `app-shell`: a navegação principal ganha o item "Relatórios"

## Impact

- Migração `019_relatorios`: coluna `contratoPrincipal` (`TEXT NOT NULL DEFAULT 'N'`) em `tipo_contrato`.
- Novo módulo `src/lib/relatorios/` (consultas, parâmetros, CSV), rotas `src/app/api/relatorios/**` e páginas `src/app/(app)/relatorios/**`.
- Alterados: `src/lib/entities/tipo_contratos.ts`, `tipo_contratos.server.ts`, `src/lib/navigation.ts`, `src/components/app-sidebar.tsx`, `src/components/shell/app-breadcrumb.tsx`, `src/app/(app)/layout.tsx`, `src/app/globals.css`, `tests/navigation.test.ts`, `tests/tipo_contratos.test.ts`.
- Lê colunas entregues por 020 (`projetoBasico` como nome de PDF de `savePdf`, `naPresidencia` 0/1) e usa de 022 o helper `pessoasPorCpf` (`src/lib/reference/pessoas.ts`) e a relação `prestadorServico` (FK por `id`, com `cnpj`).
- Nenhuma dependência nova de npm (sem gerador de PDF no servidor, sem biblioteca de planilha).
- A carga do legado (025) deve marcar os tipos: id legado 10 → `contratoPrincipal = 'S'`; `indicativo_meta_risco = 1` → `indicativoMetaRisco = 'S'` (os de prestação, ids 3–11 e 13, ficam com a 021).

## Fora de escopo

- A marcação `prestacaoContas` e seu uso na prestação de contas: são da `021-prestacao-contas-fluxo`.
- Restringir relatórios por perfil (Administrador, Gestor de contrato, Fiscal, Financeiro, Consulta): fica com `023-perfis-acesso`; aqui basta sessão válida.
- Exportar CSV/PDF de Cadastro incompleto e Acerto de valor, e CSV de Acompanhamento de meta (o legado só tinha tela; meta tinha impressão).
- PDF gerado no servidor (equivalente ao TCPDF `criaPdf`), arquivo `.xlsx` nativo, gráficos, agendamento ou envio por e-mail.
- Relatórios que somam aditivos ao contrato original ou usam o vencimento do último aditivo.
- Telas de andamento (`contratos/andamento`, `andamento_prestacao`) e fluxo do contrato (docs/legado/contratos-complementos.md).
- A home (`src/app/(app)/page.tsx`) ainda calcula o vencimento pelo maior entre contrato e aditivos, contra a diretiva do autor; corrigir não é desta change.
