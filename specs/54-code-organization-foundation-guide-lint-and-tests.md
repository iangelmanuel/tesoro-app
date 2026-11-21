# SPEC 54 — Base de organización del código: guía, lint, tipos y tests

> **Estado:** Implementado
> **Depende de:** SPEC 51, SPEC 52a, SPEC 52b, SPEC 52c, SPEC 53
> **Fecha:** 2026-11-21
> **Objetivo:** Fijar las reglas de organización del código (guía de arquitectura, ESLint, tsconfig, `server-only` y Vitest) y aplicarlas a la capa compartida (`src/libs`, `src/config`, `src/components`, `src/hooks` y `app/`) como base de la refactorización por áreas.

## Por qué existe este spec

El proyecto creció a ~620 archivos TS/TSX (546 en `src/`, 75 en `app/`) en 53 specs. Las convenciones viven repartidas entre `CLAUDE.md`, `docs/ui.md` y el código. Varias reglas solo se cumplen por disciplina (dónde se importa `exceljs`, qué no importa un componente cliente). Hay señales de desorden:

- 42 archivos de más de 400 líneas (el mayor, `transactions-table.tsx`, con 1.194).
- Funciones con el mismo nombre y distinto significado: `monthsBetween` en `score/curves.ts` devuelve la lista de meses y en `mcp/tools/read/report-helpers.ts` devuelve la cuenta; `formatTime` en `libs/format.ts` da "2:30 p. m." y en `mcp/tools/shared.ts` recorta segundos.
- `src/libs/revalidate.ts` y `src/libs/service-result.ts` importan de `src/features/workspaces/`, al revés de la dirección de capas.
- Ningún `queries.ts` ni `service.ts` está protegido con `server-only`.
- `src/components/dashboard/` tiene 30 archivos sueltos de roles distintos.
- No hay tests. Refactorizar cálculos (score, deudas, imports) sin red de seguridad es arriesgado.

Ordenar todo de una vez sería un PR imposible de revisar. Por eso el trabajo se parte como la migración a shadcn (52a/b/c):

- **SPEC 54 (este):** las reglas, las herramientas que las hacen cumplir y la capa compartida.
- **SPEC 55a, 55b y 55c:** cada área de `src/features/` con esas reglas.

Es un **refactor puro**: cero cambios de UI, copy, rutas, esquema SQL, server actions observables ni respuestas del MCP.

## Alcance

**Entra:**

### 1. Guía de arquitectura (`docs/arquitectura.md`)

En español, para quien llega nuevo y para quien ya conoce el proyecto. Secciones:

- **Mapa del repo:** qué hay en `app/`, `src/libs`, `src/config`, `src/components/*`, `src/features/*`, `src/hooks`, `src/types`, `supabase/`, `scripts/` y `specs/`.
- **Capas y dirección de dependencias**, de abajo arriba:
  1. `src/libs` y `src/config`: no importan de `src/components`, `src/features` ni `app/`.
  2. `src/components/ui`: solo importa de `src/libs` y de otros archivos de `ui/`.
  3. `src/components/{forms,charts,dashboard,site,brand,seo,theme}`: importan de las capas de abajo. `dashboard/` y `forms/` pueden importar de `src/features` para componer el shell y los selectores (excepción documentada).
  4. `src/features/*`: importan de todo lo anterior y de otras features.
  5. `app/`: solo rutas; compone features. Nada en `src/` importa de `app/`.
- **Anatomía de una feature**, con el rol de cada archivo canónico:
  - `schemas.ts`: esquemas Zod de entrada;
  - `types.ts`: tipos de la feature;
  - `constants.ts`: constantes `UPPER_SNAKE_CASE`;
  - `queries.ts`: lecturas, con `import "server-only"`;
  - `service.ts` / `*-service.ts`: escrituras compartidas entre actions y MCP, con `import "server-only"`;
  - `actions.ts`: `"use server"`, delgadas (validar → `requireWritableWorkspace` → servicio → revalidar);
  - `calculations.ts` y otros módulos puros: sin I/O, con su `*.test.ts` al lado;
  - `components/`: UI de la feature, con sus `…Skeleton` (SPEC 51).
