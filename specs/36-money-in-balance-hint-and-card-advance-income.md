# SPEC 36 — Entradas de dinero: aviso de saldo y avances como ingreso

> **Estado:** Implementado
> **Depende de:** SPEC 06, SPEC 08c, SPEC 16, SPEC 26
> **Fecha:** 2026-11-13
> **Objetivo:** Que los formularios donde entra dinero a una cuenta muestren el saldo que quedará en vez de "Faltan", y que un avance de tarjeta hacia una cuenta propia cuente como ingreso en el resumen.

## Por qué existe este spec

Es el primero de cinco specs que salen del mismo pedido (SPEC 36 a 40). El 35 sigue reservado para las escrituras MCP que anunció SPEC 34.

Dos fallas en las entradas de dinero:

- `PaymentAccountSection` calcula `paymentShortfall` siempre. En un cobro de **Me deben**, un avance de tarjeta o un retiro de meta, el dinero **entra** a la cuenta, pero si su saldo es menor que el monto aparece "Nequi tiene $ X. Faltan $ Y". `allowTransfer = false` solo oculta el traspaso, no el aviso.
- SPEC 16 decidió que un avance es movimiento de capital: sube la deuda y la cuenta, pero no aparece en el resumen. Para el usuario es dinero nuevo en su cuenta. Este spec revierte esa decisión **solo cuando el avance va a una cuenta registrada**.

## Alcance

**Entra:**

- **Dirección del dinero en `PaymentAccountSection`:** prop nueva `direction: "out" | "in"` (por defecto `"out"`).
  - `"out"`: igual que hoy (aviso "Faltan" y traspaso sugerido).
  - `"in"`: nunca calcula faltante ni muestra traspaso. Bajo el select muestra "Nequi tiene $ X. Quedará en $ Y" en `text-muted`, con `Y = saldo + monto`. Sin monto válido, solo "Saldo de Nequi: $ X".
- **Quién usa `"in"`:**
  - `PaymentDialog` en cuentas por cobrar (cobro, abono, **Marcar pagada**) y en el tab **Avance** de tarjetas;
  - `ContributionDialog` en **Retiro**;
  - `TransactionDialog` en el tab **Ingreso** si en algún caso muestra la sección.
  - Revisar con `grep` todo uso de `PaymentAccountSection` y fijar la dirección explícita en cada uno.
- **Avance de tarjeta como ingreso:**
  - Con cuenta elegida, el avance crea un **ingreso** en `transactions` (cuenta elegida, monto y fecha del avance, categoría de sistema **Avance de tarjeta**, descripción "Avance <nombre de la tarjeta>") enlazado a la entrada `advance` por `debt_entries.transaction_id`.
  - Sin cuenta, el avance solo sube la deuda, como hoy. No crea movimiento.
  - El ingreso suma a resumen, reportes, gráficas, exportes y score, como cualquier ingreso.
  - Editar o eliminar el avance desde la deuda o desde Movimientos sigue las reglas de SPEC 26 (el movimiento enlazado se edita desde la deuda y se sincroniza).
- **Migración de avances existentes:** cada `debt_entries` `advance` con `account_id` crea su ingreso enlazado, pasa la cuenta al movimiento y deja `account_id` en `null` en la entrada.
- **Movimientos:** el avance con cuenta ya no aparece como fila gris `debt_advance` en `ledger_entries`; aparece como ingreso normal con un indicador "Avance de tarjeta" y abre la tarjeta al editar (como los cobros de Me deben).
- **Documentación:** `docs/producto.md` (avances), `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Avances en Empresa (las cuentas son solo de Personal).
- Casilla para elegir si el avance cuenta como ingreso. Con cuenta, siempre cuenta.
- Excluir los avances del score o mostrarlos en una línea aparte del resumen.
- Comisión o interés del avance.
- Cambiar los pagos de tarjeta: siguen siendo movimiento de capital.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_card_advance_as_income.sql`:

```sql
-- Categoría de sistema para el ingreso de un avance
insert into public.categories (workspace_id, type, name, icon, color) values
  (null, 'income', 'Avance de tarjeta', 'credit-card', 'violet');
```

- El ícono y el color se eligen de las claves existentes de `CATEGORY_ICONS` y de los colores de categoría; se confirma en el paso 1 que `credit-card` y `violet` existen, si no se usa el más cercano.
- **`check_debt_entry`** se reemplaza:
  - `advance` de tarjeta admite `transaction_id` (hoy no).
  - `account_id` en la entrada solo en `payment` de tarjeta. En `advance` la cuenta vive en el movimiento, igual que préstamos y cuentas por cobrar.
  - Un movimiento enlazado a un `advance` debe ser `type = 'income'`.
- **`record_card_advance`** se reemplaza (`drop` + `create`, misma firma): con `p_account_id`, crea el ingreso (categoría **Avance de tarjeta**) y la entrada con `transaction_id`, en la misma transacción. Sin cuenta, solo la entrada.
- **`sync_debt_entry_transaction`** ya copia monto, fecha y hora de la entrada al movimiento; se verifica que cubra `advance`.
- **`account_balances`**: la rama `+ Σ advance con account_id` queda sin filas tras la migración (la cuenta pasa al ingreso). Se conserva por si acaso o se elimina; se decide en el paso 2 tras revisar la función.
- **`ledger_entries`**: la rama `debt_advance` solo lista entradas con `account_id`, así que deja de devolver avances.
- **Migración de datos** dentro del mismo archivo, fila por fila con `raise notice` en errores (patrón de `realign_debt_entries_with_transactions.sql`):

