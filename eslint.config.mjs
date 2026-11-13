import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // 001b-security-baseline › "Consultas parametrizadas": SQL nunca montado com texto do usuário.
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "$queryRawUnsafe", message: "Use a API do Prisma ou $queryRaw com template tag." },
        { property: "$executeRawUnsafe", message: "Use a API do Prisma ou $executeRaw com template tag." },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