- **Flujo de un dato:** escritura (formulario → action → servicio → Supabase con RLS → revalidar) y lectura (página de servidor → `queries.ts` → componente), con un ejemplo real de Movimientos.
- **Servidor y cliente:** `server-only`, `"use client"` lo más abajo posible en el árbol, y funciones que llaman componentes de servidor fuera de archivos `"use client"`.
- **Nombres:**
  - identificadores en inglés; comentarios, JSDoc, UI y docs en español;
  - archivos kebab-case; componentes PascalCase; hooks `use-*.ts` exportando `useX`;
  - booleanos `is/has/can/should`; handlers `handleX` y props `onX`;
  - dos funciones exportadas no comparten nombre si hacen cosas distintas.
- **Dónde va el código compartido:** lo genérico (fechas, formato, matemática, `cn`) en `src/libs/`; la lógica de dominio que usan dos features la exporta la feature dueña y la otra la importa. No hay carpeta `shared/`. Se extrae a la tercera repetición.
- **Hooks:** los de una sola feature viven junto a sus componentes; los genéricos entre features, en `src/hooks/`.
- **Sin barrels** (`index.ts` que reexporta): se importa del archivo que define.
- **Tamaño:** 400 líneas es la alerta (`max-lines` en warning). Cómo partir un archivo: subcomponentes en la misma carpeta, estado en un hook `use-*.ts`, lógica pura a un módulo con test.
- **Comentarios y JSDoc:** JSDoc en español en los exports públicos de `src/libs`, de los servicios y de los cálculos. Se documenta el porqué y la referencia al spec (`SPEC 41`), no lo que el código ya dice.
- **Tests:** Vitest, archivos `*.test.ts` junto al módulo, solo lógica pura.
- **Glosario dominio ↔ código:** Personal/Empresa ↔ `workspace` `personal`/`business`; movimiento ↔ `transaction`; traspaso ↔ `transfer`; cuenta por cobrar ↔ `receivable`; cuota, abono, meta, presupuesto, recurrente y el resto de términos de `docs/producto.md`.
- **Receta "agregar una feature nueva"** paso a paso, y una **lista de chequeo de PR** (check, eslint, prettier, test, build, docs).

`README.md`, `CONTRIBUTING.md` y `CLAUDE.md` enlazan a la guía.

### 2. TypeScript (`tsconfig.json`)

Se agregan `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` y `noImplicitOverride`. Los errores que salgan se corrigen en todo el repo: se borra lo que no se usa y los parámetros obligados por una firma llevan prefijo `_`.

### 3. ESLint (`eslint.config.mjs`)

Errores (se corrigen en todo el repo dentro de este spec):

- `@typescript-eslint/consistent-type-imports` con `fixStyle: "inline-type-imports"` (el estilo que ya usa el código: `import { type X, y }`).
- `unicorn/filename-case` en kebab-case para `src/` y `app/` (solo esa regla de `eslint-plugin-unicorn`).
- `no-restricted-imports`, por zonas:
  - `src/libs/**` y `src/config/**` no importan `@/features/*` ni `@/components/*`;
  - `src/components/ui/**` no importa `@/features/*` ni `@/components/*` fuera de `ui/`;
  - nada en `src/` importa de `app/`;
  - `exceljs` solo desde `src/features/exports/workbook/**`;
  - `pdfmake`, `html-to-pdfmake` y `jsdom` solo desde `src/features/exports/pdf/**`;
  - `@heroui/*`, `react-aria`, `react-aria-components` y `@internationalized/date` prohibidos en todo el repo.

Warning (lo corrigen SPEC 55a/b/c en su área):

- `max-lines` a 400 (sin contar líneas en blanco ni comentarios). Exentos: `src/types/database.ts` (generado) y `src/config/**` (datos).

### 4. `server-only`

