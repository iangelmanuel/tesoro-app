import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier/flat"
import unicorn from "eslint-plugin-unicorn"
import { defineConfig, globalIgnores } from "eslint/config"

// Fronteras de capas y de paquetes (SPEC 54, docs/arquitectura.md). En la
// config plana, un bloque posterior de `no-restricted-imports` reemplaza al
// anterior para los archivos que coinciden: por eso cada zona se arma con
// `restrictImports`, que repite siempre las restricciones globales.

const EXCEL_PACKAGES = ["exceljs"]
const PDF_PACKAGES = ["pdfmake", "html-to-pdfmake", "jsdom"]

// Paquetes retirados (SPEC 53): prohibidos en todo el repo
const RETIRED_PATTERNS = [
  {
    group: [
      "@heroui/*",
      "react-aria",
      "react-aria-components",
      "@internationalized/date"
    ],
    message: "HeroUI y React Aria se retiraron (SPEC 53): usa shadcn + Base UI."
  }
]

const FROM_APP = {
  regex: "^(\\.\\./)+app(/|$)",
  message: "app/ solo contiene rutas: nada en src/ importa de app/."
}

const UPPER_LAYERS = {
  regex: "^(@/(features|components)/|(\\.\\./)+(features|components)/)",
  message:
    "src/libs y src/config son la capa base: no importan de src/features ni de src/components."
}

const OUTSIDE_UI = [
  {
    regex: "^(@/features/|(\\.\\./)+features/)",
    message: "src/components/ui solo importa de src/libs y de ui/."
  },
  {
    regex: "^(@/components/(?!ui/)|\\.\\./)",
    message: "src/components/ui solo importa de src/libs y de ui/."
  }
]

/**
 * Opciones de `no-restricted-imports` para una zona. `allow` lista los
 * paquetes de exports que la zona sí puede importar; `patterns`, las
 * fronteras de capas propias de la zona.
 */
function restrictImports({ allow = [], patterns = [] } = {}) {
  const exportPackages = [
    ...EXCEL_PACKAGES.map((name) => ({
      name,
      message: "exceljs solo se importa desde src/features/exports/workbook/."
    })),
    ...PDF_PACKAGES.map((name) => ({
      name,
      message: `${name} solo se importa desde src/features/exports/pdf/.`
    }))
  ].filter(({ name }) => !allow.includes(name))

  return [
    "error",
    { paths: exportPackages, patterns: [...RETIRED_PATTERNS, ...patterns] }
  ]
}

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
  {
    // 400 líneas es la alerta para partir un archivo (SPEC 54). Warning y no
    // error: los SPEC 55a/b/c parten los de src/features por área. Exentos lo
    // generado (database.ts) y los datos de src/config
    files: ["src/**", "app/**"],
    ignores: ["src/types/database.ts", "src/config/**"],
    rules: {
      "max-lines": [
        "warn",
        { max: 400, skipBlankLines: true, skipComments: true }
      ]
    }
  },
  // Capas y paquetes, de lo general a lo particular
  {
    rules: { "no-restricted-imports": restrictImports() }
  },
  {
    files: ["src/**"],
    rules: {
      "no-restricted-imports": restrictImports({ patterns: [FROM_APP] })
    }
  },
  {
    files: ["src/libs/**", "src/config/**"],
    rules: {
      "no-restricted-imports": restrictImports({
        patterns: [FROM_APP, UPPER_LAYERS]
      })
    }
  },
  {
    files: ["src/components/ui/**"],
    rules: {
      "no-restricted-imports": restrictImports({
        patterns: [FROM_APP, ...OUTSIDE_UI]
      })
    }
  },
  {
    files: ["src/features/exports/workbook/**"],
    rules: {
      "no-restricted-imports": restrictImports({
        allow: EXCEL_PACKAGES,
        patterns: [FROM_APP]
      })
    }
  },
  {
    files: ["src/features/exports/pdf/**"],
    rules: {
      "no-restricted-imports": restrictImports({
        allow: PDF_PACKAGES,
        patterns: [FROM_APP]
      })
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
