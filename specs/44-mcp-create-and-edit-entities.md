# SPEC 44 — MCP: crear y editar cuentas, deudas, fijos, metas y presupuestos

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06, SPEC 08c, SPEC 21, SPEC 34, SPEC 38, SPEC 41, SPEC 43
> **Fecha:** 2026-11-17
> **Objetivo:** Que un agente de IA conectado por MCP pueda crear y editar cuentas, deudas, cuentas por cobrar, gastos fijos, ingresos fijos, metas y presupuestos con las mismas reglas de la UI, pidiendo los datos que falten y dejando cada cambio revertible.

## Por qué existe este spec

Con SPEC 43 el agente registra pagos y extractos, pero solo sobre lo que ya existe. Si el extracto trae una cuenta nueva, una suscripción que no está como gasto fijo o un préstamo que no está en Deudas, el usuario tiene que salir a la app a crearlo.

Es el cuarto de cuatro specs del mismo pedido (SPEC 41 a 44).

## Alcance

**Entra:**

- **Tools de escritura**, una por entidad y acción, en `src/features/mcp/tools/write/`:
  - `create_account` / `update_account`: nombre, tipo, saldo inicial y su fecha (SPEC 21), moneda;
  - `create_debt` / `update_debt`: tarjeta o préstamo con los campos de `debt-dialog.tsx` (cupo, corte, pago, tasa, cuota, plazo, cuota de manejo) y cuenta habitual (SPEC 41);
  - `create_receivable` / `update_receivable`: Me deben, único o mensual (SPEC 28);
  - `create_recurring_expense` / `update_recurring_expense`: con frecuencia, día, categoría y cuenta habitual;
  - `create_recurring_income` / `update_recurring_income`: con frecuencias de SPEC 38 y cuenta;
  - `create_goal` / `update_goal`: nombre, monto objetivo y fecha;
  - `set_budget`: crea o cambia el presupuesto de una categoría para un mes.
- **Mismas reglas que la UI**: cada tool valida con el schema Zod de su feature (`<feature>/schemas.ts`) y escribe con un servicio compartido con las actions. Si hoy la lógica vive solo en la action, se extrae a `<feature>/service.ts`.
- **`needs_input`** (SPEC 43) cuando falta un campo obligatorio, un valor no es válido para el tipo (por ejemplo, `closing_day` en un préstamo) o un nombre coincide con varias categorías.
- **Duplicados de nombre**: crear una entidad con el mismo nombre (sin mayúsculas ni tildes) que otra activa del mismo tipo responde `needs_input` preguntando si se crea igual (`confirm_duplicate: true`).
- **Editar** solo cambia los campos enviados; los omitidos quedan igual.
- **Revertir**: cada create y update deja filas en `mcp_operation_rows` y se revierte con `undo_operation`.
  - Revertir un create borra la entidad.
  - Si la entidad ya tiene movimientos, pagos o aportes, revertir falla con un mensaje claro y no borra nada.
