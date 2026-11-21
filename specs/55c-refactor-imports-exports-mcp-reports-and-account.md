# SPEC 55c — Refactor de imports, exports, MCP, reportes, cuenta y públicas

> **Estado:** Aprobado
> **Depende de:** SPEC 54, SPEC 55a, SPEC 55b
> **Fecha:** 2026-11-21
> **Objetivo:** Aplicar las reglas de SPEC 54 a `imports`, `exports`, `mcp`, `reports`, `tutorials`, `account`, `auth`, `landing` y `legal`, sin cambiar comportamiento, y cerrar la serie subiendo la versión.

## Por qué existe este spec

Es el último de los tres specs de refactor por área. Agrupa lo que consume a las demás features (imports, exports, MCP y reportes leen y escriben con sus servicios) y lo que está fuera del dashboard (cuenta, auth, landing, legales). Va al final porque depende de que los servicios de 55a y 55b ya tengan su forma definitiva.

Estado de partida del área (~31.000 líneas en 209 archivos):

| Archivo                                             | Líneas |
| --------------------------------------------------- | -----: |
| `src/features/exports/queries.ts`                   |    930 |
| `src/features/imports/normalize.ts`                 |    757 |
| `src/features/imports/components/import-wizard.tsx` |    735 |
| `src/features/imports/components/wizard-state.ts`   |    648 |
| `src/features/imports/components/columns-step.tsx`  |    612 |
| `src/features/mcp/tools/write/debt-entries.ts`      |    611 |
| `src/features/mcp/tools/write/debts.ts`             |    606 |
| `src/features/mcp/tools/write/statement.ts`         |    592 |
| `src/features/exports/components/export-dialog.tsx` |    555 |
| `src/features/imports/components/preview-step.tsx`  |    541 |
| `src/features/imports/actions.ts`                   |    490 |
| `src/features/mcp/tools/write/transfers.ts`         |    465 |
| `src/features/exports/workbook/section.ts`          |    409 |
| `src/features/mcp/tools/write/recurring-incomes.ts` |    406 |

Duplicados conocidos del área:

- `shortMonth` en `exports/pdf/charts/svg.ts`, homónimo del de `debts/receivable-collect.ts` con otra firma y otro resultado.
- `formatTimestamp` en `mcp/components/connections-list.tsx`, formato de fecha y hora que pertenece a `src/libs/format.ts`.

Es un **refactor puro**: cero cambios de UI, copy, rutas, esquema SQL, server actions observables, contenido de los archivos exportados ni contrato del MCP (nombres, descripciones, esquemas de entrada y forma de las respuestas de las tools).

## Alcance

**Entra:**

### 1. Procedimiento por feature

El mismo de SPEC 55a y 55b:

1. **Tests de caracterización** de sus módulos puros, antes de tocar nada.
2. **Anatomía** de `docs/arquitectura.md`.
3. **Actions delgadas:** validar → `requireWritableWorkspace` → servicio → revalidar.
4. **Partir los archivos de más de 400 líneas** con la regla de SPEC 55a §2.
5. **Quitar duplicados** (ver §3).
6. **JSDoc** en español en los exports de servicios, queries y módulos puros.
7. **`code-simplifier`** sobre la carpeta, con la guía como contexto y la orden de no cambiar comportamiento; luego `/simplify` sobre el diff.

### 2. Cómo se parte cada feature grande

**`imports`:**

- `normalize.ts` → la normalización de valores sueltos (montos, fechas, textos) a `normalize-values.ts` y la de movimientos a `normalize-transactions.ts`, junto a los `normalize-*.ts` que ya existen por destino.
- `wizard-state.ts` → reducer y tipos de estado separados de los selectores derivados; los tres puros y con test.
- `import-wizard.tsx`, `columns-step.tsx` y `preview-step.tsx` → subcomponentes hermanos y hook de estado.
- `actions.ts` → una action por destino (`transaction-import-actions.ts`, etc.), delgadas.

**`exports`:**

