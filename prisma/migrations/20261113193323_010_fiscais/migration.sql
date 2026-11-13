-- CreateTable
CREATE TABLE "fiscais" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoId" INTEGER NOT NULL,
    "pessoaFisicaCpf" TEXT NOT NULL,
    "suplente" TEXT NOT NULL,
    "dataInclusao" DATETIME,
    "presidente" TEXT NOT NULL
);
