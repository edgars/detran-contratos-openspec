# Conferência das regras do legado (RK) — 13/11/2026

Feita com o MCP da RNC (workspace `48771946-086d-43f2-821f-f172b5870257`): `findRules` (todas as 105 regras, nenhuma marcada como ambígua),
`getRule` nas regras que não são obrigatoriedade simples e `getSourceFile` em `legado/app/models/contrato.php`.

## Resultado

- 64 regras citadas nas specs arquivadas; **todas** têm comentário `// RK-…` no código (64/64).
- 69 regras do legado são NOT NULL de banco e 36 são validações/cálculos. As NOT NULL viraram campos obrigatórios nos schemas `zod`; as mensagens do cadastro de contratos são as do legado (`contrato.php`, `$validate`).
- As regras que não são simples obrigatoriedade foram conferidas uma a uma (coluna "Evidência").
- **Divergência encontrada (vai para a 020):** o legado limita tamanhos nas telas (processo e contrato 45, objeto 200, nº da modalidade 12); o app novo não limita.
- **Fora de escopo continuam fora:** as regras listadas em `001-project-foundation/proposal.md` § Fora de escopo (associação usuário–grupo, `pagamento_id`, etc.). A associação usuário–grupo volta na `023-perfis-acesso`.

## Tabela

