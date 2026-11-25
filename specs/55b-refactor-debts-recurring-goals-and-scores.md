# SPEC 55b — Refactor de deudas, recurrentes, metas y scores

> **Estado:** Implementado
> **Depende de:** SPEC 54, SPEC 55a
> **Fecha:** 2026-11-21
> **Objetivo:** Aplicar las reglas de SPEC 54 a `debts`, `recurring-expenses`, `recurring-incomes`, `goals`, `score` y `business-score`, sin cambiar comportamiento.

## Por qué existe este spec

Es el segundo de los tres specs de refactor por área. Agrupa "Tu plan" y los scores: la lógica con más cálculo (cuotas, ciclos de tarjeta, ocurrencias, factores del score) y la que más se beneficia de tests de caracterización antes de moverla.

Estado de partida del área (~24.000 líneas en 116 archivos). `debts` sola tiene 10.700 líneas y 12 archivos de más de 400:

| Archivo                                                                  | Líneas |
| ------------------------------------------------------------------------ | -----: |
| `src/features/debts/actions.ts`                                          |    801 |
| `src/features/debts/entry-service.ts`                                    |    779 |
| `src/features/debts/components/payment-dialog.tsx`                       |    646 |
| `src/features/debts/components/debt-sheet.tsx`                           |    633 |
| `src/features/debts/components/receivable-collect-form.tsx`              |    623 |
| `src/features/debts/components/debt-entry-dialog.tsx`                    |    616 |
| `src/features/recurring-incomes/components/recurring-income-sheet.tsx`   |    580 |
| `src/features/debts/schemas.ts`                                          |    565 |
| `src/features/debts/calculations.ts`                                     |    556 |
| `src/features/debts/components/receivable-dialog.tsx`                    |    554 |
| `src/features/recurring-incomes/components/recurring-income-dialog.tsx`  |    552 |
| `src/features/recurring-incomes/queries.ts`                              |    544 |
| `src/features/business-score/recommendations.ts`                         |    504 |
| `src/features/score/recommendations.ts`                                  |    502 |
| `src/features/debts/components/debt-dialog.tsx`                          |    497 |
| `src/features/recurring-expenses/components/recurring-expense-sheet.tsx` |    479 |
| `src/features/debts/components/debt-entries-list.tsx`                    |    431 |
| `src/features/debts/components/debt-card.tsx`                            |    411 |

Duplicados conocidos del área:

- `ToneBadge` en `debts/components/debt-indicators.tsx`, igual en propósito al de `src/components/dashboard/feedback/tone-badge.tsx` (ruta de SPEC 54).
- `AdjustBalanceDialog` de deudas, homónimo del de cuentas (renombrado en SPEC 55a).
- Cuatro hooks de action + toast (`use-debt-action.ts`, `use-goal-action.ts`, `use-recurring-expense-actions.ts`, `use-recurring-income-actions.ts`) que pasan a `useActionToast` (SPEC 55a).

Es un **refactor puro**: cero cambios de UI, copy, rutas, esquema SQL, server actions observables, pesos o resultados del score ni respuestas del MCP.

## Alcance

**Entra:**

### 1. Procedimiento por feature

El mismo de SPEC 55a, en este orden:

1. **Tests de caracterización** de sus módulos puros, antes de tocar nada.
2. **Anatomía** de `docs/arquitectura.md`.
3. **Actions delgadas:** validar → `requireWritableWorkspace` → servicio → revalidar.
4. **Partir los archivos de más de 400 líneas** con la regla de SPEC 55a §2: componentes en hermanos con prefijo del padre más hook `use-<padre>.ts`; `queries`, `service`, `actions` y `schemas` por entidad o caso de uso.
5. **Quitar duplicados** (ver §3).
6. **JSDoc** en español en los exports de servicios, queries y módulos puros.
7. **`code-simplifier`** sobre la carpeta, con la guía como contexto y la orden de no cambiar comportamiento; luego `/simplify` sobre el diff.

### 2. Cómo se parte `debts`

`debts` maneja tres entidades: la deuda, sus movimientos (entries: pagos, abonos, cargos, ajustes) y las cuentas por cobrar. Los archivos de servidor se parten por esas entidades:

- `actions.ts` → `debt-actions.ts`, `entry-actions.ts` y `receivable-actions.ts`.
- `schemas.ts` → `debt-schemas.ts`, `entry-schemas.ts` y `receivable-schemas.ts`.
- `entry-service.ts` → un servicio por grupo de tipos de entry (por ejemplo `entry-payment-service.ts` y `entry-adjustment-service.ts`), según los tipos de `entry-types.ts`.
- `calculations.ts` → se queda con el cálculo de saldo y estado; lo de ciclos de tarjeta y próxima cuota pasa a módulos hermanos con su test.

Los componentes de más de 400 líneas se parten con la regla general. `payment-dialog.tsx`, `debt-entry-dialog.tsx` y `receivable-collect-form.tsx` sacan su lógica de prellenado y validación a módulos puros con test.

### 3. Duplicados y piezas compartidas

- **`ToneBadge`** de `debt-indicators.tsx` se borra; sus usos pasan al de `src/components/dashboard/feedback/tone-badge.tsx`. Si los tipos de tono difieren, el compartido acepta la unión (los tonos salen de `tone.ts`).
- **`AdjustBalanceDialog` de deudas** → `AdjustDebtBalanceDialog` en `debts/components/adjust-debt-balance-dialog.tsx`.
- **`useActionToast`** (SPEC 55a) en `use-debt-action.ts`, `use-goal-action.ts`, `use-recurring-expense-actions.ts` y `use-recurring-income-actions.ts`, con los mismos mensajes.
- **Score y score de Empresa:** `business-score` ya importa de `score` (`INSUFFICIENT_REASONS`, ventanas de meses). Se mantiene así: `score` es la feature dueña. Los helpers privados con el mismo nombre (`sumOf`, `included`, `excluded`) se quedan en cada archivo porque están tipados por dominio. Si al partir `recommendations.ts` aparece lógica idéntica en ambas, pasa a un módulo de `score` que `business-score` importa.
- Helpers genéricos (fechas, montos) que aparezcan dentro del área pasan a `src/libs/` con su test.

### 4. Tests de caracterización

- `debts`: `calculations.test.ts`, `installments.test.ts`, `receivable-schedule.test.ts`, `receivable-collect.test.ts`, `payment-description.test.ts` y `entry-types.test.ts`.
- `recurring-expenses`: `occurrences.test.ts`, `month.test.ts` y `payment.test.ts`.
- `recurring-incomes`: `occurrences.test.ts`, `month-rows.test.ts` y `receipt.test.ts`.
- `goals`: `progress.test.ts`.
- `score`: `calculations.test.ts`, `curves.test.ts` y `recommendations.test.ts`.
- `business-score`: `calculations.test.ts` y `recommendations.test.ts`.
- Un test por cada módulo puro nuevo que salga al partir archivos.

Los tests del score fijan el resultado de `computeScore`, `scoreHistory`, `computeBusinessScore` y `businessScoreHistory` con entradas de ejemplo, factor por factor.

### 5. Verificación

- `/impeccable audit` de Deudas (con cuentas por cobrar), Gastos fijos, Ingresos recurrentes, Metas, Score/Recomendaciones de Personal y Recomendaciones de Empresa, en claro y oscuro, solo para confirmar que nada visible cambió.
- `/code-review high` del diff completo antes del PR; se corrigen sus hallazgos.

### 6. Documentación

- `CLAUDE.md` y `docs/mcp.md`: rutas nuevas de `debts/entry-service.ts` (si se parte), `goals/contribution-service.ts`, `recurring-expenses/payment.ts` y `recurring-incomes/receipt.ts` si cambian.
- `docs/producto.md`: sin cambios (el score no cambia).
- `CHANGELOG.md`: entrada en `[Unreleased]` (Changed).

**Fuera de alcance (para otros specs):**

- `imports`, `exports`, `mcp`, `reports`, `tutorials`, `account`, `auth`, `landing` y `legal` (SPEC 55c). `shortMonth` de `exports/pdf/charts/svg.ts` se renombra allí; el de `debts/receivable-collect.ts` se queda con su nombre.
- Cambiar factores, pesos o textos del score y las recomendaciones.
- Cambios de UI, copy, rutas, esquema SQL o respuestas del MCP.
- Subir de versión.

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones, ni estructuras nuevas. Reusa `useActionToast` de SPEC 55a.

