# Spec Delta

## MODIFIED Requirements

### Requirement: Upload de PDF validado
O sistema SHALL aceitar anexos só quando o conteúdo começa com a assinatura `%PDF-` e o tamanho não passa de `UPLOAD_MAX_MB`, SHALL gravá-los fora da pasta pública e SHALL servi-los só para sessões válidas.

Alterado por 024-kit-robustez: a limpeza de PDF sem referência passa ao requisito *PDF sem referência apagado do disco*.

#### Scenario: Arquivo renomeado para .pdf
- **WHEN** o operador envia uma imagem renomeada para `anexo.pdf`
- **THEN** o upload é recusado com "O arquivo anexo deve ser do tipo PDF!" e nada é gravado

#### Scenario: Baixar anexo sem sessão
- **WHEN** um visitante sem sessão pede a URL de um anexo
- **THEN** a resposta é `401`

### Requirement: Senha guardada como hash
O sistema SHALL guardar senhas só como hash `argon2id` ou `bcrypt` (custo mínimo 12) e SHALL NOT devolver senha ou hash em nenhuma resposta de API nem exibi-los em lista ou formulário.

Alterado por 024-kit-robustez: a remoção em qualquer nível da resposta passa ao requisito *Campos de senha removidos em qualquer nível*.

#### Scenario: Ler um usuário
- **WHEN** o operador consulta `GET /api/users/:id`
- **THEN** a resposta não contém `password`, `passwordHash`, `passwordold`, `passwordnew` nem `passwordconfirm`

#### Scenario: Senha incorreta
- **WHEN** o operador tenta entrar com senha errada
- **THEN** o login é recusado com mensagem genérica, sem dizer se o usuário existe

## ADDED Requirements

### Requirement: PDF sem referência apagado do disco
O sistema SHALL NOT deixar no disco PDF que nenhum registro referencie: o arquivo gravado numa requisição que não termina com o registro gravado, o arquivo substituído numa edição (depois da gravação) e o arquivo de um registro excluído (depois da exclusão) SHALL ser apagados. Antes da 024 o arquivo ficava no disco nos três casos.

#### Scenario: Upload recusado não deixa arquivo
- **GIVEN** a pasta `UPLOAD_DIR` com N arquivos
- **WHEN** o operador envia um PDF válido num formulário que é recusado na validação
- **THEN** a resposta é `400` e `UPLOAD_DIR` continua com N arquivos

#### Scenario: Troca de anexo
- **GIVEN** uma penalidade com o arquivo `antigo.pdf`
- **WHEN** o operador grava a penalidade com um PDF novo
- **THEN** `antigo.pdf` não existe mais em `UPLOAD_DIR` e o PDF novo é servido pela URL do anexo

#### Scenario: Exclusão de registro com anexo
- **GIVEN** um anexo fiscal com o arquivo `f.pdf`
- **WHEN** o operador exclui o anexo fiscal
- **THEN** `f.pdf` não existe mais em `UPLOAD_DIR` e a URL do anexo responde `404`

### Requirement: Campos de senha removidos em qualquer nível
O sistema SHALL remover `password`, `passwordHash`, `passwordold`, `passwordnew` e `passwordconfirm` em qualquer nível da resposta de API, inclusive em usuários incluídos dentro de outro registro ou de uma lista. Antes da 024 só o primeiro nível era limpo, por `publicUser`.

#### Scenario: Usuário aninhado em outro registro
- **GIVEN** uma entidade configurada no kit com `include` do usuário completo (todas as colunas de `users`)
- **WHEN** o operador lista essa entidade pela API
- **THEN** nenhum item da resposta contém `passwordHash`, em nenhum nível
