# SPEC 43 — MCP: extractos bancarios, pagos y análisis

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06, SPEC 07, SPEC 21, SPEC 34, SPEC 38, SPEC 39, SPEC 41, SPEC 42
> **Fecha:** 2026-11-17
> **Objetivo:** Que un agente de IA conectado por MCP pueda poner al día las cuentas desde un extracto bancario, registrar pagos de deudas, gastos fijos, ingresos fijos y metas, analizar el dinero del usuario y pedirle cualquier dato que falte antes de escribir.

## Por qué existe este spec

El MCP de SPEC 34 solo escribe movimientos, traspasos y categorías. Para poner al día un mes desde el extracto, el agente tiene que partir el extracto en lotes de 200, no sabe cuáles ya están registrados y no puede marcar como pagado un gasto fijo, una cuota de deuda o un cobro de Me deben. Cuando falta un dato (cuenta, categoría), la tool falla con un error genérico y el agente adivina.

Es el tercero de cuatro specs del mismo pedido (SPEC 41 a 44). Crear y editar entidades va en SPEC 44.

## Alcance

**Entra:**

- **Respuesta guiada de datos faltantes** (`needs_input`), común a todas las tools de escritura:
  - si falta un dato obligatorio o es ambiguo, la tool **no escribe** y responde `status: "needs_input"` con la lista de campos;
  - cada campo trae `field`, `row` (índice, si aplica), `question` en español y `options` (por ejemplo, cuentas o categorías activas con su id);
  - las descripciones de las tools instruyen al agente: "si recibes needs_input, pregunta al usuario y vuelve a llamar con los datos".
  - Ambiguo: un nombre de cuenta o categoría que coincide con varias.
- **Extractos bancarios** — tool `import_statement`:
  - entrada: `workspace_id`, `account_id`, `rows` (hasta **400**: fecha, hora opcional, descripción, monto con signo o tipo, categoría opcional, nota opcional, cuenta destino opcional para traspasos), `dry_run` (por defecto `true`), `statement_balance` y `statement_end_date` opcionales, `include_rows` opcional;
  - `dry_run: true` devuelve, sin escribir:
    - filas listas para crear;
    - **duplicados probables**: misma cuenta, mismo tipo, mismo monto y fecha a ±2 días contra movimientos existentes o contra otra fila del mismo extracto; se omiten por defecto;
    - filas con datos faltantes (`needs_input`);
    - **categoría sugerida** por fila: la del movimiento más reciente (últimos 180 días) con la misma descripción normalizada;
    - si llega `statement_balance`: saldo de la cuenta a `statement_end_date` antes y después de importar, y la diferencia contra el extracto.
  - `dry_run: false` crea todo en **una sola operación** revertible con `undo_operation`. Duplicados solo si su índice va en `include_rows`.
  - Respeta el rate limit de SPEC 34.
- **Pagos de deuda** — tools nuevas, con los servicios de `debts/entry-service.ts`:
  - `record_debt_payment`: pago o abono extra a tarjeta o préstamo, con cuenta de origen, fecha (por defecto hoy, SPEC 41), descripción de SPEC 41 y nota;
  - `collect_receivable`: cobro de Me deben, único o mensual, con el reparto de SPEC 39 (una cuota o varios meses);
  - `update_debt_entry` y `delete_debt_entry`: mismos campos y reglas que SPEC 42;
  - sin cuenta y sin cuenta habitual en la deuda: `needs_input` con las cuentas activas.
- **Gastos e ingresos fijos**:
  - `pay_recurring_expense`: paga una ocurrencia (por defecto la más antigua sin pagar), fecha de hoy y cuenta habitual de SPEC 41;
  - `receive_recurring_income`: recibe un ingreso fijo con el reparto de SPEC 38.
- **Metas** — `record_goal_contribution`: aporte o retiro (`direction: "in" | "out"`) con cuenta opcional.
- **Análisis (lectura)**:
  - `get_account_balance`: saldo de una cuenta a una fecha (`account_balance_at`) y, con `expected_balance`, la diferencia para conciliar (SPEC 21);
  - `get_spending_breakdown`: totales por categoría y por contraparte en un rango, con comparación al periodo anterior del mismo largo (`category_totals`, `counterparty_totals`);
  - `list_upcoming_payments`: gastos fijos, cuotas de deuda, cobros de Me deben e ingresos esperados en los próximos N días (por defecto 30), con lo **vencido** aparte;
  - `get_recommendations`: recomendaciones activas y el desglose del score por factor (`score/recommendations.ts`).