- `queries.ts` → por sección del archivo exportado (`personal-export-queries.ts`, `business-export-queries.ts`, `movement-export-queries.ts`), todas con `import "server-only"`.
- `components/export-dialog.tsx` → subcomponentes hermanos y hook de estado.
- `workbook/section.ts` → helpers de celdas y estilos separados del armado de la sección.
- Se mantienen las fronteras de SPEC 54: `exceljs` solo en `workbook/`; `pdfmake`, `html-to-pdfmake` y `jsdom` solo en `pdf/`.

**`mcp`:**

- Cada archivo de `tools/write/` de más de 400 líneas se parte en un archivo por tool (por ejemplo `debts.ts` → `create-debt.ts` y `update-debt.ts`), con sus helpers de validación en módulos puros con test.
- `catalog.ts` sigue siendo el único registro; la página `/mcp` lee de ahí y no cambia.
- Nombres, descripciones, `inputSchema` y respuestas de las tools no cambian en una sola letra.

### 3. Duplicados y piezas compartidas

- **`shortMonth` de `exports/pdf/charts/svg.ts`** → `axisMonthLabel`. El de `debts/receivable-collect.ts` se queda con su nombre.
- **`formatTimestamp`** de `mcp/components/connections-list.tsx` → `formatDateTime` en `src/libs/format.ts`, con su test.
- Helpers de fechas y meses dentro de `mcp/tools/read/report-helpers.ts` y `reports/` que repitan lo de `src/libs/dates.ts` pasan a usar `libs`.
- `reports/change.ts` (`formatPercentChange`) usa `formatPercent` de `src/libs/format.ts` si el formato base coincide.

### 4. Tests de caracterización

- `imports`: `detect.test.ts`, `normalize-values.test.ts`, `normalize-transactions.test.ts`, `normalize-debt-entries.test.ts`, `normalize-goal-contributions.test.ts`, `normalize-recurring.test.ts`, `duplicates.test.ts`, `balances.test.ts` y `components/wizard-state.test.ts`.
- `exports`: `csv.test.ts`, `range.test.ts` y `columns.test.ts`.
- `mcp`: `tools/read/report-helpers.test.ts`, `tools/shared.test.ts` y `rate-limit.test.ts`, más los módulos puros de validación que salgan de `tools/write/`.
- `reports`: `change.test.ts`, `period.test.ts`, `series.test.ts`, `metrics.test.ts` y `comparison.test.ts`.
- `auth`: `safe-redirect.test.ts` y `errors.test.ts`.
- Un test por cada módulo puro nuevo que salga al partir archivos.

### 5. Features pequeñas

`tutorials`, `account`, `auth`, `landing` y `legal` no tienen archivos de más de 400 líneas. Reciben el procedimiento de §1 (anatomía, actions delgadas, JSDoc, `code-simplifier`) sin partir archivos. En `landing` se respeta `cx` de `src/libs/cx.ts` para no sumar `tailwind-merge` (SPEC 24).

### 6. Verificación

- `/impeccable audit` de Importar, el diálogo de Exportar, Reportes de Personal y Empresa, Cuenta (todas sus secciones), sign-in, sign-up, consentimiento OAuth, landing, legales y `/mcp`, en claro y oscuro, solo para confirmar que nada visible cambió.
- `/code-review high` del diff completo antes del PR; se corrigen sus hallazgos.

### 7. Cierre de la serie

- Versión **0.3.1** en `package.json`, `SITE.info.version`, `CHANGELOG.md` (las entradas de `[Unreleased]` de SPEC 54, 55a, 55b y 55c pasan a `[0.3.1]`) y la tabla de `SECURITY.md`.
- `docs/arquitectura.md` revisado contra el código final: cada ruta y ejemplo existe.
- `CLAUDE.md` y `docs/mcp.md`: rutas nuevas de `exports/`, `imports/` y `mcp/tools/`.

**Fuera de alcance (para otros specs):**

- Cambiar nombres, descripciones, esquemas o respuestas de las tools del MCP.
- Cambiar el contenido o el formato de los `.xlsx`, `.csv` y `.pdf` exportados.
- Cambiar qué columnas o formatos acepta el importador.
- `noUncheckedIndexedAccess`, tests de componentes y de navegador.
- Re-render de los videos de la landing.
- Cambios de UI, copy, rutas o esquema SQL.

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones.

