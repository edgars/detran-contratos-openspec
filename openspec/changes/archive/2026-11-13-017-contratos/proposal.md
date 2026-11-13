# Gestão de Contratos

## Why

`contratos` é o centro do sistema legado: `contratos_controller.php` tem 10 telas, 92 campos e
27 regras. O pacote gerado pela RNC capturou só a tela de pesquisa (`busca`, `campo`, `ordenar`)
e mandou as regras do cadastro para "fora de escopo". Esta versão da change descreve o cadastro
real: identificação do contrato, vigência, partes, valores, aditivos e anexos.

## What Changes

- Rotas `/contratos`, `/contratos/new`, `/contratos/[id]`, `/contratos/[id]/edit`, `/contratos/[id]/aditivos/new` e API `/api/contratos`.
- Lista com filtros (texto, departamento, fornecedor, situação e vencimento), no lugar dos campos de pesquisa que o pacote tratava como colunas.
- 12 regras de negócio do legado, citadas por `RK-…`.
- Aditivo como contrato filho (`parentId`), preservando o valor inicial do original.
- Anexos de publicação e de fiscalização enviados no próprio cadastro, só PDF.

## Capabilities

### New Capabilities

- `contratos`: cadastro de contratos, aditivos, filtros da lista e regras de negócio

### Modified Capabilities

_none_

## Impact

- Tabela `contratos` (migração própria), com valores em `Decimal` (`001b-security-baseline`).
- Usa `anexos_publicacao` (`015-anexos-publicacaos`) e `anexos_fiscais` (`013-anexos-fiscais`).
- Depende de `departamentos`, `tipo_contrato`, `modalidades`, `situacao_contratual` e das tabelas de referência `prestadores_servicos` e `pessoas_fisicas`.

## Fora de escopo

- Relatórios do legado (Contratos vencendo, vencidos, por gestor, Acompanhamento de Meta, Cadastro Incompleto, Acerto de Valor): ficam para uma change própria depois desta.
- Comportamentos legados a confirmar: `naPresidencia`, `prestacaoRealizada`, `numeroFiscais`, `periodo` e `anexoTipo` não têm regra rastreada; ficam no modelo, fora do formulário, até confirmação.