- **Log y revertir**: todas las escrituras nuevas dejan filas en `mcp_operation_rows` y se pueden revertir con `undo_operation` (ventana de 30 días).
- **Catálogo y docs**: cada tool en `src/features/mcp/tools/` y en `catalog.ts`; la página `/mcp` las lista; `docs/mcp.md` con ejemplos (extracto, pagar deuda, needs_input); `CHANGELOG.md` en `[Unreleased]` (en inglés).
- Las conexiones de **solo lectura** no ven las tools de escritura nuevas (igual que hoy).

**Fuera de alcance (para otros specs):**

- Crear o editar cuentas, deudas, gastos fijos, ingresos fijos, metas y presupuestos (SPEC 44).
- Leer archivos PDF o imágenes del extracto en el servidor: el agente los lee y envía filas.
- Elicitation de MCP (`elicitation/create`).
- Prompts MCP predefinidos.
- Conciliación automática que crea ajustes de cuenta.
- Empresa: las tools de Personal que no apliquen responden error claro; Empresa usa `import_statement`, análisis y movimientos.

## Modelo de datos

No hay tablas nuevas.

Migración `supabase/migrations/<timestamp>_mcp_more_operation_tables.sql`: amplía el `check` de `mcp_operation_rows.table_name` con las tablas que falten entre `debt_entry_allocations` y `recurring_income_allocations`, y ajusta la función de revertir para restaurarlas.

Constante en `SITE.mcp`:

```ts
statementLimit: 400 // filas por import_statement (igual al tope de row_count)
```

Tipos compartidos en `src/features/mcp/tools/shared.ts`:

```ts
type MissingField = {
  field: string
  row?: number
  question: string
  options?: { id: string; label: string }[]
}

type NeedsInput = { status: "needs_input"; missing: MissingField[] }

type StatementPreview = {
  status: "preview"
  ready: number[]
  duplicates: { row: number; matches: string[] }[] // ids existentes o "row:N"
  needsInput: MissingField[]
  suggestions: { row: number; category_id: string }[]
  reconciliation?: {
    before: number
    after: number
    statement: number
    difference: number
  }
}
```

## Plan de implementación

1. **`needs_input`.** Tipos y helper en `shared.ts`; adoptarlo en `create_transactions` y `create_transfers`. Probar con un cliente MCP local (`docs/mcp.md#probar-en-local`).
2. **Migración del log.** Ampliar `table_name` y revertir. `supabase db reset`, regenerar tipos.
3. **`import_statement` en dry run.** Validación, duplicados, sugerencias y conciliación, sin escribir.
4. **`import_statement` real.** Una operación con hasta 400 filas, `include_rows` y undo.
5. **Pagos de deuda.** `record_debt_payment`, `collect_receivable`, `update_debt_entry`, `delete_debt_entry` sobre los servicios de SPEC 39 y 42.
6. **Gastos e ingresos fijos.** `pay_recurring_expense` y `receive_recurring_income`, extrayendo a servicios compartidos lo que hoy vive en las actions.
7. **Metas.** `record_goal_contribution` con servicio compartido.
8. **Análisis.** Las cuatro tools de lectura.
9. **Catálogo, `/mcp`, docs y CHANGELOG.**
10. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] `create_transactions` sin `account_id` y con varias cuentas activas responde `needs_input` con las cuentas como opciones y no crea nada.
- [x] Una categoría por nombre que coincide con dos responde `needs_input` con ambas.
- [x] `import_statement` con `dry_run` no escribe ninguna fila.
- [x] Con un gasto de 45.000 del 10 nov ya registrado, una fila de 45.000 del 11 nov sale como duplicado probable.
- [x] Una fila de 45.000 del 14 nov no sale como duplicado.
- [x] Dos filas iguales dentro del mismo extracto se marcan como duplicadas entre sí.
- [x] Una fila "UBER *TRIP" sugiere la categoría del último movimiento "UBER *TRIP".
- [x] Con `statement_balance`, el dry run devuelve la diferencia entre el saldo de Tesoro y el extracto antes y después de importar.
- [x] Importar 400 filas crea los movimientos en una sola operación; `undo_operation` la revierte completa.
- [x] 401 filas se rechazan con un error que indica el límite.
- [x] `record_debt_payment` crea el pago con fecha de hoy, la cuenta habitual de la deuda y la descripción de SPEC 41.
- [x] `collect_receivable` de 20.000 en una mensual de 5.100 reparte igual que el tab Me deben (SPEC 39).
- [x] `update_debt_entry` cambia la cuenta y se refleja en Movimientos (SPEC 42).
- [x] `pay_recurring_expense` marca pagada la ocurrencia más antigua y crea el gasto.
- [x] `receive_recurring_income` reparte el ingreso como SPEC 38.
- [x] `record_goal_contribution` con `direction: "out"` baja el progreso de la meta.
- [x] Todas las escrituras nuevas aparecen en `list_operations` y se revierten con `undo_operation`.
- [x] `get_account_balance` devuelve el mismo saldo que la pantalla de Cuentas a esa fecha.
- [x] `get_spending_breakdown` devuelve los mismos totales por categoría que Reportes en ese rango.
- [x] `list_upcoming_payments` lista lo vencido aparte de lo próximo.
- [x] `get_recommendations` devuelve las mismas recomendaciones que el dashboard.
- [x] Una conexión de solo lectura no lista las tools de escritura nuevas.
- [x] Ninguna tool usa `service_role`; todo pasa por RLS.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

