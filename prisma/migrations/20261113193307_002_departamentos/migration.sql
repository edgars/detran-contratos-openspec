-- CreateTable
CREATE TABLE "departamentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "deDepartamento" TEXT NOT NULL,
    "codigo" TEXT,
    "deLogradouro" TEXT,
    "deComplemento" TEXT,
    "deBairro" TEXT,
    "deCidade" TEXT,
    "cep" TEXT,
    "diretoriaId" INTEGER NOT NULL,
    "municipioId" INTEGER,
    CONSTRAINT "departamentos_diretoriaId_fkey" FOREIGN KEY ("diretoriaId") REFERENCES "diretorias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
