# SPEC 42 — Editar movimientos de deuda y convertir ajustes en pagos

> **Estado:** Implementado (la migración de la parte 3 se aplica con `supabase db push`)
> **Depende de:** SPEC 06, SPEC 08b, SPEC 16, SPEC 17, SPEC 23, SPEC 26, SPEC 29, SPEC 30, SPEC 36, SPEC 37, SPEC 38, SPEC 39, SPEC 41
> **Fecha:** 2026-11-17 (reabierto el mismo día: ver "Parte 2")
> **Objetivo:** Que cualquier movimiento de una deuda (pago, abono, compra o avance, cuota de manejo y ajuste) y cualquier pago registrado de un gasto o ingreso fijo se pueda editar por completo, sin eliminarlo y volverlo a crear, desde su Sheet y desde Movimientos, reflejando todo en el saldo de la deuda y de la cuenta.

> **Reapertura.** La parte 1 (hasta "Qué no entra en este spec") está implementada y verificada en la rama. La parte 2 amplía el alcance a pedido del usuario: compras y avances con cuotas que cambian el pago del mes, ajustes positivos convertibles, ajustes editables por monto y pagos de gastos e ingresos fijos editables desde su Sheet.

## Por qué existe este spec

En el Sheet de una deuda, varios pagos reales aparecen como **Ajuste**. Nacieron de **Actualizar saldo** o de importar (SPEC 08b): bajan el saldo de la deuda pero no salen de ninguna cuenta ni tienen movimiento. Al pulsar **Editar** se abre **Actualizar saldo**, no el pago, así que no hay forma de decir "esto fue un pago desde Nequi".

Además, editar un pago enlazado solo permite cambiar monto, fecha y hora. La cuenta, la descripción, la categoría y el abono extra quedan fijos.

Es el segundo de cuatro specs del mismo pedido (SPEC 41 a 44).

## Alcance

**Entra:**

- **Edición completa de un pago o abono** desde `DebtEntriesList` (`PaymentDialog` en modo edición):
  - monto, fecha y hora (ya existen);
  - **cuenta** de origen (pago) o destino (abono de Me deben, avance);
  - **descripción** y **nota**;
  - **categoría** del movimiento enlazado (solo si tiene movimiento);
  - **abono extra a capital** (`is_extra_payment`) en préstamos y tarjetas.
  - Todo se refleja en el movimiento enlazado y en el saldo de la cuenta. Los cambios de cuota en Me deben mensual reparten de nuevo como en SPEC 39.
- **Convertir un ajuste en pago**, solo para ajustes que **bajaron** el saldo (`amount < 0`) en deudas activas:
  - el diálogo de edición de un ajuste negativo muestra un selector **Ajuste | Pago** (en Me deben: **Ajuste | Cobro**);
  - con **Pago**: monto (positivo, prellenado con el ajuste), fecha (la del ajuste), cuenta, descripción y nota;
  - **Movimiento ya registrado**: lista de candidatos sin enlazar del mismo espacio, con el mismo monto y fecha a ±7 días:
    - gastos para tarjetas y préstamos, ingresos para Me deben;
    - cada candidato muestra fecha, descripción, cuenta y monto;
    - opción final **Crear movimiento nuevo**;
    - elegir un candidato adopta su cuenta, fecha y descripción.
  - Al guardar, en una sola transacción:
    - el ajuste pasa a `kind = 'payment'` con `amount` positivo;
    - **préstamo o Me deben**: se enlaza al movimiento elegido (`transaction_id`) o se crea uno nuevo con la descripción de SPEC 41;
    - **tarjeta de crédito** (el pago vive en `debt_entries.account_id`, sin movimiento): se guarda la cuenta en el abono; si se eligió un gasto suelto, ese gasto **se borra** para no contar dos veces la salida;
    - en Me deben mensual, el abono se reparte con `allocate_debt_entry`.
  - El saldo de la deuda no cambia (el ajuste ya lo había bajado). El saldo de la cuenta sí baja (o sube en Me deben).
