## MODIFIED Requirements

### Requirement: Navegação principal
O sistema SHALL oferecer uma navegação principal com um item por entidade gerenciada (Departamentos, TipoContratos, ContratoStatus, Users, Pagamentos, Modalidades, PrestacaoContas, Fases, Fiscais, Status, Historicos, AnexosFiscais, SituacaoContratuals, AnexosPublicacaos, Penalidades, Contratos) e o item Relatórios, que abre `/relatorios`.

Alteração (019): item Relatórios no grupo "Gestão de contratos", depois de Contratos.

#### Scenario: Abrir o app
- **WHEN** o operador abre a aplicação
- **THEN** vê a navegação com Departamentos, TipoContratos, ContratoStatus, Users, Pagamentos, Modalidades, PrestacaoContas, Fases, Fiscais, Status, Historicos, AnexosFiscais, SituacaoContratuals, AnexosPublicacaos, Penalidades, Contratos e cada item abre a lista da entidade
- **AND** vê o item "Relatórios" no grupo "Gestão de contratos", logo depois de "Contratos", que abre `/relatorios`