Revisados contra el código. La prueba contra la base (migración, `undo_operation` y tiempos con 400 filas) queda pendiente de correr con `supabase start`.

## Decisiones

- **Sí:** respuesta guiada `needs_input` (decisión del usuario). Funciona en cualquier cliente MCP y el servidor sigue sin estado.
- **No:** elicitation de MCP. Pocos clientes la soportan y exige estado entre llamadas.
- **Sí:** `import_statement` con dry run por defecto (decisión del usuario). El agente muestra la vista previa antes de escribir.
- **Sí:** 400 filas y duplicado = misma cuenta, tipo y monto a ±2 días (decisión del usuario). 400 es el tope actual de `row_count`.
- **Sí:** duplicados omitidos por defecto. Es más fácil agregar uno omitido que borrar uno duplicado.
- **Sí:** todas las escrituras revertibles (decisión del usuario).
- **Sí:** las tools reusan los servicios de las actions. Una sola regla de negocio para UI y agente.
- **No:** leer PDFs en el servidor. El agente ya lee el archivo; el servidor recibe filas validadas.
- **Sí:** crear y editar entidades en SPEC 44 (decisión del usuario). Este spec ya toca muchas tools.
- **Sí:** de dos filas iguales del mismo extracto se marca solo la segunda (decisión del usuario): por defecto se importa una.
- **Sí:** al importar, una fila sin categoría usa la sugerida (decisión del usuario); sin sugerencia se pregunta.
- **Sí:** `transfer_account_id` es la otra cuenta del traspaso en ambos sentidos (decisión del usuario): destino si el monto sale, origen si entra.
- **Sí:** sin cuenta y con una sola cuenta activa se usa esa; con varias se pregunta.
- **Sí:** `import_statement` inserta en bloque con PostgREST (un insert por tabla) en vez de una RPC nueva.
- **Sí:** `reconciliation` lleva también `end_date` y `difference_before`.

## Riesgos

| Riesgo                                                    | Mitigación                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| 400 filas exceden el tiempo de la función                 | Insert en bloque en una RPC; medir con 400 filas en local.              |
| Falsos positivos de duplicado (dos cafés iguales)         | Se omiten pero se listan; `include_rows` los agrega.                    |
| El agente escribe sin mostrar la vista previa             | `dry_run` por defecto en `true` y descripción que lo exige.             |
| Lógica de pago de gastos e ingresos fijos vive en actions | Paso 6 la extrae a servicios; las actions pasan a usarlos.              |
| Revertir pagos con asignaciones deja cuotas incoherentes  | La función de revertir restaura asignaciones en el mismo orden del log. |

## Qué **no** entra en este spec

- Crear o editar entidades (SPEC 44).
- Elicitation, prompts MCP y lectura de PDFs en el servidor.
- Conciliación que crea ajustes.
- Lo de SPEC 41 y 42.