- **Ajustes positivos** (subieron el saldo): siguen abriendo **Actualizar saldo**, sin opción de convertir.
- **Movimientos** (SPEC 26): editar un pago enlazado desde Movimientos usa el mismo servicio y acepta los mismos campos.
- **Etiquetas**: el ícono de enlace y el texto "Fuera de cuentas" se actualizan al convertir.
- Ocultar cifras, móvil a 390 px y AA en claro y oscuro.
- **Documentación:** `docs/producto.md` (editar y convertir), `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Convertir en lote varios ajustes a la vez.
- Buscador libre de movimientos para enlazar.
- Convertir un pago en ajuste (el camino inverso).
- Enlazar un pago existente a otro movimiento distinto del suyo.
- Convertir avances o cuotas de manejo (pasa a la parte 2).
- Pagos de deuda desde el MCP (SPEC 43).

## Modelo de datos

No hay tablas ni columnas nuevas. Usa `debt_entries`, `transactions` y `debt_entry_allocations` (SPEC 39).

RPC nueva en `supabase/migrations/<timestamp>_convert_debt_adjustment.sql`:

```sql
convert_debt_adjustment(
  p_entry_id uuid,
  p_account_id uuid,          -- obligatoria
  p_occurred_on date,
  p_occurred_time time,       -- null permitido
  p_description text,
  p_note text,
  p_category_id uuid,         -- null permitido (préstamo / Me deben)
  p_link_transaction_id uuid  -- null = crear movimiento nuevo
) returns uuid  -- id del abono
```

- `security invoker`; todo pasa por RLS y `is_workspace_writable`.
- `for update` sobre la deuda y el abono.
- Valida: abono de tipo `adjustment` con `amount < 0`; deuda activa; movimiento candidato del mismo espacio, sin enlazar, del tipo correcto y mismo monto.
- Los triggers existentes (`check_debt_entry`, `sync_debt_entry_transaction`, `check_debt_balance`) siguen siendo la red.

Cambio en `src/features/debts/entry-service.ts`:

```ts
export interface PaymentChange {
  amount: number
  occurred_on: string
  occurred_time: string | null
  account_id: string | null
  description: string | null
  note: string | null
  category_id: string | null
  is_extra_payment: boolean
}
```

`updatePaymentEntry` actualiza el abono y, si hay movimiento enlazado, su cuenta, descripción, nota y categoría. En tarjetas, la cuenta va en `debt_entries.account_id`.

Query nueva `findLinkableTransactions(debtId, amount, occurredOn)` en `src/features/debts/queries.ts`.

## Plan de implementación

1. **Servicio de edición.** Ampliar `PaymentChange`, `validatePaymentChange` y `updatePaymentEntry`. Probar cambiar la cuenta de un pago de préstamo y de tarjeta.
2. **Formulario de edición.** `PaymentDialog` en edición muestra cuenta, descripción, nota, categoría y abono extra según el tipo de deuda. Action `updateEntry` con el schema nuevo.
3. **Movimientos.** El editor de pagos enlazados de SPEC 26 usa el mismo servicio y campos.
4. **Migración.** RPC `convert_debt_adjustment`. `supabase db reset` y probar los tres tipos de deuda.
5. **Candidatos.** `findLinkableTransactions` y su lista en el formulario.
6. **Convertir en la UI.** `DebtEntriesList` abre el formulario de pago con selector **Ajuste | Pago** para ajustes negativos; action `convertAdjustment`.
7. **Docs y CHANGELOG.**
8. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] Editar un pago de préstamo de 200.000 desde Nequi a Bancolombia mueve el gasto en Movimientos a Bancolombia y ajusta los dos saldos.
- [x] Editar la descripción, nota y categoría de ese pago las cambia también en Movimientos. _(`update_debt_entry` las copia al movimiento; revisado en la RPC)_
- [x] Editar un pago de tarjeta cambia la cuenta de origen y los saldos de ambas cuentas. _(probado en la BD)_
- [x] Marcar un pago como abono extra lo muestra como "Abono" en el Sheet.
- [x] Editar un abono de Me deben mensual de 20.000 a 10.200 reparte de nuevo las cuotas (SPEC 39).
- [x] Un ajuste de −150.000 en un préstamo se puede pasar a **Pago** desde **Editar movimiento**. _(la parte 3 reemplazó el selector Ajuste | Pago por el tipo; probado en la BD)_
- [x] Un ajuste de +50.000 en un préstamo solo puede ser Pago, Abono o Ajuste: Compra, Avance y Cuota de manejo son de tarjetas. _(antes abría Actualizar saldo; cambió en la parte 3; probado en la BD)_
- [x] Con un gasto suelto de 150.000 en Movimientos a 3 días del ajuste, aparece en **¿Ya lo registraste?** _(`findLinkableTransactions` filtra monto exacto y ±7 días; revisado en código)_
- [x] Un gasto de 150.000 a 10 días o de 149.000 no aparece como candidato. _(revisado en código; la RPC rechaza enlazar uno de otro monto)_
- [x] Enlazar el candidato deja un solo gasto de 150.000 en Movimientos, ahora con el ícono de pago enlazado, y el saldo de la deuda no cambia.
- [x] **Crear movimiento nuevo** crea un gasto de 150.000 en la cuenta elegida, con descripción "Pago {deuda}".
- [x] Convertir un ajuste de tarjeta con candidato borra el gasto suelto y deja el pago con su cuenta; el saldo de la cuenta baja una sola vez.
- [x] Convertir un ajuste de Me deben crea o enlaza un **ingreso** y sube el saldo de la cuenta.
- [x] Una deuda pagada o archivada no permite editar ni convertir.
- [x] Un usuario no puede convertir ajustes ni enlazar movimientos de otro (RLS).
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

**Verificación (2026-11-17):** la migración se probó en el proyecto remoto dentro de una transacción revertida (14 casos con RLS: enlazar, crear, tarjeta, Me deben, mensual, archivada, ajuste positivo, monto distinto, sin cuenta, movimiento ya enlazado y de otro usuario, cambio de tipo inválido y edición de un pago enlazado). `typegen`, `check`, `eslint`, `prettier:check` y `build` pasan. Migración aplicada con `supabase db push` y tipos regenerados (2026-11-17). Pendiente: probar en la app los criterios sin marcar, más ocultar cifras, móvil a 390 px y AA en claro y oscuro.

## Decisiones

- **Sí:** convertir ajuste en pago con candidatos sugeridos (decisión del usuario).
- **Sí:** campos editables cuenta, descripción/nota, categoría y abono extra (decisión del usuario).
- **Sí:** solo ajustes negativos. Un ajuste que subió el saldo no puede ser un pago.
- **Sí:** mismo monto exacto y ±7 días para candidatos. Un pago real tiene el mismo monto; la fecha varía por fines de semana y cortes.
- **No:** buscador libre. Más UI y el caso real cabe en los candidatos.
- **Sí:** en tarjetas, borrar el gasto suelto al enlazar. El pago de tarjeta vive en el abono (SPEC 16); dejar el gasto contaría la salida dos veces.
- **Sí:** RPC única para convertir. Varios pasos desde la action pueden quedar a medias.
- **No:** camino inverso (pago → ajuste). No se pidió y borrar el pago ya cubre el caso.

## Riesgos

| Riesgo                                                           | Mitigación                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Borrar el gasto suelto de una tarjeta pierde su categoría o nota | El formulario adopta descripción y nota del candidato; se avisa en el diálogo.  |
| `check_debt_entry` rechaza el cambio de `kind` en un update      | La RPC valida antes; si el trigger lo impide, se ajusta en la migración.        |
| Cambiar la cuenta de un pago antiguo descuadra una conciliación  | Igual que editar un movimiento hoy; SPEC 21 muestra la diferencia.              |
| Ajustes importados sin fecha exacta                              | El usuario cambia la fecha antes de guardar; los candidatos usan la del ajuste. |

## Qué **no** entra en este spec

- Conversión en lote, buscador libre y camino inverso.
- Convertir avances o cuotas de manejo (pasa a la parte 2).
- MCP (SPEC 43 y 44).
- Lo de SPEC 41.

---

# Parte 2 — reapertura

## Por qué se reabre

En una tarjeta, el historial puede mostrar casi todo como **Ajuste +**: compras, avances y cuotas de manejo que entraron por **Actualizar saldo** o por importación. Al editarlos se abre "Editar ajuste / Saldo real", que no sirve para corregir el monto de ese movimiento ni para decir qué fue.

Además:

- Un ajuste se edita escribiendo el **saldo real**, no el monto del ajuste. Para corregir un valor mal escrito hay que hacer la resta a mano.
- Los avances antiguos con la cuenta en el abono y sin movimiento (anteriores a SPEC 36) no muestran la cuenta al editarlos.
- Las compras y avances a cuotas no existen: la tarjeta solo conoce un pago mínimo fijo.
- En gastos e ingresos fijos, la definición se edita completa, pero un **pago ya registrado** solo se edita desde Movimientos, no desde el Sheet del gasto o ingreso.

Los pagos de tarjeta registrados antes de SPEC 16 no tienen cuenta y se ven como "Fuera de cuentas". No es un fallo del select. La parte 1 ya permite asignarles la cuenta al editarlos.

## Alcance (parte 2)

**Entra:**

- **Tres tipos de movimiento de tarjeta** con nombres claros en el Sheet y en el diálogo:
  - **Pago** y **Abono** (parte 1);
  - **Compra o avance** (`kind = 'advance'`): sube el saldo. Sin cuenta es una **compra**; con cuenta es un **avance o retiro** y entra a la cuenta como ingreso (SPEC 36). La etiqueta del historial dice "Compra" o "Avance" según tenga cuenta.
- **Cuotas en compras y avances de tarjeta** (`installments`, opcional, 1 a 48; vacío = 1):
  - Se eligen al registrar y al editar.
  - **Cambian el pago del mes**: cada compra o avance a N cuotas aporta `monto / N` a cada uno de los N ciclos de pago siguientes a su fecha. El pago del mes de la tarjeta es el mayor entre el pago mínimo configurado y la suma de las cuotas del ciclo. Sin compras a cuotas, todo sigue igual que hoy.
  - El Sheet muestra en cada compra "a 3 cuotas · 2 de 3" y, en el resumen, cuánto del pago del mes viene de cuotas.
  - Sin intereses por cuota: la proyección usa el pago del mes resultante.
- **Editar compras y avances por completo**: monto, fecha, hora, nota, cuotas y cuenta (incluidos los avances antiguos con la cuenta en el abono: al guardar se pasan al modelo de SPEC 36, ingreso enlazado).
- **Convertir un ajuste positivo de tarjeta**: el diálogo de edición muestra **Ajuste | Compra | Manejo**.
  - **Compra o avance**: mismo monto, fecha y nota; cuenta opcional (con cuenta crea el ingreso de SPEC 36) y cuotas opcionales.
  - **Cuota de manejo**: pasa a `kind = 'fee'` (SPEC 17) con el mismo monto y fecha.
  - El saldo de la deuda no cambia.
  - En préstamos y Me deben, un ajuste positivo solo se edita (no hay a qué convertirlo).
- **Editar un ajuste por su monto**: el formulario de ajuste muestra **Monto del ajuste** (con signo: sube o baja el saldo) y debajo el saldo resultante. "Actualizar saldo" para crear uno nuevo sigue pidiendo el saldo real.
- **Gastos e ingresos fijos**: en el historial del Sheet, cada periodo pagado o recibido lista sus pagos con **Editar** (abre `TransactionDialog` de ese movimiento) y **Eliminar** (el periodo vuelve a pendiente, o a parcial en un ingreso con varios cobros, SPEC 38). Es el mismo movimiento que en Movimientos: editar en un lado se ve en el otro.
- Ocultar cifras, móvil a 390 px, controles de 44 px y AA en claro y oscuro.
- **Documentación**: `docs/producto.md` y `CHANGELOG.md`.

**Fuera de alcance (parte 2):**

- Intereses por cuota o tasa por compra.
- Cuotas en préstamos o en Me deben.
- Convertir en lote o importar cuotas desde Excel.
- Cuotas desde el MCP (SPEC 43 y 44).

## Modelo de datos (parte 2)

Migración `supabase/migrations/<timestamp>_debt_entry_installments.sql`:

- `debt_entries.installments smallint null`, `check (installments between 1 and 48)` y `check (installments is null or kind = 'advance')`. `check_debt_entry` exige que la deuda sea una tarjeta.
- `check_debt_entry`: además del cambio de la parte 1, permite `adjustment → advance` y `adjustment → fee` con `old.amount > 0` y el mismo monto.
- RPC `convert_debt_adjustment_to_charge(p_entry_id, p_kind, p_account_id, p_installments, p_occurred_on, p_occurred_time, p_note) returns uuid`: `p_kind` es `'advance'` o `'fee'`; con cuenta crea el ingreso "Avance de tarjeta" (SPEC 36). `security invoker`, `for update`, valida ajuste positivo de una tarjeta activa.
- RPC `update_card_advance(p_entry_id, p_amount, p_occurred_on, p_occurred_time, p_note, p_account_id, p_installments, p_description, p_category_id) returns uuid`: edita una compra o avance en una transacción. Con cuenta y sin ingreso lo crea y lo enlaza (también en los avances anteriores a SPEC 36 con la cuenta en el abono); sin cuenta queda como compra y borra el ingreso que tuviera.
- Función `card_installment_start(fecha, due_day, closing_day)`: mes del primer vencimiento de una compra (con corte, el primero posterior al corte que la incluye). La misma regla vive en `src/features/debts/installments.ts`.
- **Corrección encontrada al probar:** el check de SPEC 06 `kind = 'payment' or transaction_id is null` impedía enlazar el ingreso de un avance, así que `record_card_advance` con cuenta fallaba y la migración de datos de SPEC 36 no convirtió ningún avance. Se reemplaza por `debt_entries_transaction_kind` (pagos y avances) y se repite esa conversión.
- `debt_overview` devuelve `installments_due_current` e `installments_due_previous`: la suma de `monto / N` de las compras y avances cuyo rango de N ciclos cubre el ciclo actual o el anterior.
- La RPC que hoy registra avances acepta `p_installments`.

En `calculations.ts`, `requiredPayment` de una tarjeta pasa a `max(min_payment ?? 0, installments_due)`; null si ambos faltan.

## Plan de implementación (parte 2)

9. **Migración de cuotas.** Columna, checks, `check_debt_entry`, `debt_overview` y el parámetro al registrar avances. Probarla en el remoto dentro de una transacción revertida, como en el paso 4.
10. **Pago del mes con cuotas.** `requiredPayment`, `nextPayment` y la proyección; resumen "de cuotas" en el Sheet.
11. **Registrar y editar compras y avances.** Campo Cuotas en el diálogo; etiqueta Compra / Avance; cuenta editable en avances antiguos (pasan a ingreso enlazado).
12. **Convertir ajustes positivos.** RPC `convert_debt_adjustment_to_charge` y selector **Ajuste | Compra | Manejo**.
13. **Ajuste por monto.** Formulario de edición de ajuste con el monto y el saldo resultante.
14. **Gastos e ingresos fijos.** Editar y eliminar pagos registrados desde el historial de sus Sheets.
15. **Docs y CHANGELOG.**
16. **Verificación.** `typegen`, `check`, `eslint`, `prettier:check`, `build`, `supabase db push` de las dos migraciones y regenerar `src/types/database.ts`.

Todo el código de la parte 2 está en la rama (migración `20261117140000_debt_entry_installments.sql`). `src/types/database.ts` está regenerado tras el push.

## Criterios de aceptación (parte 2)

- [x] Una compra de 300.000 a 3 cuotas suma 100.000 al pago de cada uno de los 3 ciclos siguientes; con pago mínimo de 150.000 el pago del mes es 150.000 y con dos compras así es 200.000. _(probado en la BD; `cardMonthlyPayment` hace el máximo)_
- [x] Sin compras a cuotas, el pago del mes de una tarjeta es el mismo que hoy. _(revisado en código: cuotas en 0 dan el mínimo)_
- [ ] El historial muestra "Compra" sin cuenta y "Avance" con cuenta, y "a 3 cuotas · 2 de 3" donde aplica. _(revisado en código; falta verlo en la app)_
- [x] Editar una compra cambia su monto, fecha, nota y cuotas, y el pago del mes se recalcula. _(probado en la BD)_
- [x] Editar un avance antiguo con la cuenta en el abono (anterior a SPEC 36) permite cambiar la cuenta y lo deja como ingreso enlazado en Movimientos. _(probado en la BD; la migración además convierte los que quedan)_
- [x] Un ajuste de +100.000 en una tarjeta se puede pasar a **Compra** a 2 cuotas desde **Editar movimiento** sin cambiar el saldo de la deuda. _(la parte 3 reemplazó el selector Ajuste | Compra | Manejo por el tipo; probado en la BD)_
- [x] Convertir un ajuste de +15.000 en **Cuota de manejo** lo deja como cuota de manejo (SPEC 17) sin cambiar el saldo. _(probado en la BD)_
- [x] Convertir en avance con cuenta crea el ingreso "Avance de tarjeta" en esa cuenta. _(probado en la BD)_
- [x] Un ajuste positivo de un préstamo solo muestra el formulario de ajuste. _(el selector exige tarjeta; la RPC rechaza préstamos, probado en la BD)_
- [x] Editar un ajuste muestra su monto y **Sube | Baja**; cambiarlo de +150.000 a +140.000 baja el saldo 10.000. _(saldo probado en la BD; la parte 3 cambió el monto con signo por Sube | Baja)_
- [ ] En el Sheet de un gasto fijo, el pago de octubre tiene Editar y Eliminar; editar su monto o cuenta se ve igual en Movimientos, y eliminarlo deja octubre pendiente. _(revisado en código; falta probar en la app)_
- [ ] En el Sheet de un ingreso fijo con dos cobros en un mes, cada cobro se edita y elimina por separado; eliminar uno deja el mes parcial. _(revisado en código; falta probar en la app)_
- [x] Una deuda pagada o archivada no permite editar ni convertir; RLS impide tocar datos de otro usuario. _(probado en la BD)_
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

**Verificación (2026-11-17, parte 2):** la migración se probó en el proyecto remoto dentro de una transacción revertida, junto con 15 casos con RLS: cuotas del ciclo actual y anterior (sin corte y con corte), préstamo sin cuotas, avance con cuenta, ajuste → compra a 2 cuotas, → cuota de manejo y → avance con ingreso, préstamo y ajuste negativo rechazados, compra → avance → cambio de monto → compra, avance antiguo con cuenta en el abono, cuotas en un pago y fuera de rango, otro usuario y tarjeta archivada. Esa prueba encontró el check de SPEC 06 que bloqueaba los avances con ingreso. `supabase db push` aplicó las dos migraciones de SPEC 42 el 2026-11-17 (convirtió el único avance con la cuenta en el abono) y `src/types/database.ts` se regeneró. Pendiente: probar en la app los criterios sin marcar, más ocultar cifras, móvil a 390 px y AA en claro y oscuro.

## Decisiones (parte 2)

- **Sí:** las cuotas cambian el pago del mes (decisión del usuario), como `max(mínimo, Σ cuotas del ciclo)`.
- **Sí:** ajuste positivo de tarjeta → compra o avance, o cuota de manejo (decisión del usuario).
- **Sí:** gastos e ingresos fijos dentro de este spec (decisión del usuario).
- **Sí:** compra y avance son el mismo tipo (`advance`); la cuenta decide la etiqueta. Evita un tipo nuevo y reutiliza SPEC 36.
- **No:** intereses por cuota. La app no conoce la tasa de cada compra.
- **Sí:** la primera cuota va en el primer vencimiento posterior a la compra (o al corte que la incluye). Una compra el mismo día de pago va al vencimiento siguiente.
- **Sí:** cuotas vacías = sin cuotas (no cambian el pago del mes); 1 cuota sí suma la compra completa al ciclo siguiente.

## Riesgos (parte 2)

| Riesgo                                                                | Mitigación                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| El ciclo de una compra depende del día de corte (`closing_day`)       | Sin corte, el ciclo es el del día de pago, igual que `paid_current_cycle`.     |
| `max(mínimo, cuotas)` no coincide con el extracto del banco           | Es una estimación; el usuario puede subir el mínimo. Se explica en `HelpHint`. |
| Pasar un avance antiguo a ingreso enlazado cambia Movimientos         | Mismo modelo que la migración de SPEC 36; se avisa en el diálogo.              |
| Eliminar un pago de un ingreso con varios cobros descuadra el reparto | El trigger de SPEC 38 reparte de nuevo al borrar.                              |

## Preguntas abiertas

- Ninguna. El pago del mes usa `max(mínimo, cuotas)`, como en "Decisiones".

---

# Parte 3 — un solo editor

## Por qué

Cada tipo de movimiento tenía su propia forma de editarse (el pago en su diálogo, el ajuste con tabs de conversión y monto con signo, la compra con otro texto). Para el usuario eso es desorden: no sabe dónde cambiar qué. Pedido del usuario: **un solo modal que actualice todo, como si se volviera a crear**, y que diga qué falta si el tipo nuevo lo pide.

## Alcance (parte 3)

- `DebtEntryDialog` (**Editar movimiento**) reemplaza la edición de `PaymentDialog`, de `AdjustBalanceDialog` y los formularios de conversión. Lo usan el Sheet de la deuda y Movimientos.
- Selector **Tipo** con una línea de ayuda: Pago, Abono, Compra, Avance, Cuota de manejo y Ajuste en tarjetas; Pago, Abono y Ajuste en préstamos; Cobro y Ajuste en Me deben (una mensual solo Cobro).
- Campos según el tipo; el ajuste usa **Sube | Baja** y monto sin signo. Si falta un dato obligatorio del tipo nuevo, se avisa antes de guardar y el servidor marca el campo.
- **¿Ya lo registraste?** cuando el tipo nuevo lleva movimiento: enlaza un gasto o ingreso suelto del mismo monto (en un avance también, para no contar dos veces el ingreso).
- Resumen del efecto: saldo de la deuda antes → después y qué pasa con la cuenta.
- `PaymentDialog` queda solo para registrar y `AdjustBalanceDialog` solo para "Actualizar saldo".

## Modelo de datos (parte 3)

Migración `20261117150000_update_debt_entry.sql`:

- `check_debt_entry` deja cambiar el tipo; el resultado pasa por las mismas reglas y `check_debt_balance`.
- RPC `update_debt_entry(p_entry_id, p_kind, p_amount, p_occurred_on, p_occurred_time, p_note, p_account_id, p_create_transaction, p_is_extra_payment, p_installments, p_description, p_category_id, p_link_transaction_id) returns uuid`: reescribe el abono y su movimiento en una transacción (crea, reutiliza, enlaza o borra el movimiento; reparte de nuevo una mensual de Me deben).
- Se borran `convert_debt_adjustment` y `convert_debt_adjustment_to_charge`.

## Criterios de aceptación (parte 3)

- [x] Cambiar un ajuste de +100.000 de una tarjeta a avance con cuenta crea su ingreso y no cambia el saldo de la deuda. _(probado en la BD)_
- [x] Cambiar ese avance a cuota de manejo de 15.000 borra el ingreso y baja el saldo 85.000. _(probado en la BD)_
- [x] Una cuota de manejo pasada a abono de tarjeta desde una cuenta baja la deuda y la cuenta. _(probado en la BD)_
- [x] Un ajuste pasado a pago de tarjeta enlazando un gasto suelto lo borra: la cuenta baja una sola vez. _(probado en la BD)_
- [x] Un pago de préstamo pasado a ajuste borra su gasto; volverlo abono con gasto exige la cuenta. _(probado en la BD)_
- [x] Avance o cuota de manejo en un préstamo, y ajuste nuevo en una mensual de Me deben, se rechazan. _(probado en la BD)_
- [x] Cambiar el monto de un cobro mensual lo reparte de nuevo entre las cuotas. _(probado en la BD)_
- [x] Otro usuario no puede editar; una deuda archivada no se edita. _(probado en la BD)_
- [ ] El modal muestra solo los campos del tipo, avisa lo que falta y el resumen del saldo es correcto. _(falta probar en la app)_
- [ ] Desde Movimientos, editar un pago de préstamo, un pago de tarjeta y un avance abre el mismo modal. _(falta probar en la app)_
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

**Verificación (2026-11-17, parte 3):** la RPC se probó en el proyecto remoto dentro de una transacción revertida con los 14 casos de arriba. Pendiente: `supabase db push` de `20261117150000_update_debt_entry.sql` (los tipos ya incluyen `update_debt_entry`; regenerarlos tras el push) y revisar en la app los criterios sin marcar, que son solo visuales.
