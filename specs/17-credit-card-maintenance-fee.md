# SPEC 17 — Cuota de manejo automática de la tarjeta

> **Estado:** Aprobado
> **Depende de:** SPEC 06, SPEC 16
> **Fecha:** 2026-11-01
> **Objetivo:** Que cada tarjeta de crédito cobre sola su cuota de manejo cada mes como una entrada que sube su saldo, sin tocar las cuentas del usuario, y que el usuario pueda editarla o borrarla.

## Por qué existe este spec

El banco cobra la cuota de manejo directamente al saldo de la tarjeta. El usuario no pone plata de sus cuentas: la paga después, dentro del pago de la tarjeta.
Hoy esa cuota solo se refleja con "Actualizar saldo", a mano y sin historial claro.
Es un cobro recurrente, así que se genera sola con `pg_cron`, igual que los jobs de borrado de SPEC 09 y 10. El usuario puede corregir una cuota (por ejemplo, el banco la exoneró) y la corrección no se deshace sola.
Reutiliza el modelo de entradas de SPEC 06 y el valor de `enum` que agrega SPEC 16 para los avances.

## Alcance

**Entra:**

- Dos campos opcionales en la tarjeta: **Cuota de manejo** (monto) y **Día de cobro** (1–31). Se editan en `debt-dialog.tsx`, solo para tarjetas, y van juntos o ninguno.
- Entrada nueva `fee` en `debt_entries` ("Cuota de manejo"):
  - sube el saldo de la tarjeta;
  - nunca lleva cuenta ni movimiento;
  - se muestra en el historial con su fecha, monto y la etiqueta "Cuota de manejo · automática" cuando la generó el job.
- Job `pg_cron` diario que genera las cuotas vencidas de las tarjetas activas.
- Editar y eliminar una cuota generada, con las mismas reglas de las demás entradas. Eliminarla no la regenera.
- "Próxima cuota: 5 de diciembre · $ 22.000" en el Sheet de la tarjeta, bajo el resumen.
- Día inexistente en el mes → último día del mes (regla de SPEC 04 y 06).
- Documentación: `docs/producto.md`, `ROADMAP.md` y `CHANGELOG.md`.

**Fuera de alcance (para specs futuros):**

- Cuotas con monto variable por mes o escalonadas.
- Exoneración automática por uso mínimo de la tarjeta.
- Otros cargos automáticos (seguros, intereses). Siguen por "Actualizar saldo".
- Cuota de manejo en préstamos.
- Cobrar cuotas atrasadas de antes de configurar la cuota.
- Notificar cuando se genera una cuota.
- Registro manual de una cuota fuera del job (se usa "Actualizar saldo").

## Modelo de datos

Dos migraciones, porque un valor nuevo de `enum` no se usa en su misma transacción.

`supabase/migrations/<timestamp>_add_debt_entry_fee.sql`:

```sql
alter type public.debt_entry_kind add value 'fee';
```

`supabase/migrations/<timestamp>_credit_card_maintenance_fee.sql`:

```sql
alter table public.debts
  add column fee_amount numeric(14, 2) check (fee_amount > 0),
  add column fee_day smallint check (fee_day between 1 and 31),
  -- Último vencimiento ya procesado; evita regenerar una cuota borrada
  add column fee_charged_through date,
  add check ((fee_amount is null) = (fee_day is null)),
  add check (fee_amount is null or kind = 'credit_card');

alter table public.debt_entries
  add column generated boolean not null default false,
  add check (kind <> 'fee' or (transaction_id is null and account_id is null));
```

- Saldo de la tarjeta: `opening_balance − Σ payment + Σ adjustment + Σ advance + Σ fee`.
- `debt_overview`, `check_debt_balance` y `score_balances` se reemplazan para sumar `fee`.
- **Triggers:**
  - `check_debt_entry` (se reemplaza): `fee` solo en tarjetas, con `amount > 0`.
  - `debts_reset_fee_cursor` (`before insert or update` en `debts`): pone `fee_charged_through = hoy` (Bogotá) cuando
    - se crea la tarjeta con cuota;
    - cambia `fee_amount` o `fee_day`;
    - la deuda pasa a `active` desde `paid` o `archived`.
  - Así nunca se cobra hacia atrás: la primera cuota es el primer `fee_day` posterior a hoy.
