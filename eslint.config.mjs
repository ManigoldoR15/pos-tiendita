import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Carpetas de tooling que no son código del proyecto:
    ".claude/**",
    "finopenpos-ref/**",
    "scripts/**",
  ]),
  {
    rules: {
      // Reglas del React Compiler (react-hooks v6): el compilador no está
      // activado en este proyecto y varios patrones que marca (hidratar estado
      // desde localStorage en un effect, fechas en Server Components) son
      // intencionales. Advertencia, no error.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
