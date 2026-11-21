import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Tests de lógica pura (SPEC 54): `*.test.ts` junto al módulo, sin DOM
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` lanza fuera de un componente de servidor; en los tests
      // se cambia por un módulo vacío
      "server-only": fileURLToPath(
        new URL("./src/testing/server-only-stub.ts", import.meta.url)
      )
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
})
