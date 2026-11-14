/** Mensagens das regras do legado, com o texto original quando o legado tinha um. */
export const MSG = {
  pdfAnexo: "Erro ao incluir O arquivo anexo deve ser do tipo PDF!",
  pdfAnexoCurto: "Erro ao incluir O anexo deve ser do tipo PDF!",
  semArquivo: "Erro ao incluir Não existe arquivo para anexar!",
  senhaAtual: "Senha atual não confere!",
  novaSenha: "A nova senha não confere!",
  nomeTipoContrato: "Por favor,Preencher o campo NOME !",
  nomeGrupo: "Informe o nome do grupo!",
  obrigatorio: (campo: string) => `${campo} é obrigatório`,
  /** Limite de tamanho das telas do legado (020-contratos-complementos; sem RK). */
  maximo: (campo: string, n: number) => `${campo} deve ter no máximo ${n} caracteres`,
} as const;
