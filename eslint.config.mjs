import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    ".test-build/**",
    "out/**",
    "build/**",
    "supabase/functions/**",
    "next-env.d.ts"
  ])
]);

export default eslintConfig;
