# Spec Delta

## ADDED Requirements

### Requirement: Tipo de contrato sujeito à prestação de contas
O sistema SHALL guardar em `tipo_contrato.prestacaoContas` ("S"/"N", padrão "N") se o tipo entra na prestação de contas, no lugar dos ids fixos do legado (`docs/legado/prestacao-contas.md`). Os formulários de tipo MUST exibir, depois dos demais campos, o toggle opcional "Sujeito à prestação de contas" (schema `zod` estrito); `GET /api/tipo_contratos` MUST aceitar o filtro `prestacaoContas=S|N`.

#### Scenario: Marcar um tipo
- **GIVEN** o tipo "Contrato" com `prestacaoContas = "N"`
- **WHEN** o operador liga "Sujeito à prestação de contas" em `/tipo_contratos/[id]/edit` e salva
- **THEN** o tipo passa a `prestacaoContas = "S"` e seus contratos vencidos acima do limite entram na lista de prestação de contas

#### Scenario: Tipo novo nasce desmarcado
- **WHEN** o operador cria um tipo sem mexer no toggle
- **THEN** o tipo é gravado com `prestacaoContas = "N"`

#### Scenario: Valor inválido
- **WHEN** a API recebe `POST /api/tipo_contratos` com `prestacaoContas = "X"`
- **THEN** responde `400` com erro em `prestacaoContas` e nada é gravado

#### Scenario: Filtrar tipos marcados
- **GIVEN** um tipo com `prestacaoContas = "S"` e outro com "N"
- **WHEN** a API recebe `GET /api/tipo_contratos?prestacaoContas=S`
- **THEN** devolve só o tipo marcado
