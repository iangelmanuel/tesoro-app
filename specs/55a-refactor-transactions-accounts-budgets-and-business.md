# SPEC 55a — Refactor de movimientos, cuentas, categorías, presupuestos y Empresa

> **Estado:** Implementado
> **Depende de:** SPEC 54
> **Fecha:** 2026-11-21
> **Objetivo:** Aplicar las reglas de SPEC 54 a `transactions`, `accounts`, `categories`, `budgets`, `workspaces`, `business` y `cash-flow`, sin cambiar comportamiento.

## Por qué existe este spec

SPEC 54 deja la guía (`docs/arquitectura.md`), las reglas de lint, `server-only`, Vitest y la capa compartida ordenada. Este es el primero de los tres specs que aplican esas reglas a `src/features/`. Va primero porque Movimientos y Cuentas son el núcleo del que dependen las demás áreas: deudas, recurrentes, imports y MCP reusan sus servicios.

Estado de partida del área (~12.500 líneas en 85 archivos):

| Archivo                                                         | Líneas |
| --------------------------------------------------------------- | -----: |
| `src/features/transactions/components/transactions-table.tsx`   |  1.194 |
| `src/features/transactions/components/transaction-dialog.tsx`   |    940 |
| `src/features/transactions/queries.ts`                          |    628 |
| `src/features/transactions/components/transactions-filters.tsx` |    488 |
| `src/features/accounts/actions.ts`                              |    467 |
| `src/features/transactions/actions.ts`                          |    466 |
| `src/features/transactions/service.ts`                          |    460 |

También hay dos patrones repetidos que este spec resuelve:

- Cinco hooks casi iguales (`use-account-action.ts`, `use-debt-action.ts`, `use-goal-action.ts`, `use-recurring-expense-actions.ts`, `use-recurring-income-actions.ts`): `useTransition` + action + toast de error o éxito. Aquí nace el hook genérico y se adopta en Cuentas. SPEC 55b lo adopta en el resto.
- Dos componentes `AdjustBalanceDialog` con distinto propósito (cuentas y deudas). Aquí se renombra el de cuentas.

Es un **refactor puro**: cero cambios de UI, copy, rutas, esquema SQL, server actions observables ni respuestas del MCP.

## Alcance

**Entra:**

### 1. Procedimiento por feature

Para cada feature del área, en este orden:

1. **Tests de caracterización** de sus módulos puros, escritos antes de tocar nada.
2. **Anatomía** de `docs/arquitectura.md`: cada archivo cumple su rol (schemas, types, constants, queries, service, actions, módulos puros, components).
3. **Actions delgadas:** validar → `requireWritableWorkspace` → servicio → revalidar. La lógica de negocio que esté en una action pasa al servicio.
4. **Partir los archivos de más de 400 líneas** (ver §2).
5. **Quitar duplicados** (ver §3).
6. **JSDoc** en español en los exports de `service.ts`, `*-service.ts`, `queries.ts` y módulos puros.
7. **`code-simplifier`** sobre la carpeta de la feature, con la guía como contexto y la orden de no cambiar comportamiento; luego `/simplify` sobre el diff.

### 2. Cómo se parten los archivos grandes

- **Componentes:** subcomponentes en archivos hermanos dentro del mismo `components/`, con el nombre del padre como prefijo (`transactions-table-row.tsx`, `transactions-table-mobile.tsx`). El estado y los efectos pasan a un hook `use-<padre>.ts` en la misma carpeta. La lógica pura pasa a un módulo de la feature con su test.
- **`queries.ts`, `service.ts` y `actions.ts`:** se parten por entidad o caso de uso en archivos hermanos (`transaction-queries.ts`, `summary-queries.ts`; `transfer-actions.ts`), cada uno con `import "server-only"` o `"use server"` según corresponda. Los consumidores importan del archivo nuevo; no hay barrels.

Archivos a partir en esta área:

- `transactions/components/transactions-table.tsx`
- `transactions/components/transaction-dialog.tsx`
- `transactions/components/transactions-filters.tsx`
- `transactions/queries.ts`
- `transactions/service.ts`
- `transactions/actions.ts`
- `accounts/actions.ts`