- **Función** `charge_card_fees()` (`security definer`, `search_path = ''`, sin `grant` a `anon` ni `authenticated`):
  - recorre las tarjetas `active` con `fee_amount`;
  - para cada vencimiento `fee_day` del mes con fecha mayor que `fee_charged_through` y menor o igual que hoy (Bogotá), inserta una entrada `fee` con `generated = true`, `amount = fee_amount`, `occurred_on` = el vencimiento y nota "Cuota de manejo";
  - al terminar cada tarjeta, `fee_charged_through` = hoy;
  - una falla en una tarjeta no detiene las demás.
- **Job:**

```sql
-- 05:10 UTC = 00:10 America/Bogota
select cron.schedule(
  'charge-card-fees',
  '10 5 * * *',
  $$select public.charge_card_fees()$$
);
```

- La entrada se inserta con el trigger `check_debt_entry` activo: no se generan cuotas en deudas pagadas o archivadas.
- Editar o borrar una cuota usa las reglas y políticas RLS de las demás entradas (SPEC 06).

Esquema (en `src/features/debts/schemas.ts`):

```ts
// Tarjeta: ambos campos o ninguno
fee_amount: amountSchema.optional(),
fee_day: dayOfMonthSchema.optional()
// Regla: fee_amount y fee_day van juntos
```

Tipo:

```ts
// src/features/debts/types.ts
type DebtEntryKind = "payment" | "adjustment" | "advance" | "fee"
```

Cálculo (en `src/features/debts/calculations.ts`): `nextFeeDate(debt, today)` devuelve el primer `fee_day` posterior a hoy en el mes actual o el siguiente, con la regla del último día del mes.

## Plan de implementación

1. **Migraciones.**
   - Aplicar `add_debt_entry_fee` y luego `credit_card_maintenance_fee` con `supabase db push`; regenerar `src/types/database.ts`.
   - Verificar en la BD:
     - ejecutar `charge_card_fees()` con una tarjeta de cuota y `fee_charged_through` dos meses atrás crea dos entradas y deja el cursor en hoy;
     - ejecutarla dos veces seguidas no duplica;
     - borrar una entrada generada y volver a ejecutar no la regenera;
     - `fee_day` 31 cae el 30 de noviembre y el 28 de febrero;
     - una tarjeta archivada no recibe cuotas;
     - un `fee` en un préstamo falla;
     - `anon` y `authenticated` no pueden ejecutar `charge_card_fees()`.
2. **Esquemas y cálculos.**
   - Campos en `schemas.ts` y `nextFeeDate` en `calculations.ts`; el saldo suma `fee`.
3. **Formulario de tarjeta.**
   - `debt-dialog.tsx`: campos "Cuota de manejo" y "Día de cobro" solo en tarjetas, con ayuda en `src/config/help.ts`.
4. **Historial y Sheet.**
   - `debt-entries-list.tsx` muestra "Cuota de manejo" y "automática" cuando `generated`.
   - `debt-sheet.tsx` muestra "Próxima cuota". Editar y eliminar funcionan como en las demás entradas.