Las firmas públicas que usa el MCP no cambian: las de `debts/entry-service.ts`, `goals/contribution-service.ts`, `recurring-expenses/payment.ts`, `incomeReceiptValues` de `recurring-incomes/receipt.ts` y las de `score` y `business-score` que leen las tools `get_score` y `get_recommendations`. Si un archivo se parte, cada función conserva nombre, parámetros y retorno.

## Plan de implementación

Cada paso deja `check`, `eslint`, `prettier:check`, `test` y `build` en verde, y cierra con `/simplify` sobre su diff.

1. Tests de caracterización de §4 para `score` y `business-score`.
2. Score: partir `score/recommendations.ts` y `business-score/recommendations.ts`; JSDoc; `code-simplifier`.
3. Tests de caracterización de `goals`; `use-goal-action.ts` con `useActionToast`; procedimiento de §1.
4. Tests de caracterización de `recurring-expenses`; `useActionToast`; partir `recurring-expense-sheet.tsx`; procedimiento de §1.
5. Tests de caracterización de `recurring-incomes`; `useActionToast`; partir `queries.ts`, `recurring-income-dialog.tsx` y `recurring-income-sheet.tsx`; procedimiento de §1.
6. Tests de caracterización de `debts`.
7. Deudas / servidor: partir `schemas.ts`, `actions.ts` y `entry-service.ts` (§2); actions delgadas; JSDoc.
8. Deudas / `calculations.ts` partido en módulos con test.
9. Deudas / duplicados: `ToneBadge` compartido, `AdjustDebtBalanceDialog`, `use-debt-action.ts` con `useActionToast`.
10. Deudas / `payment-dialog.tsx`, `debt-entry-dialog.tsx` y `receivable-collect-form.tsx` partidos, con prellenados en módulos puros.
11. Deudas / `debt-sheet.tsx`, `receivable-dialog.tsx`, `debt-dialog.tsx`, `debt-entries-list.tsx` y `debt-card.tsx` partidos.
12. Deudas: `code-simplifier` sobre `src/features/debts/`.
13. `/impeccable audit` de las pantallas de §5.
14. Documentación de §6.
15. `/code-review high` del diff completo y corrección de hallazgos.

## Criterios de aceptación

Verificables en código o con los scripts:

- [x] `pnpm eslint src/features/{debts,recurring-expenses,recurring-incomes,goals,score,business-score}` no da warnings de `max-lines`.
- [x] Existen los tests de §4 y `pnpm test` pasa.
- [x] Los tests del score dan el mismo puntaje y los mismos factores que antes del refactor para cada entrada de ejemplo.
- [x] `grep -rn "export function ToneBadge" src` devuelve solo `src/components/dashboard/feedback/tone-badge.tsx`.
- [x] `grep -rn "export function AdjustBalanceDialog" src` no devuelve resultados; existen `AdjustAccountBalanceDialog` y `AdjustDebtBalanceDialog`.
- [x] `use-debt-action.ts`, `use-goal-action.ts`, `use-recurring-expense-actions.ts` y `use-recurring-income-actions.ts` usan `useActionToast` y no importan `useTransition`.
- [x] No existen `src/features/debts/actions.ts` ni `src/features/debts/schemas.ts` como archivos únicos; existen sus partes por entidad.
- [x] Ninguna action del área hace consultas a Supabase directamente.
- [x] Todo export de servicios, queries y módulos puros del área tiene JSDoc.
- [x] `git diff` de `src/features/mcp/tools/**` solo cambia rutas de import.
- [x] `git diff` no toca `supabase/migrations/`, `src/types/database.ts`, `docs/producto.md` ni textos visibles del área.
- [x] `CLAUDE.md` y `docs/mcp.md` no citan rutas que ya no existen.
- [x] `CHANGELOG.md` tiene la entrada en `[Unreleased]`.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.
- [x] `/code-review high` no deja hallazgos abiertos.

Verificables en navegador (los prueba el usuario a mano):