- Se instala `server-only` con versión exacta.
- `import "server-only"` en la primera línea de todo `src/features/*/queries.ts`, `src/features/*/service.ts`, `src/features/*/*-service.ts` y `src/libs/supabase/server.ts`.
- Si el build falla porque un archivo cliente importa uno de ellos, la parte pura que necesita se mueve a un módulo propio de la feature (sin cambiar lo que hace).

### 5. Vitest

- Se instala `vitest` con versión exacta.
- `vitest.config.mts` en la raíz: entorno `node`, alias `@` → `./src`, alias `server-only` → `src/testing/server-only-stub.ts` (módulo vacío, defensivo) y `include: ["src/**/*.test.ts"]`.
- Scripts `"test": "vitest run"` y `"test:watch": "vitest"` en `package.json`.
- `test` entra en la matriz del job `quality` de `.github/workflows/ci.yml`.
- Tests de caracterización, escritos **antes** de mover o tocar cada módulo, que fijan el comportamiento actual:
  - `src/libs/dates.test.ts`, `format.test.ts`, `allocate.test.ts` y `payment-description.test.ts`;
  - `src/components/charts/chart-format.test.ts` y `src/components/forms/amount-format.test.ts`;
  - las dos versiones de `monthsBetween` y la de `formatTime` de `mcp/tools/shared.ts` (ver §6).

### 6. Capa compartida

**`src/libs`:**

- `revalidate.ts` y `service-result.ts` pasan a `src/features/workspaces/` (son de dominio: rutas y tipo de espacio). `WorkspaceType` pasa de `workspaces/queries.ts` a `workspaces/types.ts`. Se actualizan los imports.
- Funciones genéricas que hoy viven en features y chocan de nombre pasan a `src/libs/dates.ts` con nombres sin ambigüedad:
  - `monthsBetween` de `score/curves.ts` (lista de meses `YYYY-MM`) → `listMonths(from, to)`;
  - `monthsBetween` de `mcp/tools/read/report-helpers.ts` (cuántos meses) → `countMonths(from, to)`;
  - `formatTime` de `mcp/tools/shared.ts` ("14:30:00" → "14:30") → `trimSeconds(value)`.
- `cx.ts` se queda (evita `tailwind-merge` en la landing, SPEC 24).
- JSDoc en español en cada export.

**`src/config`:** JSDoc en los tipos y constantes exportados de `help.ts`, `shortcuts.ts` y `tutorials.ts`, y un comentario por sección de `SITE` en `site.ts`. Sin cambios de valores.

**`src/components`** (sin `ui/`, que solo recibe las correcciones de lint):

- `seo/JsonLd.tsx` → `seo/json-ld.tsx`.
- Se borra el barrel `dashboard/sidebar/index.ts`; sus consumidores importan de `sidebar/sidebar.tsx` (o del archivo que defina cada pieza).
- Cada `Intl.NumberFormat`, `Intl.DateTimeFormat` o `toLocaleString` en `src/components/` (salvo `ui/calendar.tsx`, de shadcn) usa una función de `src/libs/format.ts`. Si no existe una equivalente, se agrega ahí con su test.
- `src/components/dashboard/` se reorganiza por rol. Las subcarpetas `command/`, `mobile/`, `shortcuts/` y `sidebar/` se quedan:

  | Carpeta nueva    | Archivos                                                                                                                                                                                             |
  | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `shell/`         | `app-sidebar.tsx`, `app-sidebar-skeleton.tsx`, `dashboard-header.tsx`, `dashboard-title.tsx`, `user-menu.tsx`, `workspace-tabs.tsx`, `workspace-theme-root.tsx`, `use-active-workspace.ts`, `nav.ts` |
  | `quick-actions/` | `quick-actions.tsx`, `quick-actions-context.tsx`, `quick-actions-menu.tsx`                                                                                                                           |
  | `hide-amounts/`  | `hide-amounts-context.tsx`, `hide-amounts-toggle.tsx`                                                                                                                                                |
  | `feedback/`      | `empty-state.tsx`, `help-hint.tsx`, `coming-soon.tsx`, `tone.ts`, `tone-badge.tsx`                                                                                                                   |
  | `data/`          | `amount.tsx`, `stat-card.tsx`, `card-heading.tsx`, `scroll-table.tsx`, `surface.ts`, `row-actions.tsx`, `sortable-list.tsx`, `month-nav.tsx`, `month-switcher.tsx`                                   |
  | `overlays/`      | `detail-sheet.tsx`, `delete-dialog.tsx`                                                                                                                                                              |