Función nueva en `src/libs/format.ts` (mismo resultado que `formatTimestamp` hoy):

```ts
/** Fecha y hora de un timestamp de Postgres en es-CO, como se ve en Cuenta / Agentes */
export function formatDateTime(value: string): string
```

Contrato del MCP que no cambia: para cada tool de `catalog.ts`, `name`, `description`, `inputSchema` y la forma de su respuesta (incluido `needs_input`) son idénticos antes y después.

## Plan de implementación

Cada paso deja `check`, `eslint`, `prettier:check`, `test` y `build` en verde, y cierra con `/simplify` sobre su diff.

1. Instantánea del contrato del MCP: un test (`src/features/mcp/catalog.test.ts`) que fija `name`, `description` y el JSON de `inputSchema` de cada tool del catálogo.
2. Tests de caracterización de `reports`; procedimiento de §1 en `reports`.
3. Tests de caracterización de `exports`; `axisMonthLabel`; partir `queries.ts`, `export-dialog.tsx` y `workbook/section.ts`.
4. Tests de caracterización de `imports`.
5. Importar / `normalize.ts` y `wizard-state.ts` partidos.
6. Importar / `import-wizard.tsx`, `columns-step.tsx`, `preview-step.tsx` y `actions.ts` partidos.
7. Tests de caracterización de `mcp`; `formatDateTime` en `src/libs/format.ts`; helpers de fechas a `libs`.
8. MCP / partir `tools/write/debt-entries.ts` y `debts.ts`.
9. MCP / partir `tools/write/statement.ts`, `transfers.ts` y `recurring-incomes.ts`.
10. MCP: `code-simplifier` sobre `src/features/mcp/`; el test del paso 1 sigue verde.
11. Tests de `auth`; procedimiento de §1 en `tutorials`, `account`, `auth`, `landing` y `legal`.
12. `/impeccable audit` de las pantallas de §6.
13. Cierre de la serie (§7): versión 0.3.1, `docs/arquitectura.md`, `CLAUDE.md` y `docs/mcp.md`.
14. `/code-review high` del diff completo y corrección de hallazgos.

## Criterios de aceptación

Verificables en código o con los scripts:

- [ ] `pnpm eslint src` no da ningún warning de `max-lines` (cierra la serie: cero en todo el repo).
- [ ] Existen los tests de §4 y `src/features/mcp/catalog.test.ts`, y `pnpm test` pasa.
- [ ] `catalog.test.ts` pasa sin cambiar la instantánea escrita en el paso 1.
- [ ] `grep -rnE "export function shortMonth" src` devuelve solo `src/features/debts/receivable-collect.ts`.
- [ ] `grep -rn "formatTimestamp" src` no devuelve resultados y existe `formatDateTime` en `src/libs/format.ts`.
- [ ] `exceljs` solo aparece en `src/features/exports/workbook/**`, y `pdfmake`, `html-to-pdfmake` y `jsdom` solo en `src/features/exports/pdf/**` (lo verifica `pnpm eslint`).
- [ ] Ninguna action del área hace consultas a Supabase directamente.
- [ ] Todo export de servicios, queries y módulos puros del área tiene JSDoc.
- [ ] `package.json`, `SITE.info.version`, `CHANGELOG.md` y `SECURITY.md` dicen 0.3.1; `CHANGELOG.md` no tiene entradas sueltas en `[Unreleased]` de SPEC 54–55c.
- [ ] Cada ruta de archivo citada en `docs/arquitectura.md`, `CLAUDE.md` y `docs/mcp.md` existe.
- [ ] `git diff` no toca `supabase/migrations/`, `src/types/database.ts` ni textos visibles del área.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.
- [ ] `/code-review high` no deja hallazgos abiertos.

Verificables en navegador (los prueba el usuario a mano):

