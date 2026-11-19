-- CreateTable
CREATE TABLE "historicos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contratoId" INTEGER NOT NULL,
    "dataInclusao" DATETIME,
    "descricao" TEXT,
    "usuarioId" INTEGER,
    CONSTRAINT "historicos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
