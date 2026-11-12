# Levantamento do legado — DETRAN-RJ Contratos

Fonte: análise da plataforma RNC (workspace `48771946-086d-43f2-821f-f172b5870257`), consultada em 12/11/2026.

## Resumo

Sistema PHP de gestão de contratos administrativos, com complexidade de modernização **média**:
escopo funcional pequeno e segurança crítica (nota 55/100).

| Item | Valor |
|---|---|
| Módulos / telas / regras | 33 / 42 / 105 |
| Integrações externas | Nenhuma identificada |
| Módulo central | `contratos_controller.php`: 10 telas, 92 campos, 27 regras, 30 achados de segurança |

Capacidades: contratos e aditivos; status, situação e histórico; fiscais titulares e suplentes,
penalidades e anexos; pagamentos (empenho, nota de liquidação, ordem bancária, glosa); prestação de
contas por fases; seis relatórios; cadastros auxiliares; login e grupos.

## Segurança

112 achados: 6 críticos, 44 altos, 45 médios e 17 baixos.

| # | Achado crítico | Onde |
|---|---|---|
| 1-2 | Sessão tirada da URL (`$_GET['sessionId']`) | `plugins/detran/controllers/components/util.php:32-33` |
| 3-5 | Todas as ações sem login (`allowedActions = array('*')`) | `users_controller.php:47`, `plugins/detran/controllers/users_controller.php:22`, `pagamento_arquivos_controller.php:9` |
| 6 | PHP até 5.6; mesmo na 5.6.40 restam 17 CVEs, 4 críticas | runtime |

Outros altos: mass assignment em `contrato_status_controller.php:68`; ações sem login em
`tipo_contratos_controller.php`; senha sem garantia de hash.

## Débito técnico

60 itens: 48 de desempenho (31 predicados não sargáveis, 14 cargas antecipadas, 2 consultas em
laço), 8 de código (rotinas grandes demais), 3 de SQL concatenado e 1 tratamento de erro vazio.

## Dados

- `contratos` é o eixo: referenciado por pagamentos, fiscais, prestação de contas, status e anexos.
- `pessoas_fisicas` tem cerca de 59 campos e entra como tabela de referência.
- Valores monetários em FLOAT no legado; aqui são `Decimal`.
- Sete artefatos duplicados entre `app/` e o plugin `detran` sobre as mesmas tabelas; o app novo tem uma fonte única.

## Riscos e lacunas

- A RNC mostra só leituras de tabela, sem chamadas entre módulos.
- A função de `docker/web/principal/index.php` é desconhecida.
- O legado não tem testes automatizados.
- O destino físico dos anexos do legado não foi identificado.