- JSDoc en las props públicas de `forms/`, `charts/` y `dashboard/`.

**`src/hooks`:** se revisa con la regla de la guía; `use-is-mobile.ts` se queda.

**`app/`:** las páginas solo componen. Lógica que haya en un `page.tsx` o `layout.tsx` más allá de leer params, llamar queries y componer, pasa a la feature correspondiente (archivo nuevo en esa feature, sin tocar sus archivos existentes salvo imports).

### 7. Uso de los plugins

- **`code-simplifier`** (agente) sobre `src/libs`, `src/config`, `src/components` (sin `ui/`), `src/hooks` y `app/`, con `docs/arquitectura.md` como contexto y la orden de no cambiar comportamiento.
- **`/simplify`** sobre el diff al cerrar cada paso del plan.
- **`/impeccable audit`** del shell del dashboard (header, aside, hoja móvil, barra inferior y paleta) en claro y oscuro, solo para confirmar que la reorganización no cambió nada visible. Hallazgos de diseño nuevos se anotan para otro spec; no se corrigen aquí.
- **`/code-review high`** sobre el diff completo antes del PR; se corrigen sus hallazgos.

### 8. Documentación

- `docs/arquitectura.md` nuevo (§1).
- `CLAUDE.md` y `docs/ui.md`: rutas nuevas de `components/dashboard/*`, `json-ld.tsx`, `src/features/workspaces/revalidate.ts`, Vitest y `pnpm test` en "Comandos", y quitar "Aún no hay tests".
- `README.md` y `CONTRIBUTING.md`: enlace a la guía y `pnpm test`.
- `CHANGELOG.md`: entrada en `[Unreleased]` (Added: Vitest, guía de arquitectura, reglas de lint; Changed: reorganización de la capa compartida).

**Fuera de alcance (para otros specs):**

- **SPEC 55a:** `transactions`, `accounts`, `categories`, `budgets`, `workspaces`, `business` y `cash-flow` (incluye el hook genérico `useActionToast` y el `AdjustBalanceDialog` de cuentas).
- **SPEC 55b:** `debts`, `recurring-expenses`, `recurring-incomes`, `goals`, `score` y `business-score` (incluye `ToneBadge` de `debt-indicators.tsx`, el `AdjustBalanceDialog` de deudas y lo compartido entre `score` y `business-score`).
- **SPEC 55c:** `imports`, `exports`, `mcp`, `reports`, `tutorials`, `account`, `auth`, `landing` y `legal` (incluye `shortMonth` duplicado y `formatTimestamp`).
- Partir los 42 archivos de más de 400 líneas que viven en `src/features/` (cada uno en su spec de área).
- `noUncheckedIndexedAccess`.
- Tests de componentes (Testing Library) y de navegador (Playwright).
- Cambios de UI, copy, rutas, esquema SQL o respuestas del MCP.
- Subir de versión.

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones. Reusa el modelo de los specs anteriores.

Archivos de configuración que aparecen o cambian:

```ts
// vitest.config.mts (nuevo)
// environment: "node"
// resolve.alias: { "@": "./src", "server-only": "./src/testing/server-only-stub.ts" }
// test.include: ["src/**/*.test.ts"]
```

```jsonc
// tsconfig.json → compilerOptions (se agregan)
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true,
"noImplicitOverride": true
```

```jsonc
// package.json
"scripts": { "test": "vitest run", "test:watch": "vitest" }
// dependencies: "server-only" (exacta)
// devDependencies: "vitest", "eslint-plugin-unicorn" (exactas)
```

Firmas nuevas en `src/libs/dates.ts` (mismo comportamiento que las funciones que reemplazan):