- [ ] Importar un Excel y un CSV de movimientos, deudas, metas y recurrentes da la misma vista previa, los mismos duplicados detectados y los mismos registros que en `master`.
- [ ] Exportar un mes a `.xlsx`, `.csv` y `.pdf` en Personal y Empresa produce archivos con el mismo contenido y la misma apariencia que en `master`.
- [ ] Reportes de Personal y Empresa muestran las mismas cifras, gráficas y comparaciones.
- [ ] Un agente por MCP lista las tools con los mismos nombres y descripciones, lee un reporte, importa un extracto, registra un pago de deuda y lo revierte igual que antes.
- [ ] Cuenta (General, Preferencias, Privacidad, Seguridad, Agentes), sign-in, sign-up y consentimiento OAuth funcionan igual.
- [ ] En Cuenta / Agentes, la fecha y hora de cada conexión se ve igual.
- [ ] Landing, legales y `/mcp` se ven igual en claro.
- [ ] Los tutoriales guiados se abren y avanzan igual.
- [ ] `/impeccable audit` de las pantallas de §6 no muestra diferencias visibles respecto de `master`.

## Decisiones

- **Sí:** instantánea del contrato del MCP como primer paso. Los agentes conectados dependen de nombres, descripciones y esquemas; un cambio accidental rompe a usuarios fuera de la app.
- **Sí:** partir `tools/write/` en un archivo por tool. **No:** por entidad con varias tools; los archivos de 600 líneas ya son eso.
- **Sí:** `exports/queries.ts` por sección del archivo exportado. Así cada hoja o sección del PDF sabe de dónde salen sus datos.
- **Sí:** `axisMonthLabel` para el de PDF y `shortMonth` se queda en deudas. **No:** renombrar los dos; basta con que dejen de chocar.
- **Sí:** `formatDateTime` en `src/libs/format.ts`. Es formato genérico, no del MCP.
- **Sí:** el importador, los exportados y el MCP no cambian de comportamiento ni de formato. Son contrato con archivos y agentes externos.
- **Sí:** cerrar la serie con 0.3.1. Es un refactor interno sin cambios para el usuario; SemVer pide patch.
- **No:** 0.4.0; no hay funciones nuevas para el usuario.
- **Sí:** cero warnings de `max-lines` en todo el repo al cerrar. Es la señal de que la serie terminó.
- **Sí:** refactor puro. Los bugs encontrados se anotan para su propio spec.
- **Nota:** este spec se escribió junto con SPEC 54, 55a y 55b, antes de implementar SPEC 54. Si SPEC 54, 55a o 55b cambian al implementarse, se ajusta este spec antes de aprobarlo.

## Riesgos

| Riesgo                                                                              | Mitigación                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Partir una tool del MCP cambia su descripción o su esquema y confunde a los agentes | `catalog.test.ts` del paso 1 fija el contrato; criterio de que la instantánea no cambia.      |
| Partir `normalize.ts` cambia cómo se leen montos o fechas de un archivo importado   | Tests de caracterización del paso 4 con archivos de ejemplo; comparación manual con `master`. |
| Partir `exports/queries.ts` cambia los datos de una hoja o del PDF                  | Exportar el mismo mes en `master` y en la rama y comparar los archivos.                       |
| `exceljs` o `pdfmake` se cuelan en otro archivo al partir                           | Las zonas de `no-restricted-imports` de SPEC 54 fallan en `pnpm eslint`.                      |
| Un `import "server-only"` en las queries de exports rompe el Route Handler          | Los Route Handlers son de servidor; `build` lo comprueba en el paso 3.                        |
| Subir la versión deja `SECURITY.md` o `SITE.info.version` desfasados                | Criterio que revisa los cuatro lugares.                                                       |
| `docs/arquitectura.md` queda con rutas que la serie movió                           | Criterio que comprueba cada ruta citada.                                                      |

## Qué no entra en este spec

- Cambios al contrato del MCP, al formato de los exportados o a lo que acepta el importador.
- `noUncheckedIndexedAccess`, tests de componentes y de navegador.
- Re-render de los videos de la landing.
- Cambios visibles, de datos o de esquema.
