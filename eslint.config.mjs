import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier/flat"
import unicorn from "eslint-plugin-unicorn"
import { defineConfig, globalIgnores } from "eslint/config"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      // `import { type X, y }`: el estilo que ya usa el código (SPEC 54)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" }
      ]
    }
  },
  {
    // Archivos en kebab-case (SPEC 54). Solo esta regla de unicorn: su
    // preset cambiaría estilo en cientos de archivos
    files: ["src/**", "app/**"],
    plugins: { unicorn },
    rules: {
      // Los segmentos dinámicos de Next (`[workspaceId]`) son nombres de param
      "unicorn/filename-case": [
        "error",
        { case: "kebabCase", ignore: [/^\[.+\]$/] }
      ]
    }
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // skills de terceros: se versionan tal como vienen del upstream
    ".agents/skills/**",
    ".claude/skills/**"
  ])
])

export default eslintConfig
