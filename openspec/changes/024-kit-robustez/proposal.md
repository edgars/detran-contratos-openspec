# Robustez do kit de CRUD

Depende de: 001b-security-baseline, 002 a 018 (arquivadas). Vem **antes** de 020, 021, 022 e 023 (exceção à ordem numérica, combinada no plano da onda 0): essas changes usam os ganchos novos do kit.

## Why

As changes 001b–018 foram construídas sobre um kit de CRUD compartilhado (`src/lib/crud/server.ts`, `src/lib/uploads.ts`, `src/lib/rules/fields.ts`, `src/components/crud/*`). Os agentes que aplicaram as entidades registraram defeitos do kit nos `design.md` arquivados e no relatório da construção, e cada entidade os contornou de um jeito:

- PDF gravado por `savePdf()` fica órfão no disco quando a validação (ou outro anexo da mesma requisição) falha depois do upload (`017-contratos/design.md` › Open Questions › "Arquivo órfão"; relatório da construção › "Limitações conhecidas").
- Na troca de anexo o PDF antigo continua no disco (`013-anexos-fiscais/design.md` › "Edição sem arquivo novo").
- A exclusão não tem gancho: os anexos de publicação e fiscais de um contrato excluído ficam órfãos no banco e no disco (`017-contratos/design.md` › Open Questions › "Exclusão"); excluir um anexo deixa o arquivo no disco.
- `UploadError` não diz o campo: o kit devolve o erro em `_`, e cada entidade reembrulha em `FieldRuleError` (`anexos_fiscais.server.ts`, `penalidades.server.ts`, `contratos.server.ts`).
- `prepare` não recebe o registro atual: `prepareAnexoFiscal` relê o banco (`013-anexos-fiscais/design.md`), embora o kit já o tenha lido em `save()`.
- `listWhere` é síncrono: `historicos` resolve a busca por número do contrato na rota e repassa ids em parâmetros internos (`_q`, `_contratos`) que qualquer cliente pode forjar (`historicos.server.ts`).
- `searchFields` aplica `contains` a toda coluna: em coluna numérica o Prisma falha; `status` e `contrato_status` desviaram a busca para `listWhere` (`status.server.ts`, `contrato_status.server.ts`).
- A ordenação da lista é só a fixa de `orderBy`; `contratos` reescreveu a lista inteira para ordenar (`017-contratos/design.md` › "Lista com filtros próprios").
- `optionalString()` transforma vazio em `undefined`, e limpar um campo na edição não apaga o valor (`002-departamentos/design.md`, `006-pagamentos/design.md`; cópias de `clearableString` em `departamentos.server.ts` e `contratos.server.ts`; remendo em `status.server.ts`).
- `publicUser()` tira os campos de senha só do primeiro nível; um `include` de usuário em outra entidade pode devolver `passwordHash`.

O tratamento de `P2002` (valor único duplicado) já existe em `src/lib/crud/server.ts:74` (`409`), mas não tem teste.

## What Changes

- `savePdf` passa a ser chamado por um **registro de arquivos da requisição** do kit (`ctx.files`): o kit apaga os arquivos gravados na requisição se a gravação não terminar, e apaga os arquivos substituídos ou do registro excluído depois que o banco confirmar.
- Configuração `fileFields` no `crudHandlers`, com o nome do campo e a regra (`AttachmentRule`) de cada anexo; `UploadError` passa a carregar o campo e vira `400 { errors: { <campo>: mensagem } }`.
- Gancho `beforeDelete` (com o registro atual e um cliente de transação) e exclusão em transação.
- `prepare` recebe `current` (o registro lido pelo kit).
- `listWhere` pode ser assíncrono e recebe `{ user, q }`.
- `searchFields` aceita campos numéricos (`{ field, type: "int" }`): igualdade quando `q` é inteiro, ignorado nos outros casos.
- Ordenação escolhida pelo operador: `sortFields` no kit, parâmetro `sort=campo:asc|desc`, cabeçalho clicável no `EntityList`.
- `optionalString()` passa a gravar `null` quando o campo vem vazio (e não altera quando ausente); as cópias locais de `clearableString` saem.
- `stripSecrets()` recursivo: toda resposta do kit e de `publicUser` sai sem campos de senha em qualquer nível.
- Teste do `409` para `P2002`.
- As entidades que contornavam os defeitos passam a usar os ganchos do kit (`anexos_fiscais`, `anexos_publicacaos`, `penalidades`, `contratos`, `historicos`, `status`, `contrato_status`, `departamentos`).

## Capabilities

### New Capabilities

- `crud-kit`: comportamento comum das rotas e telas geradas pelo kit de CRUD — ciclo de vida dos anexos na gravação e na exclusão, erros por campo, ganchos `prepare`/`beforeDelete`/`listWhere`, busca, ordenação, campos opcionais apagáveis e conflito de valor único.

### Modified Capabilities

- `security`: "Upload de PDF validado" passa a exigir que nenhum PDF fique no disco sem registro que o referencie; "Senha guardada como hash" passa a valer para usuários aninhados em qualquer resposta.

## Impact

- Código: `src/lib/crud/server.ts`, `src/lib/uploads.ts`, `src/lib/rules/fields.ts`, `src/lib/auth/session.ts`, `src/components/crud/entity-list.tsx`, `src/components/crud/types.ts` e os `*.server.ts` de `anexos_fiscais`, `anexos_publicacaos`, `penalidades`, `contratos`, `historicos`, `status`, `contrato_status`, `departamentos`, `pagamentos`, `prestacao_contas`.
- API: `GET /api/<entidade>` aceita `sort`; o formato de erro de upload muda de `errors._` para `errors.<campo>` (as entidades de anexo já devolviam no campo; o contrato não muda).
- Banco: sem migração.
- Disco (`UPLOAD_DIR`): arquivos passam a ser apagados na falha, na troca e na exclusão.
- Testes: `tests/crud-kit.test.ts` (novo), `tests/uploads.test.ts` (novo), ajustes em `tests/security.test.ts`, `tests/contratos.test.ts`, `tests/historicos.test.ts`, `tests/status.test.ts`.

## Fora de escopo

- Limpeza dos PDFs órfãos que **já** existem no disco (gerados antes desta change): fica para `026-producao` (rotina de manutenção) ou para uma tarefa manual; aqui só se impede que novos surjam.
- Busca remota (`?q=`) nos lookups e componente `command` (`017-contratos/design.md` › "Busca do gestor"): é melhoria de interface, não defeito do kit.
- Autorização por perfil: `023-perfis-acesso` (usa o `ctx.user` e os ganchos desta change).
- A política de exclusão do contrato (o que bloqueia e o que é apagado junto): é da `020-contratos-complementos`, que usa o `beforeDelete` desta change.
- Mensagem por campo no `409` de `P2002`: o texto atual ("Já existe um registro com esse valor") é mantido.
