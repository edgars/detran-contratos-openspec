import { prisma } from "@/lib/db";
import { SELECT_CONTRATADA } from "./chaves";
import { ORIGINAIS, SEM_TIPO_CONTRATO, TIPO_CONTRATO, existeTipoContrato, hojeUtc } from "./comum";
import { semFiltrosParams } from "./params";

/** Cadastro incompleto (019-relatorios). Legado: docs/legado/relatorios.md, tela `cadastro`. */

export const params = semFiltrosParams;
export const slug = "cadastro-incompleto";
export const TITULO = "Cadastro incompleto";

export type LinhaCadastro = {
  id: number;
  processo: string | null;
  contrato: string | null;
  contratada: string | null;
  objeto: string;
  temContrato: boolean;
  temProjetoBasico: boolean;
};

const preenchido = (v: string | null) => v !== null && v.trim() !== "";

export async function consultar(now = new Date()): Promise<{ titulo: string; linhas: LinhaCadastro[]; avisos?: string[] }> {
  if (!(await existeTipoContrato())) return { titulo: TITULO, linhas: [], avisos: [SEM_TIPO_CONTRATO] };
  const rows = await prisma.contrato.findMany({
    where: {
      AND: [
        ORIGINAIS,
        // Legado: `tipo_contrato_id = Contrato::tipoContratoId` → tipos com contratoPrincipal = 'S'.
        TIPO_CONTRATO,
        // Legado: vigentes, `data_termino > hoje` (só a data do próprio contrato).
        { dataTermino: { gt: hojeUtc(now) } },
        // Legado: `anexo IS NULL OR projeto_basico IS NULL`; aqui vazio = nulo ou texto vazio. Depois
        // da 020, `projetoBasico` guarda o nome do PDF gravado por `savePdf`.
        { OR: [{ anexo: null }, { anexo: "" }, { projetoBasico: null }, { projetoBasico: "" }] },
      ],
    },
    select: { id: true, numeroProcesso: true, numeroContrato: true, objeto: true, anexo: true, projetoBasico: true, ...SELECT_CONTRATADA },
    orderBy: [{ numeroContrato: "asc" }, { id: "asc" }],
  });
  return {
    titulo: TITULO,
    linhas: rows.map((r) => ({
      id: r.id,
      processo: r.numeroProcesso,
      contrato: r.numeroContrato,
      contratada: r.prestadorServico?.deRazaoSocial ?? null,
      objeto: r.objeto,
      temContrato: preenchido(r.anexo),
      temProjetoBasico: preenchido(r.projetoBasico),
    })),
  };
}
