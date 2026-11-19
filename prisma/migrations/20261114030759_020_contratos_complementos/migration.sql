-- 020-contratos-complementos: migração só de dados (design.md › Projeto básico em PDF).
-- `projetoBasico` passa a guardar o nome gerado por savePdf() (<uuid>.pdf, 40 caracteres).
-- Texto livre gravado quando o campo era textarea é zerado; nomes de savePdf são mantidos.
UPDATE "contratos" SET "projetoBasico" = NULL WHERE "projetoBasico" IS NOT NULL AND NOT (length("projetoBasico") = 40 AND substr("projetoBasico", 37) = '.pdf' AND substr("projetoBasico", 1, 36) NOT GLOB '*[^0-9a-f-]*');