```sql
-- Por cada advance con account_id:
--   1. insert en transactions (income, cuenta, monto, fecha, hora, categoría "Avance de tarjeta")
--   2. update debt_entries set transaction_id = <nuevo>, account_id = null
```

- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

```ts
// src/features/accounts/components/payment-account-section.tsx
export type MoneyDirection = "out" | "in"
```

## Plan de implementación

1. **Dirección en la sección de cuenta.** Prop `direction` en `PaymentAccountSection` con el texto "Quedará en". Fijar `"in"` en cobros de Me deben, avance y retiro de meta. Manual: cobrar 100.000 a una cuenta con 20.000 muestra "Quedará en $ 120.000" y ningún "Faltan".
2. **Migración.** Categoría, `check_debt_entry`, `record_card_advance` y migración de avances existentes. Probar con `supabase db reset` y con un avance con cuenta sembrado antes de la migración. Regenerar tipos.
3. **Acciones y servicio.** `debts/entry-service.ts` y la action del avance usan la RPC nueva; editar y eliminar un avance actualiza o borra su ingreso enlazado.
4. **Movimientos.** El ingreso de un avance muestra el indicador y abre la edición desde la tarjeta (SPEC 26). Se quita el caso `debt_advance` de las filas grises si ya no llega ninguno, o se deja para avances sin cuenta si aplica.
5. **MCP.** Revisar `src/features/mcp/tools/read/transaction-row.ts` y las tools de lectura que distinguen `debt_advance`.
6. **Docs y CHANGELOG.**
7. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] Cobrar en Me deben a una cuenta con saldo menor que el cobro muestra "Quedará en $ Y" y no muestra "Faltan".
- [ ] El tab **Avance** de una tarjeta muestra "Quedará en" y no muestra el switch de traspaso.
- [ ] Un retiro de meta a una cuenta muestra "Quedará en".
- [ ] Un pago de tarjeta, préstamo o gasto con saldo insuficiente sigue mostrando "Faltan" y el traspaso.
- [ ] Un avance de 500.000 a Nequi crea un ingreso de 500.000 en Nequi con categoría **Avance de tarjeta**, y el resumen del mes sube sus ingresos en 500.000.
- [ ] El saldo de la tarjeta sube 500.000 y el de Nequi sube 500.000 (no 1.000.000).
- [ ] Un avance **Sin cuenta** sube solo la deuda y no crea movimiento.
- [ ] Editar el monto del avance desde la tarjeta cambia el monto del ingreso enlazado.
- [ ] Eliminar el avance elimina su ingreso y devuelve el saldo de la cuenta.
- [ ] Tras la migración, cada avance antiguo con cuenta tiene su ingreso y los saldos de cuentas no cambian.
- [ ] Movimientos ya no muestra avances como fila gris de capital.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

> **Verificación (2026-11-13):** solo el último criterio se comprobó en ejecución. Los demás se revisaron en el código, pero falta probarlos en la app y con Supabase local: Docker no pudo descargar la imagen de Postgres. Pendiente: `supabase db reset` sin errores (la migración avisa "Avances convertidos en ingreso: N, sin convertir: M"), el seed de un avance antiguo con cuenta para comprobar que los saldos no cambian, y regenerar `src/types/database.ts`, que no debería cambiar porque la firma de la RPC es la misma.

## Decisiones

- **Sí:** prop `direction` en vez de esconder la línea de saldo con `allowTransfer`. Motivo: separa dos ideas distintas (si entra dinero, si se ofrece traspaso).
- **Sí:** en entradas, "Quedará en $ Y" (decisión del usuario). Da contexto sin alarmar.
- **Sí:** avance con cuenta = ingreso real (decisión del usuario). Revierte la decisión de SPEC 16 para avances; los pagos de tarjeta no cambian.
- **Sí:** avance sin cuenta no crea ingreso (decisión del usuario). Si el dinero no entró a una cuenta registrada, no hay dinero nuevo que mostrar.
- **No:** línea aparte "Entradas por crédito" ni excluir del score. Considerado y descartado por el usuario.
- **Sí:** la cuenta del avance pasa al movimiento, como préstamos y cuentas por cobrar. Motivo: una sola fuente para el saldo de la cuenta; evita contar dos veces.
- **Sí:** convertir los avances antiguos con cuenta (decisión del usuario). El historial queda consistente con la regla nueva.
- **Sí:** categoría de sistema **Avance de tarjeta**. Motivo: el usuario puede filtrarla en reportes y distinguirla de su salario.

## Riesgos

| Riesgo                                                             | Mitigación                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Contar el avance dos veces en el saldo de la cuenta                | La migración pone `account_id = null` en la misma fila donde enlaza el movimiento; criterio de saldos. |
| El score sube por plata prestada                                   | Decisión aceptada por el usuario; queda anotada. Si molesta, otro spec puede excluir la categoría.     |
| `check_debt_entry` reemplazado rompe pagos o ajustes existentes    | Probar con `supabase db reset` y datos reales copiados; mismas reglas salvo `advance`.                 |
| Una fila de la migración viola un trigger (cuenta archivada, etc.) | Fila por fila con `raise notice`, sin tumbar la migración; reportar las saltadas.                      |
| Exportes (SPEC 32 y 33) y MCP tratan `debt_advance` como capital   | Paso 5 del plan revisa tools y `exports/queries.ts`.                                                   |

## Qué **no** entra en este spec

- Avances en Empresa.
- Elegir por avance si cuenta como ingreso.
- Línea aparte en el resumen o excluir del score.
- Cambios en pagos de tarjeta.
- Lo de SPEC 37 a 40.