- [ ] Crear, editar, archivar y reordenar una deuda y una tarjeta funciona igual; saldo, próxima cuota y utilización salen iguales.
- [ ] Registrar cada tipo de entry de deuda (pago, abono, cargo, ajuste, avance), editarlo, duplicarlo y convertir un ajuste en pago funciona igual, con la misma descripción prellenada.
- [ ] Una cuenta por cobrar registra cobros parciales y de varios meses igual que antes.
- [ ] Gastos fijos e ingresos recurrentes muestran el mismo historial por mes y registran pagos y cobros con los mismos prellenados.
- [ ] Metas: crear, aportar, cumplir, archivar y reactivar funciona igual, con los mismos toasts.
- [ ] El score de Personal y el de Empresa dan el mismo número, factores y recomendaciones que en `master` con los mismos datos.
- [ ] Un agente por MCP registra un pago de deuda, un aporte a meta y un pago de gasto fijo igual que antes, y `undo_mcp_operation` los revierte.
- [ ] `/impeccable audit` de las pantallas de §5 no muestra diferencias visibles respecto de `master`.

## Decisiones

- **Sí:** tests del score primero (paso 1). Es el cálculo con más ramas y el que el usuario nota si cambia un punto.
- **Sí:** `debts` al final del spec. Es lo más grande; para entonces el patrón ya se probó en las features chicas.
- **Sí:** partir `debts` por entidad (deuda, entry, cuenta por cobrar). **No:** por capa técnica dentro de subcarpetas; las tres entidades son la forma en que el producto lo explica.
- **Sí:** `score` es la dueña de lo compartido con `business-score`. **No:** carpeta común de scores; la guía no permite `shared/`.
- **Sí:** helpers privados homónimos (`sumOf`, `included`, `excluded`) se quedan en cada score. Están tipados por dominio y no se exportan.
- **Sí:** `ToneBadge` único en `components/dashboard/feedback/`. **No:** mantener la copia de deudas; es la misma pieza.
- **Sí:** renombrar el `AdjustBalanceDialog` de deudas. **No:** unificarlo con el de cuentas; campos y action distintos.
- **No:** cambiar factores, pesos o textos del score aunque se vean mejoras; sería cambio de producto y va a `docs/producto.md` con su spec.
- **Sí:** refactor puro. Los bugs encontrados se anotan para su propio spec.
- **No:** subir de versión; sube al cerrar SPEC 55c.
- **Nota:** este spec se escribió junto con SPEC 54, 55a y 55c, antes de implementar SPEC 54. Las rutas de `components/dashboard/feedback/` y el hook `useActionToast` asumen SPEC 54 y 55a tal como están escritos. Si cambian al implementarse, se ajusta este spec antes de aprobarlo.

## Riesgos

| Riesgo                                                                            | Mitigación                                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Partir `calculations.ts` de deudas cambia el saldo o la próxima cuota             | Tests de caracterización del paso 6 antes de tocar; criterio de navegador con tarjetas y deudas reales. |
| Partir `entry-service.ts` rompe el log de `mcp_operations` o el undo              | Mismas firmas; criterio con un agente que escribe y revierte; `SNAPSHOT_TABLES` no cambia.              |
| Los prellenados de pago dejan de coincidir (descripción, monto pendiente)         | Prellenados en módulos puros con test (`payment-description`, `payment`, `receipt`).                    |
| El `ToneBadge` compartido no acepta los tonos de deudas                           | El compartido acepta la unión de tonos de `tone.ts`; `check` lo detecta.                                |
| Partir `recommendations.ts` cambia el orden de las recomendaciones                | Test que fija la lista completa y su orden para cada entrada de ejemplo.                                |
| `useActionToast` cambia el comportamiento de "Pausar" / "Reanudar" de recurrentes | Cada acción pasa su propio mensaje; criterio de navegador con los toasts.                               |

## Qué no entra en este spec

- `imports`, `exports`, `mcp`, `reports`, `tutorials`, `account`, `auth`, `landing` y `legal` (SPEC 55c).
- Cambios de factores, pesos o textos del score y las recomendaciones.
- Cambios visibles, de datos o de respuestas del MCP.
- Subir de versión.
