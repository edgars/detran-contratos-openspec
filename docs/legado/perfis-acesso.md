# Legado — controle de acesso (ACL CakePHP por grupo)

Fonte: RNC (`getSourceFile`): `docker/db/init/40_seed_acl.sql`, `plugins/detran/controllers/components/customacl.php`, 13/11/2026.

- Usuário pode estar em **vários grupos** (`groups_users`); a permissão é avaliada pelos grupos do usuário (`customNode`).
- Grupos (AROs): **Gestor**, **Pagamentos**, **ContratoCGCL**, **PrestacaoConta**.
- Todos os grupos têm acesso total à árvore `contratos` (create/read/update/delete) e são diferenciados por "papéis" negados aos outros:
  `eGestor` (só Gestor), `ePagamentos` (só Pagamentos), `eContratoCGCL` (só ContratoCGCL), `ePrestacaoConta` (só PrestacaoConta).
- Telas com visão reduzida: `contratos/visualizar_restrito` e `visualizar_resumo` (dados do contrato sem anexos/edição).
- Ações por recurso no ACL: index, adicionar, atualizar/editar, remover, visualizar, anexar, baixarPdf, fluxo, andamento, relatórios (gestores, vencendo, vencidos, cadastro, meta, acertoValor), prestação (prestacao, fluxo, manterPrestacao).

**Decisão do autor (13/11/2026):** o app novo terá os perfis **Administrador, Gestor de contrato, Fiscal, Financeiro e Consulta**.
Mapeamento sugerido do legado: Gestor → Gestor de contrato; Pagamentos → Financeiro; ContratoCGCL → Administrador (gestão central de contratos); PrestacaoConta → permissão de prestação de contas (avaliar se é perfil próprio ou capacidade do Gestor); Fiscal e Consulta são novos (Consulta usa a visão restrita).