### 3. Duplicados y piezas compartidas

- **Hook `useActionToast`** nuevo en `src/hooks/use-action-toast.ts` (ver Modelo de datos). `accounts/components/use-account-action.ts` pasa a usarlo, con los mismos mensajes.
- **`AdjustBalanceDialog` de cuentas** → `AdjustAccountBalanceDialog` en `accounts/components/adjust-account-balance-dialog.tsx`.
- **`formatPercent`** de `budgets/progress.ts` pasa a `src/libs/format.ts` (es genérico), con su test. Sus consumidores importan de ahí.
- Cualquier otro helper genérico (fechas, montos, porcentajes) que aparezca dentro del área pasa a `src/libs/` con su test.

### 4. Tests de caracterización

- `src/features/transactions/filters.test.ts`
- `src/features/accounts/negative-balance.test.ts`, `active-account.test.ts` y `payment-account.test.ts`
- `src/features/budgets/progress.test.ts` y `month.test.ts`
- `src/features/workspaces/paths.test.ts`
- Un test por cada módulo puro nuevo que salga al partir archivos.

### 5. Features pequeñas

`categories`, `workspaces`, `business` y `cash-flow` no tienen archivos de más de 400 líneas. Reciben el procedimiento de §1 (anatomía, actions delgadas, JSDoc, `code-simplifier`) sin partir archivos.

### 6. Verificación

- `/impeccable audit` de Movimientos, Cuentas, Categorías (en Ajustes), Presupuestos, Resumen y Flujo de caja de Empresa, en claro y oscuro, solo para confirmar que nada visible cambió. Hallazgos de diseño nuevos se anotan para otro spec.
- `/code-review high` del diff completo antes del PR; se corrigen sus hallazgos.

### 7. Documentación

- `CLAUDE.md` y `docs/mcp.md`: rutas nuevas de los servicios y actions que se partan (por ejemplo, si `transactions/service.ts` se divide).
- `docs/arquitectura.md`: el ejemplo de "flujo de un dato" apunta a los archivos nuevos de Movimientos; `useActionToast` en la sección de hooks.
- `CHANGELOG.md`: entrada en `[Unreleased]` (Changed).

**Fuera de alcance (para otros specs):**

- `debts`, `recurring-expenses`, `recurring-incomes`, `goals`, `score` y `business-score` (SPEC 55b), incluida la adopción de `useActionToast` en sus hooks y el renombre del `AdjustBalanceDialog` de deudas.
- `imports`, `exports`, `mcp`, `reports`, `tutorials`, `account`, `auth`, `landing` y `legal` (SPEC 55c).
- Cambios de UI, copy, rutas, esquema SQL o respuestas del MCP.
- Subir de versión.

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones.

Hook nuevo, genérico para cualquier action que devuelve `{ error }`:

```ts
// src/hooks/use-action-toast.ts
"use client"

/** Corre una server action en una transición y avisa con toast de éxito o error */
export function useActionToast(): {
  pending: boolean
  run: (
    action: () => Promise<{ error?: string | null }>,
    success: string
  ) => void
}
```

Las firmas públicas de los servicios que usa el MCP (`transactions/service.ts`, `accounts/transfer-service.ts`, `categories/service.ts`) no cambian. Si un servicio se parte en varios archivos, cada función conserva nombre, parámetros y retorno.

## Plan de implementación

Cada paso deja `check`, `eslint`, `prettier:check`, `test` y `build` en verde, y cierra con `/simplify` sobre su diff.