```ts
/** Meses YYYY-MM de `from` a `to`, inclusive; vacío si `from` > `to` */
export function listMonths(from: string, to: string): string[]
/** Cuántos meses hay de `from` a `to` (YYYY-MM), ambos incluidos */
export function countMonths(from: string, to: string): number
/** "14:30:00" → "14:30"; sin hora, null */
export function trimSeconds(value: string | null): string | null
```

## Plan de implementación

Cada paso deja `check`, `eslint`, `prettier:check`, `test` y `build` en verde, y cierra con `/simplify` sobre su diff.

1. Vitest: instalar `vitest`, crear `vitest.config.mts` y `src/testing/server-only-stub.ts`, agregar los scripts y `test` al CI. Primer test: `src/libs/dates.test.ts`.
2. Tests de caracterización de `src/libs` (`format`, `allocate`, `payment-description`), de `chart-format.ts` y `amount-format.ts`, y de las dos `monthsBetween` y la `formatTime` del MCP.
3. `tsconfig.json`: los cuatro flags nuevos y corrección de sus errores en todo el repo.
4. ESLint: `consistent-type-imports` y `pnpm eslint:fix`.
5. ESLint: `unicorn/filename-case` y renombrar `seo/JsonLd.tsx` → `seo/json-ld.tsx`.
6. Capas: mover `revalidate.ts` y `service-result.ts` a `src/features/workspaces/` y `WorkspaceType` a `workspaces/types.ts`. Luego activar las zonas de `no-restricted-imports` (capas, paquetes de exports y paquetes retirados).
7. ESLint: `max-lines` en warning con sus exenciones.
8. `server-only`: instalar y agregar a queries, servicios y `libs/supabase/server.ts`; resolver los imports cliente que rompan el build.
9. Helpers genéricos: `listMonths`, `countMonths` y `trimSeconds` en `src/libs/dates.ts`; actualizar consumidores y borrar las versiones viejas. Los tests del paso 2 pasan a apuntar a las nuevas.
10. Formatos de `src/components/` hacia `src/libs/format.ts`, con tests de lo que se agregue.
11. Reorganizar `src/components/dashboard/` según la tabla de §6 y borrar `sidebar/index.ts`.
12. `app/`: mover a features la lógica que no sea composición.
13. `code-simplifier` sobre `src/libs`, `src/config`, `src/components` (sin `ui/`), `src/hooks` y `app/`; revisar y aplicar lo que no cambie comportamiento.
14. JSDoc de `src/libs`, `src/config` y las props públicas de `forms/`, `charts/` y `dashboard/`.
15. `/impeccable audit` del shell del dashboard en claro y oscuro.
16. Documentación: `docs/arquitectura.md`, `CLAUDE.md`, `docs/ui.md`, `README.md`, `CONTRIBUTING.md` y `CHANGELOG.md`.
17. `/code-review high` del diff completo y corrección de hallazgos.

## Criterios de aceptación

Verificables en código o con los scripts:

- [x] `pnpm test` corre Vitest y pasa; `.github/workflows/ci.yml` incluye `test` en la matriz de `quality`.
- [x] Existen `dates.test.ts`, `format.test.ts`, `allocate.test.ts` y `payment-description.test.ts` en `src/libs/`, más `chart-format.test.ts` y `amount-format.test.ts`.
- [x] `tsconfig.json` tiene `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` y `noImplicitOverride` en `true`, y `pnpm check` pasa.
- [x] `pnpm eslint` termina sin errores; los únicos warnings son de `max-lines` dentro de `src/features/`.
- [x] Un import de prueba de `@/features/x` dentro de `src/libs/` o de `exceljs` fuera de `exports/workbook/` hace fallar `pnpm eslint` (se comprueba y se revierte).
- [x] `grep -rL '^import "server-only"' src/features/*/queries.ts src/features/*/service.ts src/features/*/*-service.ts src/libs/supabase/server.ts` no devuelve archivos.
- [x] `grep -rE 'from "@/(features|components)' src/libs src/config` no devuelve resultados.
- [x] No existen `src/libs/revalidate.ts`, `src/libs/service-result.ts`, `src/components/seo/JsonLd.tsx` ni `src/components/dashboard/sidebar/index.ts`.
- [x] No hay archivos sueltos en `src/components/dashboard/`; solo las carpetas `command/`, `data/`, `feedback/`, `hide-amounts/`, `mobile/`, `overlays/`, `quick-actions/`, `shell/`, `shortcuts/` y `sidebar/`.
- [x] `grep -rnE "export function (monthsBetween|formatTime)\b" src` devuelve solo `formatTime` de `src/libs/format.ts`.
- [x] `grep -rnE "Intl\.(NumberFormat|DateTimeFormat)|toLocaleString" src/components` devuelve solo `ui/calendar.tsx`.
- [x] Todo export de `src/libs/*.ts` tiene JSDoc.
- [x] Existe `docs/arquitectura.md` con las secciones de §1, y `README.md`, `CONTRIBUTING.md` y `CLAUDE.md` lo enlazan.
- [x] `CLAUDE.md` y `docs/ui.md` no citan rutas que ya no existen (`components/dashboard/surface.ts`, `seo/JsonLd.tsx`, `libs/revalidate.ts`, etc.) ni dicen "Aún no hay tests".
- [x] `git diff` no toca `supabase/migrations/`, `src/types/database.ts`, textos de `src/config/help.ts` ni las descripciones o esquemas de `src/features/mcp/tools/**`.
- [x] `CHANGELOG.md` tiene la entrada en `[Unreleased]`.
- [x] `package.json` usa versiones exactas para `vitest`, `server-only` y `eslint-plugin-unicorn`, y `pnpm install --frozen-lockfile` pasa.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.
- [x] `/code-review high` no deja hallazgos abiertos.

Verificables en navegador (los prueba el usuario a mano):

- [ ] Personal y Empresa (resumen, movimientos, cuentas y una página de "Tu plan") se ven y funcionan igual que antes, en claro y oscuro.
- [ ] Header, aside (con su ancho guardado), hoja móvil, barra inferior, paleta (Ctrl+K) y atajos (N, T, ?, G + letra) funcionan igual que antes.
- [ ] Ocultar montos, crear un movimiento y registrar un traspaso funcionan igual que antes.
- [ ] Landing, legales y `/mcp` se ven igual, con su JSON-LD en el HTML.
- [ ] Exportar un mes a `.xlsx` y `.pdf` funciona igual que antes.
- [ ] Un agente conectado por MCP lista movimientos y la fecha/hora sale con el mismo formato.
- [ ] `/impeccable audit` del shell no muestra diferencias visibles respecto de `master`.

## Decisiones