5. **Docs.**
   - `docs/producto.md`: sección "Cuota de manejo" con el cursor, la regla de no cobrar hacia atrás y el efecto nulo en las cuentas.
   - `ROADMAP.md` y `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] Las migraciones se aplican sin errores y `src/types/database.ts` incluye `fee_amount`, `fee_day`, `fee_charged_through`, `debt_entries.generated` y el valor `fee`.
- [ ] `cron.job` incluye `charge-card-fees` con el horario `10 5 * * *`.
- [ ] Crear una tarjeta con cuota $ 22.000 y día 5 no genera entradas el mismo día y el Sheet muestra la próxima cuota.
- [ ] Ejecutar `charge_card_fees()` el 5 de diciembre agrega una entrada "Cuota de manejo" de $ 22.000 con fecha 5 de diciembre, marcada como automática, y sube el saldo y la utilización de la tarjeta.
- [ ] Ejecutarla de nuevo el mismo día no duplica la entrada.
- [ ] La cuota no cambia el saldo de ninguna cuenta ni crea movimiento en Movimientos.
- [ ] Reportes, Presupuestos y los totales de ingresos y gastos no cambian por una cuota generada.
- [ ] Eliminar una cuota generada baja el saldo y el job no la vuelve a crear.
- [ ] Editar el monto de una cuota generada cambia el saldo y se conserva.
- [ ] Cambiar el monto o el día de la cuota no genera cuotas de meses anteriores.
- [ ] Una tarjeta con día de cobro 31 cobra el 30 de noviembre de 2026 y el 28 de febrero de 2027.
- [ ] Archivar una tarjeta detiene las cuotas. Reactivarla no cobra los meses archivados.
- [ ] Quitar la cuota (campos vacíos) detiene los cobros.
- [ ] Un préstamo no muestra los campos de cuota y la BD rechaza `fee_amount` en él.
- [ ] Un usuario A no puede leer ni cambiar la cuota de las tarjetas de B, y ni A ni `anon` pueden ejecutar `charge_card_fees()`.
- [ ] Las tarjetas existentes, sin cuota, no cambian de saldo tras la migración.

## Decisiones

- **Sí:** cobro automático con `pg_cron` diario. Es un cargo recurrente; el usuario no debería acordarse de registrarlo.
- **Sí:** editable y borrable. El banco a veces exonera la cuota o la cambia.
- **No:** solo manual. El usuario pidió que se cobre solo.
- **Sí:** la cuota sube el saldo de la tarjeta y nunca toca una cuenta. Así la cobra el banco; el usuario la paga dentro del pago de la tarjeta.
- **Sí:** entrada `fee` propia, no un ajuste. El historial dice qué es y la distingue de lo manual.
- **No:** cargo genérico con concepto. Más flexible pero ensucia el historial; intereses y otros cargos quedan para "Actualizar saldo".
- **Sí:** cursor `fee_charged_through` en la deuda. Es lo que evita regenerar una cuota que el usuario borró.
- **No:** unicidad por (deuda, vencimiento) como control. Una cuota borrada se volvería a crear.
- **Sí:** nunca cobrar hacia atrás. Configurar una cuota hoy no inventa deuda de meses pasados.
- **Sí:** monto fijo mensual. Cubre el caso común; la variación se edita a mano.
- **Sí:** el job corre a las 00:10 de Bogotá. La cuota queda con la fecha correcta desde el inicio del día.
- **Sí:** `security definer` solo para el job, sin permiso a usuarios. El job inserta entradas de todos los espacios.

## Riesgos

| Riesgo                                                         | Mitigación                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| El job no corrió (Supabase pausado) y quedan días sin cobrar   | El cursor recupera todos los vencimientos pendientes en la siguiente ejecución, con su fecha real      |
| El usuario ya había registrado la cuota con "Actualizar saldo" | Aviso en el diálogo: "Desde hoy se cobra sola. No la registres a mano"; la cuota no es retroactiva     |
| Una entrada generada falla por el trigger y bloquea las demás  | El bucle atrapa el error por tarjeta y sigue con la siguiente                                          |
| `security definer` abre una puerta a otros espacios            | Sin `grant` a `anon` ni `authenticated`; solo lo ejecuta `pg_cron`; criterio de aceptación de permisos |
| El banco cobra la cuota otro día que `fee_day`                 | El saldo se corrige con "Actualizar saldo" o editando la fecha de la entrada                           |

## Lo que **no** entra en este spec

- Cuotas variables o escalonadas.
- Exoneración automática por uso.
- Otros cargos automáticos.
- Cuota en préstamos.
- Cuotas atrasadas anteriores a la configuración.
- Notificaciones.
- Registro manual de cuotas.

Cada uno de esos puntos, si llega, va en su propio spec.