| Regra | Capability | Requirement | Ponto no código | Situação | Evidência |
|---|---|---|---|---|---|
| `RK-04fd1cbfc346` | contratos | Informe o número do contrato | `src/lib/entities/contratos.server.ts:66` | Conferida |  |
| `RK-260f6b933f77` | contratos | Valores convertidos antes de gravar | `src/lib/entities/contratos.server.ts:103` | Conferida | contrato.php:99 — formataValor(valor_mensal) (implementado como conversão pt-BR → Decimal) |
| `RK-295d296eb4f7` | contratos | Anexos do cadastro só em PDF | `src/lib/entities/contratos.server.ts:110` | Conferida |  |
| `RK-37f294a3dc8e` | contratos | Informe o fornecedor | `src/lib/entities/contratos.server.ts:72` | Conferida |  |
| `RK-5c46553fce3d` | contratos | Valores convertidos antes de gravar | `src/lib/entities/contratos.server.ts:101` | Conferida | getRule + contrato.php:98 — formataValor(valor_total) antes de gravar (implementado como conversão pt-BR → Decimal) |
| `RK-6b2806cfff8d` | contratos | Informe a data de início | `src/lib/entities/contratos.server.ts:75` | Conferida |  |
| `RK-776d8b62d6df` | contratos | Informe o número do processo | `src/lib/entities/contratos.server.ts:65` | Conferida |  |
| `RK-79134600b4be` | contratos | Informe o tipo de contrato | `src/lib/entities/contratos.server.ts:67` | Conferida |  |
| `RK-9d6599f5897d` | contratos | Informe a data de vencimento | `src/lib/entities/contratos.server.ts:76` | Conferida |  |
| `RK-a0660a4fb262` | contratos | Informe a unidade gestora | `src/lib/entities/contratos.server.ts:71` | Conferida |  |
| `RK-b6f82ba63c1f` | contratos | Anexos do cadastro só em PDF | `src/lib/entities/contratos.server.ts:111` | Conferida |  |
| `RK-c3fbde6dbf4a` | contratos | Valor inicial do contrato original | `src/lib/entities/contratos.server.ts:196` | Conferida | getRule + contrato.php:102 — valor_inicial = valor_total quando parent_id vazio (implementado igual) |
| `RK-01658245d11b` | cross-cutting-rules | Erro ao incluir O arquivo anexo deve ser do tipo PDF! | `src/lib/rules/attachments.ts:21` | Conferida |  |
| `RK-06d8ff662d9a` | cross-cutting-rules | DtNascimento is required (4) | `src/lib/rules/schemas.ts:25` | Conferida |  |
| `RK-08a8c7c1e5ea` | cross-cutting-rules | DeRazaoSocial is required (2) | `src/lib/rules/schemas.ts:35` | Conferida |  |
| `RK-0e70b6c81ee9` | cross-cutting-rules | anexo is required (2) | `src/lib/rules/schemas.ts:88` | Conferida |  |
| `RK-0f7caf172fab` | cross-cutting-rules | suplente is required | `src/lib/rules/schemas.ts:81` | Conferida |  |
| `RK-13dd23ce5afd` | cross-cutting-rules | nome is required | `src/lib/rules/schemas.ts:74` | Conferida |  |
| `RK-174d58601890` | cross-cutting-rules | Erro ao incluir O arquivo anexo deve ser do tipo PDF! (3) | `src/lib/rules/attachments.ts:33` | Conferida |  |
| `RK-23cdd0c37c3c` | cross-cutting-rules | Erro ao incluir Não existe arquivo para anexar! | `src/lib/rules/attachments.ts:20` | Conferida |  |
| `RK-2509b78bd0e0` | cross-cutting-rules | gerenciamento is required | `src/lib/rules/schemas.ts:47` | Conferida |  |
| `RK-304882e7bdc8` | cross-cutting-rules | Senha atual não confere! (2) | `src/lib/rules/password.ts:16` | Conferida |  |
| `RK-32ab70ab3174` | cross-cutting-rules | IdPessoaFisica is required | `src/lib/rules/schemas.ts:23` | Conferida |  |
| `RK-3424ea0367fa` | cross-cutting-rules | Informe o nome do grupo! | `src/lib/rules/schemas.ts:93` | Conferida |  |
| `RK-38821207df73` | cross-cutting-rules | password is required (2) | `src/lib/rules/schemas.ts:59` | Conferida |  |
| `RK-39dd9b2d1419` | cross-cutting-rules | username is required (2) | `src/lib/rules/schemas.ts:57` | Conferida |  |
| `RK-3e9d7e57ae65` | cross-cutting-rules | password is required | `src/lib/rules/schemas.ts:59` | Conferida |  |
| `RK-4564e4e322b6` | cross-cutting-rules | gerenciamento is required (2) | `src/lib/rules/schemas.ts:47` | Conferida |  |
| `RK-4b678b1a2fb6` | cross-cutting-rules | Codigo is required | `src/lib/rules/schemas.ts:18` | Conferida |  |
| `RK-4e6358dbafbf` | cross-cutting-rules | DeDepartamento is required | `src/lib/rules/schemas.ts:30` | Conferida |  |
| `RK-528cec3828cf` | cross-cutting-rules | DeRazaoSocial is required (3) | `src/lib/rules/schemas.ts:35` | Conferida |  |
| `RK-52fdc2d97389` | cross-cutting-rules | DeDepartamento is required (2) | `src/lib/rules/schemas.ts:30` | Conferida |  |
| `RK-6b60cd49b7ed` | cross-cutting-rules | presidente is required | `src/lib/rules/schemas.ts:83` | Conferida |  |
| `RK-76de6c0f44c8` | cross-cutting-rules | DtNascimento is required (3) | `src/lib/rules/schemas.ts:25` | Conferida |  |
| `RK-77287deac605` | cross-cutting-rules | arquivo is required | `src/lib/rules/schemas.ts:40` | Conferida |  |
| `RK-774f44ed6df9` | cross-cutting-rules | competencia is required | `src/lib/rules/schemas.ts:64` | Conferida |  |
| `RK-7a6417845e4d` | cross-cutting-rules | Codigo is required (2) | `src/lib/rules/schemas.ts:18` | Conferida |  |
| `RK-7bc5e0466e28` | cross-cutting-rules | DeDiretoria is required (2) | `src/lib/rules/schemas.ts:16` | Conferida |  |
| `RK-82de63b47e64` | cross-cutting-rules | Por favor,Preencher o campo NOME ! | `src/lib/rules/schemas.ts:45` | Conferida |  |
| `RK-877afa57a9f9` | cross-cutting-rules | periodo is required | `src/lib/rules/schemas.ts:76` | Conferida |  |
| `RK-879233539305` | cross-cutting-rules | objeto is required | `src/lib/rules/schemas.ts:69` | Conferida |  |
| `RK-9187b7b464f8` | cross-cutting-rules | Senha atual não confere! | `src/lib/rules/password.ts:16` | Conferida |  |
| `RK-94d8b17e5a88` | cross-cutting-rules | DtNascimento is required (2) | `src/lib/rules/schemas.ts:25` | Conferida |  |
| `RK-96cbe7d6e198` | cross-cutting-rules | A nova senha não confere! (2) | `src/lib/rules/password.ts:18` | Conferida |  |
| `RK-9aa2ad64672e` | cross-cutting-rules | Erro ao incluir O arquivo anexo deve ser do tipo PDF! (2) | `src/lib/rules/attachments.ts:27` | Conferida |  |
| `RK-9da08201400b` | cross-cutting-rules | anexo is required | `src/lib/rules/schemas.ts:88` | Conferida |  |
| `RK-abb6ac79fad7` | cross-cutting-rules | Erro ao incluir Não existe arquivo para anexar! (3) | `src/lib/rules/attachments.ts:32` | Conferida |  |
| `RK-afd830d80ecf` | cross-cutting-rules | DeRazaoSocial is required | `src/lib/rules/schemas.ts:35` | Conferida |  |
| `RK-b053f93a0c93` | cross-cutting-rules | IdPessoaFisica is required (3) | `src/lib/rules/schemas.ts:23` | Conferida |  |
| `RK-b33fcd808e28` | cross-cutting-rules | IdPessoaFisica is required (4) | `src/lib/rules/schemas.ts:23` | Conferida |  |
| `RK-d2c51245ec1e` | cross-cutting-rules | Erro ao incluir O anexo deve ser do tipo PDF! | `src/lib/rules/attachments.ts:45` | Conferida |  |
| `RK-d76edbb42dbe` | cross-cutting-rules | username is required | `src/lib/rules/schemas.ts:57` | Conferida |  |
| `RK-db6786831c50` | cross-cutting-rules | DeDiretoria is required | `src/lib/rules/schemas.ts:16` | Conferida |  |
| `RK-dcfcd941a4d6` | cross-cutting-rules | A nova senha não confere! | `src/lib/rules/password.ts:18` | Conferida |  |
| `RK-e2b53b79c3c2` | cross-cutting-rules | Erro ao incluir Não existe arquivo para anexar! (2) | `src/lib/rules/attachments.ts:26` | Conferida |  |
| `RK-ecfa90099032` | cross-cutting-rules | DeDepartamento is required (3) | `src/lib/rules/schemas.ts:30` | Conferida |  |
| `RK-ed7bc4aaba15` | cross-cutting-rules | Erro ao incluir O arquivo anexo deve ser do tipo PDF! (4) | `src/lib/rules/attachments.ts:39` | Conferida |  |
| `RK-ee6cd831c2d4` | cross-cutting-rules | objeto is required (2) | `src/lib/rules/schemas.ts:69` | Conferida |  |
| `RK-f0ce91a53de9` | cross-cutting-rules | Descricao is derived before saving | `src/lib/rules/schemas.ts:52` | Conferida |  |
| `RK-f6b71997ac15` | cross-cutting-rules | name is required | `src/lib/rules/schemas.ts:93` | Conferida |  |
| `RK-fa60f5d06b79` | cross-cutting-rules | IdPessoaFisica is required (2) | `src/lib/rules/schemas.ts:23` | Conferida |  |
| `RK-fcc74046a0bd` | cross-cutting-rules | DtNascimento is required | `src/lib/rules/schemas.ts:25` | Conferida |  |
| `RK-067d06861847` | status | status_id is required (2) | `src/lib/entities/status.rules.ts:12` | Conferida | mesma regra (status_id NOT NULL) registrada no módulo de contratos — mesmo ponto (correto) |
| `RK-a7017eb6c42d` | status | status_id is required | `src/lib/entities/status.rules.ts:12` | Conferida | getRule: contrato_status.status_id NOT NULL — aplicada em contrato_status.statusId (correto) |