- **Empresa**: solo `create_account` / `update_account`, `set_budget` y lo que exista en Empresa hoy. Las demás responden error claro.
- **Catálogo y docs**: `catalog.ts`, página `/mcp`, `docs/mcp.md` con ejemplos; `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Borrar o archivar entidades desde el MCP.
- Crear o editar espacios (Empresa) y el perfil.
- Cambiar la moneda de una cuenta con movimientos.
- Convertir una cuenta por cobrar de única a mensual o al revés (ya fuera en SPEC 39).
- Crear categorías (ya existe `create_category`).

## Modelo de datos

No hay tablas nuevas.

Migración `supabase/migrations/<timestamp>_mcp_entity_operation_tables.sql`:

- amplía el `check` de `mcp_operation_rows.table_name` con `accounts`, `debts`, `recurring_expenses`, `recurring_incomes`, `savings_goals` y `budgets`;
- ajusta la función de revertir: un create revertido se borra solo si no hay filas que lo referencien; si las hay, la operación queda `failed` con el motivo.

Servicios nuevos o extraídos (según lo que ya exista):

```text
src/features/accounts/service.ts
src/features/debts/service.ts
src/features/recurring-expenses/service.ts
src/features/recurring-incomes/service.ts
src/features/goals/service.ts
src/features/budgets/service.ts
```

Cada uno expone `create<Entidad>(supabase, workspace, input)` y `update<Entidad>(supabase, entity, patch)`, que devuelven `ServiceResult` con `before` y `after` para el log.

## Plan de implementación

1. **Migración del log y revertir.** `supabase db reset`, regenerar tipos.
2. **Cuentas.** Servicio, `create_account`, `update_account`; la action de la UI usa el servicio.
3. **Deudas y Me deben.** Servicio y las cuatro tools; validación por tipo.
4. **Gastos fijos.** Servicio y tools.
5. **Ingresos fijos.** Servicio y tools.
6. **Metas y presupuestos.** Servicios y tools.
7. **Duplicados de nombre** y `needs_input` en todas.
8. **Catálogo, `/mcp`, docs y CHANGELOG.**
9. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] `create_account` con saldo inicial 500.000 al 1 nov crea la cuenta y su saldo en Cuentas es 500.000 a esa fecha.
- [ ] `create_debt` de tarjeta sin `closing_day` responde `needs_input` y no crea nada.
- [ ] `create_debt` de préstamo con `closing_day` responde `needs_input` indicando que no aplica.
- [ ] `create_recurring_expense` "Netflix" mensual el día 5 aparece en Gastos fijos con su próxima ocurrencia.
- [ ] Crear "netflix" con otro "Netflix" activo pide confirmación; con `confirm_duplicate: true` lo crea.
- [ ] `update_goal` con solo `target_amount` cambia el objetivo y deja nombre y fecha igual.
- [ ] `set_budget` para Mercado en noviembre crea el presupuesto; llamarlo otra vez lo cambia sin duplicar.
- [ ] `create_recurring_income` quincenal genera ocurrencias como en la UI (SPEC 38).
- [ ] Toda creación y edición aparece en `list_operations`.
- [ ] Revertir la creación de una cuenta sin movimientos la borra.
- [ ] Revertir la creación de una cuenta con movimientos falla con mensaje y no borra nada.
- [ ] Revertir una edición restaura los valores anteriores.
- [ ] En Empresa, `create_goal` responde error claro.
- [ ] Una conexión de solo lectura no lista estas tools.
- [ ] Ninguna tool usa `service_role`; todo pasa por RLS.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** crear y editar entidades en su propio spec (decisión del usuario).
- **Sí:** todo revertible (decisión del usuario).
- **Sí:** una tool por entidad y acción. Schemas claros para el agente y `needs_input` preciso.
- **No:** una tool genérica `upsert_entity`. El schema sería una unión enorme y el agente se equivoca más.
- **Sí:** servicios compartidos con las actions. Una sola validación para UI y agente.
- **Sí:** confirmar duplicados de nombre. Un agente que reintenta puede crear dos veces la misma cuenta.
- **No:** borrar o archivar desde el MCP. No se pidió y es lo más destructivo.
- **Sí:** revertir un create falla si ya tiene datos. Borrar en cascada desde un undo es peligroso.

## Riesgos

| Riesgo                                                | Mitigación                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Extraer servicios de las actions rompe la UI          | Un paso por entidad; la action pasa a usar el servicio en el mismo paso.  |
| Revertir un update de una deuda con pagos posteriores | Solo se restauran los campos de la entidad; los pagos no se tocan.        |
| Muchas tools nuevas confunden al agente               | Descripciones cortas con cuándo usar cada una; `/mcp` agrupa por entidad. |
| Validaciones que hoy viven solo en el cliente         | Pasan al schema del servidor en el paso de cada entidad.                  |

## Qué **no** entra en este spec

- Borrar o archivar entidades.
- Espacios y perfil.
- Cambiar moneda con movimientos y convertir el tipo de una cuenta por cobrar.
- Lo de SPEC 41, 42 y 43.
