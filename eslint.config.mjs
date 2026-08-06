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
    "android/**",
    "ios/**",
    "project_tree_to_templates_final_package/**",
    "replace_project_tree_with_templates_js_package/**",
    "app/clean_concentrations_templates/**",
    "**/*.backup*.tsx",
    "app/page_with_visible_template_button.tsx",
    "app/next.config.ts",
    "page.tsx",
    "public/page.tsx",
  ]),
]);

export default eslintConfig;
