# SPEC 42 — Editar movimientos de deuda y convertir ajustes en pagos

> **Estado:** Implementado
> **Depende de:** SPEC 06, SPEC 08b, SPEC 16, SPEC 26, SPEC 29, SPEC 36, SPEC 39, SPEC 41
> **Fecha:** 2026-11-17
> **Objetivo:** Que desde el Sheet de una deuda se pueda editar por completo cada pago o abono, y convertir en pago un ajuste que en realidad fue un pago, reflejando todo en Movimientos y en el saldo de la cuenta.

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
  - el diálogo de edición de un ajuste negativo muestra un selector **Ajuste | Fue un pago** (en Me deben: **Ajuste | Fue un cobro**);
  - con **Fue un pago**: monto (positivo, prellenado con el ajuste), fecha (la del ajuste), cuenta, descripción y nota;
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
- Convertir avances o cuotas de manejo.
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
6. **Convertir en la UI.** `DebtEntriesList` abre el formulario de pago con selector **Ajuste | Fue un pago** para ajustes negativos; action `convertAdjustment`.
7. **Docs y CHANGELOG.**
8. **Verificación.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [x] Editar un pago de préstamo de 200.000 desde Nequi a Bancolombia mueve el gasto en Movimientos a Bancolombia y ajusta los dos saldos.
- [ ] Editar la descripción, nota y categoría de ese pago las cambia también en Movimientos. _(revisado en código; falta probar en la app)_
- [ ] Editar un pago de tarjeta cambia la cuenta de origen y los saldos de ambas cuentas. _(revisado en código; falta probar en la app)_
- [x] Marcar un pago como abono extra lo muestra como "Abono" en el Sheet.
- [x] Editar un abono de Me deben mensual de 20.000 a 10.200 reparte de nuevo las cuotas (SPEC 39).
- [ ] Un ajuste de −150.000 en un préstamo muestra **Ajuste | Fue un pago** al editarlo. _(revisado en código; falta probar en la app)_
- [x] Un ajuste de +50.000 abre **Actualizar saldo** sin opción de convertir.
- [ ] Con un gasto suelto de 150.000 en Movimientos a 3 días del ajuste, aparece como candidato. _(revisado en código; falta probar en la app)_
- [ ] Un gasto de 150.000 a 10 días o de 149.000 no aparece como candidato. _(revisado en código; la RPC rechaza enlazar el de 149.000)_
- [x] Enlazar el candidato deja un solo gasto de 150.000 en Movimientos, ahora con el ícono de pago enlazado, y el saldo de la deuda no cambia.
- [x] **Crear movimiento nuevo** crea un gasto de 150.000 en la cuenta elegida, con descripción "Pago {deuda}".
- [x] Convertir un ajuste de tarjeta con candidato borra el gasto suelto y deja el pago con su cuenta; el saldo de la cuenta baja una sola vez.
- [x] Convertir un ajuste de Me deben crea o enlaza un **ingreso** y sube el saldo de la cuenta.
- [x] Una deuda pagada o archivada no permite editar ni convertir.
- [x] Un usuario no puede convertir ajustes ni enlazar movimientos de otro (RLS).
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

**Verificación (2026-11-17):** la migración se probó en el proyecto remoto dentro de una transacción revertida (14 casos con RLS: enlazar, crear, tarjeta, Me deben, mensual, archivada, ajuste positivo, monto distinto, sin cuenta, movimiento ya enlazado y de otro usuario, cambio de tipo inválido y edición de un pago enlazado). `typegen`, `check`, `eslint`, `prettier:check` y `build` pasan. Pendiente: `supabase db push`, regenerar `src/types/database.ts` y probar en la app los criterios sin marcar, más ocultar cifras, móvil a 390 px y AA en claro y oscuro.

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
- Convertir avances o cuotas de manejo.
- MCP (SPEC 43 y 44).
- Lo de SPEC 41.