- **Sí:** partir en SPEC 54 (base) y 55a/b/c (áreas), como 52a/b/c. **No:** un solo spec gigante; ~620 archivos no se revisan en un PR.
- **Sí:** refactor puro. **No:** arreglar bugs al paso; mezclarlo hace imposible saber si un cambio de comportamiento fue a propósito. Los bugs que aparezcan se anotan para su propio spec.
- **Sí:** Vitest solo para lógica pura, con tests de caracterización antes de mover cada módulo. **No:** Testing Library ni Playwright ahora; mucho más trabajo y no es lo que protege un refactor de cálculos.
- **Sí:** tests junto al módulo (`*.test.ts`). **No:** carpeta `tests/` aparte; se pierden al mover archivos.
- **Sí:** guía `docs/arquitectura.md` + JSDoc selectivo. **No:** JSDoc en todo export; ruido que se desactualiza.
- **Sí:** reglas de `CLAUDE.md` pasan a ESLint (fronteras de capas y paquetes). Lo que hoy depende de memoria pasa a fallar en CI.
- **Sí:** `max-lines` como warning. **No:** como error; rompería el CI hasta que cierren los 55x.
- **Sí:** `no-restricted-imports` del core de ESLint. **No:** `import/no-restricted-paths` u otro plugin de capas; el core alcanza y no suma dependencias.
- **Sí:** solo `unicorn/filename-case` de `eslint-plugin-unicorn`. **No:** su preset recomendado; cambiaría estilo en cientos de archivos.
- **Sí:** `noUnused*`, `noFallthroughCasesInSwitch` y `noImplicitOverride`. **No:** `noUncheckedIndexedAccess`; cientos de errores en todo el repo, queda para después de los 55x.
- **Sí:** `server-only` en queries, servicios y el cliente de servidor de Supabase. Convierte en error de build lo que hoy sería una fuga silenciosa.
- **Sí:** genérico en `src/libs`, dominio en su feature dueña. **No:** carpeta `src/features/shared/`; se vuelve un cajón de sastre.
- **Sí:** renombrar las funciones homónimas con distinto significado (`listMonths`, `countMonths`, `trimSeconds`). **No:** unificarlas en una sola; hacen cosas distintas.
- **Sí:** mover `revalidate.ts` y `service-result.ts` a `features/workspaces/`. **No:** mover la noción de espacio a `libs`; es dominio.
- **Sí:** reorganizar `components/dashboard/` por rol. **No:** dejarlo plano; 30 archivos sueltos no dicen qué es cada uno.
- **No:** barrels (`index.ts`); esconden de dónde viene cada cosa y complican la frontera servidor/cliente.
- **Sí:** `cx.ts` se queda. Evita `tailwind-merge` en la landing (SPEC 24).
- **Sí:** `ui/` solo recibe correcciones de lint; es la base de shadcn y se mantiene cercana al upstream.
- **Sí:** `/impeccable audit` solo como verificación de no regresión. **No:** aplicar sus mejoras aquí; romperían el "refactor puro".
- **Sí:** CHANGELOG en `[Unreleased]`. **No:** subir versión; sube al cerrar 55c.

## Riesgos

| Riesgo                                                                                                     | Mitigación                                                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Mover un helper cambia su comportamiento sin que nadie lo note                                             | Test de caracterización antes de moverlo (paso 2); el test sigue verde después del paso 9.                              |
| `server-only` rompe el build porque un componente cliente importa una función pura de `queries.ts`         | Esa función se mueve a un módulo puro de la feature, sin cambiar su código; el paso 8 no cierra hasta que `build` pase. |
| En la config plana de ESLint, un override de `no-restricted-imports` pisa al anterior y se pierde una zona | Cada bloque repite las restricciones globales; criterio con import de prueba que debe fallar.                           |
| Reorganizar `components/dashboard/` deja imports rotos o un `"use client"` mal ubicado                     | Mover con el renombrado del editor o `git mv` + búsqueda de imports; `check` y `build` en el mismo paso.                |
| `code-simplifier` cambia lógica al "simplificar"                                                           | Instrucción explícita de no cambiar comportamiento; revisión humana del diff; tests y `/code-review high` al final.     |
| `noUnusedParameters` obliga a tocar firmas que usa Next (props de página, Route Handlers)                  | Prefijo `_` en el parámetro; no se cambia la firma.                                                                     |
| `eslint:fix` de `consistent-type-imports` choca con el orden de imports de Prettier                        | Correr `pnpm prettier` después en el mismo paso; `prettier:check` en verde.                                             |
| El lockfile queda desincronizado al instalar tres paquetes                                                 | Instalar con pnpm 12.18.0 y correr `pnpm install --frozen-lockfile` antes de cerrar.                                    |
| `CLAUDE.md` o `docs/ui.md` siguen citando rutas viejas y confunden a agentes y personas                    | Criterio específico; búsqueda de cada ruta movida en `*.md`.                                                            |

## Qué no entra en este spec

- Refactor de `src/features/*` (SPEC 55a, 55b y 55c), incluidos sus duplicados de dominio y sus archivos de más de 400 líneas.
- `noUncheckedIndexedAccess`.
- Tests de componentes y de navegador.
- Cualquier cambio visible, de datos o de respuestas del MCP.
- Subir de versión.