1. Tests de caracterización de §4 (salvo los de módulos que aún no existen).
2. `useActionToast` en `src/hooks/` y adopción en `use-account-action.ts`.
3. `formatPercent` a `src/libs/format.ts` con su test; actualizar consumidores.
4. Cuentas: `AdjustAccountBalanceDialog`, partir `accounts/actions.ts`, actions delgadas, JSDoc y `code-simplifier`.
5. Movimientos / servidor: partir `transactions/queries.ts`, `service.ts` y `actions.ts`; actions delgadas; JSDoc.
6. Movimientos / `transactions-filters.tsx` partido.
7. Movimientos / `transaction-dialog.tsx` partido (subcomponentes por tipo de movimiento y hook de estado).
8. Movimientos / `transactions-table.tsx` partido (fila, vista móvil, acciones de fila y hook de estado).
9. Movimientos: `code-simplifier` sobre `src/features/transactions/`.
10. Categorías y presupuestos: procedimiento de §1.
11. `workspaces`, `business` y `cash-flow`: procedimiento de §1.
12. `/impeccable audit` de las pantallas de §6.
13. Documentación de §7.
14. `/code-review high` del diff completo y corrección de hallazgos.

## Criterios de aceptación

Verificables en código o con los scripts:

- [x] `pnpm eslint src/features/{transactions,accounts,categories,budgets,workspaces,business,cash-flow}` no da warnings de `max-lines`.
- [x] Existen los tests de §4 y `pnpm test` pasa.
- [x] Existe `src/hooks/use-action-toast.ts` y `use-account-action.ts` lo usa.
- [x] `grep -rn "export function formatPercent" src` devuelve solo `src/libs/format.ts`.
- [x] `grep -rn "export function AdjustBalanceDialog" src/features/accounts` no devuelve resultados y existe `AdjustAccountBalanceDialog`.
- [x] Ninguna action del área hace consultas a Supabase directamente; llama a un servicio o a una query.
- [x] Todo export de `service.ts`, `*-service.ts`, `queries.ts` (o sus partes) y módulos puros del área tiene JSDoc.
- [x] Las funciones que usa `src/features/mcp/tools/**` conservan nombre, parámetros y retorno (`git diff` de `src/features/mcp/tools/**` solo cambia rutas de import).
- [x] `git diff` no toca `supabase/migrations/`, `src/types/database.ts` ni textos visibles (`grep` de los strings de UI del área antes y después da lo mismo).
- [x] `CLAUDE.md`, `docs/mcp.md` y `docs/arquitectura.md` no citan rutas que ya no existen.
- [x] `CHANGELOG.md` tiene la entrada en `[Unreleased]`.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.
- [x] `/code-review high` no deja hallazgos abiertos.

Verificables en navegador (los prueba el usuario a mano):

- [ ] Crear, editar, duplicar, verificar y borrar un movimiento funciona igual en Personal y Empresa, incluido un traspaso.
- [ ] Los filtros de Movimientos (mes, tipo, cuenta, categoría, búsqueda) y la paginación dan los mismos resultados que en `master`.
- [ ] La tabla de Movimientos se ve igual en escritorio y en móvil, con su menú contextual y sus acciones de fila.
- [ ] Crear, editar, ajustar saldo, conciliar, archivar y reordenar cuentas funciona igual, con los mismos toasts.
- [ ] Categorías y presupuestos se crean, editan y borran igual; la barra de progreso y sus estados no cambian.
- [ ] Resumen, Cuentas, Movimientos y Flujo de caja de Empresa se ven y funcionan igual.
- [ ] Un agente por MCP crea, edita y revierte un movimiento y un traspaso igual que antes.
- [ ] `/impeccable audit` de las pantallas de §6 no muestra diferencias visibles respecto de `master`.

## Decisiones

