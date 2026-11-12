import { referenceListHandler } from "@/lib/reference/route";

// Tabela de referência: só GET. Sem POST/PUT/DELETE, o Next.js responde 405.
export const dynamic = "force-dynamic";
export const GET = referenceListHandler("groups");