- **Sí:** Movimientos y Cuentas primero. Son el núcleo que reusan deudas, recurrentes, imports y MCP; ordenar lo de abajo primero evita mover dos veces.
- **Sí:** `useActionToast` nace aquí y se adopta solo en Cuentas. **No:** migrar los otros cuatro hooks en este spec; viven en features de SPEC 55b.
- **Sí:** `useActionToast` en `src/hooks/`. Lo usan cinco features; la guía manda lo genérico entre features a `src/hooks/`.
- **Sí:** partir archivos en hermanos con prefijo del padre. **No:** subcarpetas por componente; para dos o tres archivos suman profundidad sin aclarar nada.
- **Sí:** partir `queries.ts`, `service.ts` y `actions.ts` por entidad o caso de uso. **No:** barrels que los reexporten; la guía los prohíbe.
- **Sí:** renombrar el `AdjustBalanceDialog` de cuentas. **No:** unificarlo con el de deudas; uno ajusta saldo de cuenta y otro saldo de deuda, con campos distintos.
- **Sí:** `formatPercent` a `src/libs/format.ts`. Es formato genérico, no de presupuestos.
  **Nota de implementación:** `src/libs/format.ts` ya exportaba un `formatPercent` distinto (Intl, un decimal, sin espacio: "12,3%"), que usa `StatCard`. Para no cambiar textos, el de presupuestos ("93 %" con espacio duro) se movió como `formatPercentLabel`.
- **Sí:** las firmas de los servicios que usa el MCP no cambian. Son contrato con las tools.
  **Nota de implementación:** al mover la lectura del duplicado a `duplicate-queries.ts`, la action quedó con `return await` dentro del `try`. Antes, un fallo al leer los ingresos fijos escapaba del `catch`; ahora responde con "No se pudo preparar el duplicado". El camino feliz no cambia.
- **Sí:** refactor puro, igual que SPEC 54. Los bugs encontrados se anotan para su propio spec.
- **No:** subir de versión; sube al cerrar SPEC 55c.
- **Nota:** este spec se escribió junto con SPEC 54 y 55b/c, antes de implementar SPEC 54. Las rutas de `src/components/dashboard/*` y `src/features/workspaces/*` asumen la reorganización de SPEC 54. Si SPEC 54 cambia al implementarse, se ajusta este spec antes de aprobarlo.

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Partir `transactions-table.tsx` cambia el orden de render o rompe el menú contextual | Hook de estado extraído sin cambiar efectos; criterio de navegador con tabla, menú y móvil. |
| Partir `transaction-dialog.tsx` rompe los prellenados (pagos, recurrentes, duplicar) | Los prellenados viven en módulos puros con test; criterio de duplicar y de traspaso.        |
| Un servicio partido cambia su firma y rompe una tool del MCP                         | Criterio sobre `git diff` de `mcp/tools/**`; `check` en cada paso; prueba con un agente.    |
| `useActionToast` cambia el texto o el momento del toast                              | Mismos mensajes pasados como `success`; el error sigue siendo `result.error`.               |
| Filtros de Movimientos dan resultados distintos al mover la consulta                 | `filters.test.ts` antes de tocar; comparación manual con `master`.                          |
| `CLAUDE.md` queda con rutas viejas de servicios                                      | Criterio específico; búsqueda de cada ruta movida en `*.md`.                                |

## Bugs previos encontrados (para otro spec)

`/code-review high` encontró tres bugs que ya estaban en `master`. Por ser un refactor puro no se corrigen aquí:

- **`useActionToast` sin `catch`:** si la action lanza en vez de devolver `{ error }` (por ejemplo, `requireWritableWorkspace` con una empresa marcada para borrarse), no sale toast y el error llega al error boundary. Pasaba igual en los hooks por feature; conviene resolverlo antes de que SPEC 55b lo adopte en todas partes.
- **Editar una empresa no es atómico:** `updateBusinessRecord` actualiza `business_profiles` y luego `workspaces.name` en dos escrituras. Si falla la segunda, NIT y sector quedan guardados y el formulario muestra error. Va en una RPC con transacción.
- **Cuadrar saldo puede quedar en "Calculando...":** el efecto de `reconcile-dialog.tsx` no tiene `.catch` para `getReconcileBalanceAction`; si la action falla, el saldo calculado nunca se resuelve.

## Qué no entra en este spec

- `debts`, `recurring-expenses`, `recurring-incomes`, `goals`, `score` y `business-score` (SPEC 55b).
- `imports`, `exports`, `mcp`, `reports`, `tutorials`, `account`, `auth`, `landing` y `legal` (SPEC 55c).
- Cambios visibles, de datos o de respuestas del MCP.
- Subir de versión.
