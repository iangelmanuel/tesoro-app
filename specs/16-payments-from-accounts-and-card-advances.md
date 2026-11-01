# SPEC 16 — Pagos desde cuentas, traspaso al pagar y avances de tarjeta

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06, SPEC 08c, SPEC 15
> **Fecha:** 2026-11-01
> **Objetivo:** Que al pagar un gasto fijo, una deuda o una tarjeta, o al aportar a una meta, el usuario elija de qué cuenta sale la plata (o que fue por fuera de sus cuentas), traspase fondos al pagar si la cuenta no alcanza, y registre pagos y avances de tarjeta como movimientos entre una cuenta y la tarjeta.

## Por qué existe este spec

Hoy solo los gastos y la cuenta de un pago de préstamo o abono tocan los saldos de SPEC 08c. Pagar una tarjeta o aportar a una meta no mueve ninguna cuenta, y la tarjeta no tiene forma de registrar un avance.
El usuario guarda su capital en una cuenta (Bancolombia), paga desde otra (Nequi) y el día de pagos traspasa de una a la otra. Hoy son dos pasos separados y la app no avisa si la cuenta no alcanza.
Una tarjeta se comporta como una cuenta independiente: se le abona y se retira de ella. En vez de crear "cuentas de crédito" y reescribir SPEC 06 y 07, la tarjeta **sigue en Deudas** y cada pago o avance es un movimiento entre una cuenta y la tarjeta.
Esos movimientos **no son ingreso ni gasto**: mueven capital, igual que los traspasos de SPEC 08c. Reportes, presupuestos y score no cambian por ellos.
La cuenta es siempre opcional. "Sin cuenta" significa que el pago fue por fuera de las cuentas registradas, y el historial lo dice.
La cuota de manejo automática de la tarjeta va en el **SPEC 17**.

## Alcance

**Entra:**

- **Sección común "Cuenta"** en los diálogos de pago (`src/features/accounts/components/payment-account-section.tsx`, nuevo), con tres estados:
  - **Sin cuenta** (por defecto): el pago fue por fuera de las cuentas. No toca ningún saldo.
  - **Con cuenta:** `Select` de cuentas activas. Muestra el saldo a hoy de la cuenta elegida.
  - **Con traspaso:** `Switch` "Traspasar fondos antes", visible solo con cuenta elegida:
    - `Select` "Desde" con las demás cuentas activas y su saldo; por defecto, la de mayor saldo;
    - monto del traspaso, por defecto el monto del pago y editable;
    - la fecha del traspaso es la del pago;
    - si el saldo de la cuenta elegida es menor que el monto del pago, aviso "Nequi tiene $ X. Faltan $ Y" y el switch arranca encendido.
  - Solo se muestra con 2 o más cuentas activas para el traspaso. Con una sola, solo "Sin cuenta" / "Con cuenta".
- **Tarjeta de crédito**, en `PaymentDialog`:
  - tabs **Pago** y **Avance**;
  - Pago: baja el saldo de la tarjeta y el de la cuenta elegida;
  - Avance: sube el saldo de la tarjeta (más deuda) y el de la cuenta elegida (entra el dinero);
  - el texto "Este pago no crea un movimiento" cambia por el efecto real según la cuenta;
  - ninguno crea movimiento en `transactions`.
- **Préstamo y cuenta por cobrar:** mantienen la casilla "Registrar como gasto/ingreso" de SPEC 06.
  - La sección de cuenta aparece solo con la casilla marcada: la cuenta es la del gasto o ingreso creado.
  - Con la casilla desmarcada, el pago queda por fuera de las cuentas.
- **Metas:** `ContributionDialog` con la sección de cuenta.
  - Aporte: baja la cuenta elegida.
  - Retiro: sube la cuenta elegida.
  - No crea movimiento en `transactions`.
- **Gastos fijos:** `TransactionDialog` abierto desde "Pagar" ya tiene cuenta (SPEC 08c). Se le agrega el traspaso al pagar, con la misma sección, cuando el movimiento es un gasto.
- **Historial** de pagos, avances y aportes: cada fila muestra "Desde <cuenta>", "A <cuenta>" o "Fuera de cuentas".
  - Deudas y metas lo leen de `account_id`; préstamos y cuentas por cobrar, de la cuenta del movimiento enlazado.
  - Aplica a `debt-entries-list.tsx`, `contributions-list.tsx` y la lista de gastos fijos.
- **Movimientos:** los pagos de tarjeta, avances, aportes y retiros con cuenta aparecen en la lista unificada, en gris y sin sumarse a los totales, junto a traspasos y ajustes. Son de solo lectura; se editan desde la deuda o la meta.
- **Traspaso al pagar atómico:** el traspaso y el pago se guardan en una sola operación; si uno falla, ninguno queda.
- **Cuenta en la hoja móvil** (SPEC 15): los diálogos de la hoja usan los mismos componentes, así que reciben la sección sin trabajo extra.
- **Documentación:** `docs/producto.md`, `ROADMAP.md` y `CHANGELOG.md`.

**Fuera de alcance (para specs futuros):**

- Cuota de manejo automática de la tarjeta (**SPEC 17**).
- Tarjeta como cuenta de crédito en Cuentas.
- Compras "pagadas con tarjeta X" que suban el saldo de la tarjeta solas.
- Cuenta en gastos o ingresos de Empresa. Las cuentas son solo de Personal (SPEC 08c).
- Cuenta por defecto o recordar la última usada.
- Sugerir el traspaso al abrir el mes o al ver vencimientos.
- Importar la cuenta en los destinos del SPEC 08b.
- Bloquear pagos cuando la cuenta no alcanza. El saldo negativo sigue permitido.
- Avance con comisión o interés propio. Se corrige con "Actualizar saldo".

## Modelo de datos

Dos migraciones, porque un valor nuevo de `enum` no se puede usar en la misma transacción que lo crea.

`supabase/migrations/<timestamp>_add_debt_entry_advance.sql`:

```sql
alter type public.debt_entry_kind add value 'advance';
```

`supabase/migrations/<timestamp>_payments_from_accounts.sql`:

```sql
alter table public.debt_entries
  add column account_id uuid,
  add foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict,
  -- Con movimiento enlazado, la cuenta es la del movimiento
  add check (account_id is null or transaction_id is null);

alter table public.debt_entries
  drop constraint debt_entries_check, -- amount > 0 salvo ajuste
  add check (kind = 'adjustment' or amount > 0);

alter table public.goal_contributions
  add column account_id uuid,
  add foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict;

create index debt_entries_account on public.debt_entries (account_id)
  where account_id is not null;
create index goal_contributions_account on public.goal_contributions (account_id)
  where account_id is not null;
```

- El nombre real de la restricción `amount > 0` se consulta en la BD antes de borrarla; el cambio solo reafirma que `advance` exige `amount > 0`.
- `on delete restrict` no se dispara en la práctica: las cuentas no se borran (SPEC 08c).

Saldos:

```text
saldo deuda   = opening_balance − Σ payment + Σ adjustment + Σ advance
saldo cuenta  = (fórmula de SPEC 08c)
              − Σ debt_entries payment con account_id
              + Σ debt_entries advance con account_id
              − Σ goal_contributions con account_id   (el retiro es negativo, así que suma)
```

- **Triggers:**
  - `check_debt_entry` (se reemplaza):
    - `advance` solo en tarjetas, con `amount > 0`, sin `transaction_id`;
    - `account_id` solo en `payment` o `advance` de una tarjeta; en préstamos y cuentas por cobrar la cuenta va en el movimiento;
    - el resto de las reglas de SPEC 06 sigue igual.
  - `check_account_active` (SPEC 08c) se agrega también a `debt_entries` y `goal_contributions`: una cuenta archivada no se puede usar en una fila nueva.
- **Funciones que calculan el saldo de una deuda** se reemplazan para sumar `advance`:
  - `debt_overview` (`balance`);
  - `check_debt_balance`;
  - `score_balances` (SPEC 07), que hoy resta pagos y suma ajustes.
- `account_balances` suma los tres orígenes nuevos a `deltas`.
- `ledger_entries` agrega tres ramas de `union all`, con `kind` `debt_payment`, `debt_advance` y `goal_contribution`, `account_id`, `to_account_id = null` y `description` = nombre de la deuda o la meta. Solo filas con `account_id`. Para metas, el signo del monto distingue aporte y retiro.
- **RPC** (todas `security invoker`, `search_path = ''`, `grant execute` solo a `authenticated`):
  - `record_debt_payment` se reemplaza (`drop` + `create`) con
    `p_account_id uuid default null, p_transfer_from uuid default null, p_transfer_amount numeric default null`:
    - en préstamo o cuenta por cobrar con movimiento, `p_account_id` va al movimiento;
    - en tarjeta, `p_account_id` va a la entrada;
    - si llegan `p_transfer_from` y `p_transfer_amount`, crea antes un `transfers` de `p_transfer_from` a `p_account_id` con la fecha del pago, en la misma transacción. Sin `p_account_id`, lanza un error.
  - `record_card_advance(p_debt_id uuid, p_amount numeric, p_occurred_on date, p_note text, p_account_id uuid default null)` crea la entrada `advance`. El avance no lleva traspaso.
  - `record_goal_contribution(p_goal_id uuid, p_amount numeric, p_occurred_on date, p_note text, p_account_id uuid default null, p_transfer_from uuid default null, p_transfer_amount numeric default null)` reemplaza el `insert` directo de `createContribution`. Un retiro (monto negativo) ignora el traspaso.
  - `record_transaction(...)` con las mismas columnas que el `insert` de `createTransaction` más `p_transfer_from` y `p_transfer_amount`. Reemplaza ese `insert` solo cuando llega traspaso; sin traspaso, la acción puede seguir con el `insert` directo.
- Tras las migraciones se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos y esquemas:

```ts
// src/features/accounts/schemas.ts
// Se suma a los esquemas de pago, aporte y movimiento
const paymentAccountSchema = z.object({
  account_id: z.string().uuid().optional(),
  transfer_from: z.string().uuid().optional(),
  transfer_amount: amountSchema.optional()
})
// Reglas: transfer_from exige account_id; transfer_from ≠ account_id;
// transfer_amount exige transfer_from.
```

```ts
// src/features/debts/types.ts
type DebtEntryKind = "payment" | "adjustment" | "advance"
```

Reglas de interfaz:

- La sección de cuenta no se muestra al editar un pago, aporte o avance existente: la cuenta se cambia borrando y volviendo a registrar. Editar solo monto, fecha y nota.
- Cambiar monto o fecha de una entrada con `account_id` mueve el saldo de la cuenta solo (se calcula, no se guarda).
- Borrar un pago con traspaso inline borra el pago, no el traspaso. El traspaso es independiente desde que se crea.

## Plan de implementación

1. **Migraciones.**
   - Aplicar `add_debt_entry_advance` y luego `payments_from_accounts` con `supabase db push`; regenerar `src/types/database.ts`.
   - Verificar en la BD:
     - un `advance` en un préstamo falla;
     - `account_id` en una entrada con `transaction_id` falla;
     - `record_debt_payment` con `p_transfer_from` igual a `p_account_id` falla;
     - una cuenta de otro espacio falla por la FK compuesta;
     - `account_balances` y `debt_overview` reflejan pago y avance de una tarjeta.
2. **Esquemas y consultas.**
   - `paymentAccountSchema` en `src/features/accounts/schemas.ts` y extensión de los esquemas de pago, aporte y movimiento.
   - `getDebtEntries` y `getContributions` devuelven el nombre de la cuenta; `src/features/debts/calculations.ts` suma `advance` al saldo.
3. **Sección común de cuenta.**
   - `payment-account-section.tsx` con los tres estados y el cálculo de faltante a partir de `getAccountBalances`.
   - Sin conectarla aún: `pnpm check` pasa.
4. **Deudas.**
   - `PaymentDialog` con tabs Pago / Avance para tarjetas y la sección de cuenta.
   - Acciones `recordPayment` y `recordAdvance` llaman a las RPC nuevas.
   - `debt-entries-list.tsx` muestra "Avance" y el origen o destino de cada fila.
5. **Metas.**
   - `ContributionDialog` con la sección de cuenta; `createContribution` llama a `record_goal_contribution`.
   - `contributions-list.tsx` muestra la cuenta.
6. **Gastos fijos.**
   - `TransactionDialog` suma el traspaso al pagar un gasto; acción con `record_transaction` cuando llega traspaso.
   - La lista de gastos fijos muestra la cuenta del pago.
7. **Movimientos.**
   - `getTransactions` y `transactions-table.tsx` muestran las filas nuevas de `ledger_entries` en gris, de solo lectura, con el filtro "Traspasos" y `?account=`.
8. **Docs.**
   - `docs/producto.md`: sección "Pagos desde cuentas" con las fórmulas de saldo, el efecto nulo en reportes y score y el flujo del traspaso al pagar.
   - `ROADMAP.md` y `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] Las migraciones se aplican sin errores y `src/types/database.ts` incluye `debt_entries.account_id`, `goal_contributions.account_id`, el valor `advance` y las RPC `record_card_advance`, `record_goal_contribution` y `record_transaction`.
- [ ] Pagar 300.000 a una tarjeta "Sin cuenta" baja el saldo de la tarjeta, no cambia ninguna cuenta y el historial dice "Fuera de cuentas".
- [ ] Pagar 300.000 a la tarjeta desde Nequi baja el saldo de la tarjeta y el de Nequi en 300.000, y el historial dice "Desde Nequi".
- [ ] Ese pago aparece en Movimientos en gris y los totales de ingresos y gastos del mes no cambian.
- [ ] Reportes, Presupuestos y el score dan los mismos números antes y después de pagos de tarjeta, avances y aportes con cuenta.
- [ ] Un avance de 200.000 a Nequi sube el saldo de la tarjeta y el de Nequi en 200.000, y no crea ingreso.
- [ ] Un avance "Sin cuenta" solo sube el saldo de la tarjeta.
- [ ] Los tabs Pago y Avance solo existen en tarjetas. En un préstamo no hay avance, ni desde la UI ni llamando a la RPC.
- [ ] Un pago de préstamo con la casilla marcada y cuenta Bancolombia crea el gasto con esa cuenta y baja Bancolombia. Con la casilla desmarcada, la sección de cuenta no se muestra.
- [ ] Un abono de una cuenta por cobrar con ingreso y cuenta Nequi sube Nequi.
- [ ] Un aporte de 100.000 a una meta desde Efectivo baja Efectivo en 100.000 y no crea gasto. Un retiro de 40.000 a Efectivo lo sube en 40.000.
- [ ] Con Nequi en $ 50.000 y un pago de $ 300.000, el diálogo muestra "Nequi tiene $ 50.000. Faltan $ 250.000" y el switch de traspaso arranca encendido.
- [ ] Con el switch encendido, "Desde" propone la cuenta de mayor saldo y el monto del traspaso arranca en $ 300.000 y se puede editar.
- [ ] Pagar con traspaso de 300.000 desde Bancolombia a Nequi crea el traspaso y el pago; Bancolombia baja 300.000, Nequi queda igual (+300.000 −300.000).
- [ ] Si el pago falla (por ejemplo, supera el saldo de la deuda), tampoco queda el traspaso.
- [ ] Traspasar desde la misma cuenta que paga falla en el formulario y en la BD.
- [ ] Con una sola cuenta activa, el diálogo no muestra el switch de traspaso.
- [ ] Marcar un gasto fijo como pagado con traspaso inline crea el traspaso, el gasto enlazado a la ocurrencia con la cuenta elegida, y la ocurrencia pasa a pagada.
- [ ] Una cuenta archivada no aparece en la sección de cuenta y la BD rechaza usarla en una entrada o aporte nuevos.
- [ ] Editar el monto de un pago de tarjeta con cuenta cambia el saldo de la cuenta y el de la tarjeta.
- [ ] Eliminar un pago de tarjeta con cuenta devuelve ambos saldos y deja intacto un traspaso inline.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede usar cuentas de B en pagos, avances o aportes, ni ejecutar las RPC con el espacio de B.
- [ ] Un cliente `anon` no puede ejecutar `record_card_advance`, `record_goal_contribution` ni `record_transaction`.
- [ ] Los pagos y aportes viejos, sin `account_id`, se muestran como "Fuera de cuentas" y los saldos de las cuentas no cambian tras la migración.
- [ ] Las acciones de la hoja móvil de SPEC 15 (Aporte a meta, Pago de deuda o tarjeta) muestran la sección de cuenta.

## Decisiones

- **Sí:** la tarjeta sigue en Deudas. Ya tiene cupo, utilización, vencimientos, proyección y entra al score (SPEC 06 y 07).
- **No:** tarjeta como cuenta de crédito en Cuentas. Obliga a reescribir SPEC 06 y 07 por saldo negativo.
- **Sí:** pago y avance de tarjeta son movimientos entre una cuenta y la tarjeta. Reflejan el capital en las cuentas sin duplicar consumos.
- **Sí:** pagos de tarjeta, avances, aportes y retiros no son ingreso ni gasto. Igual que los traspasos de SPEC 08c; reportes y score no cambian.
- **No:** gasto en "Deudas" al pagar la tarjeta. Duplica las compras que ya son gastos.
- **Sí:** la cuenta es opcional y "Sin cuenta" se muestra como "Fuera de cuentas". Los pagos viejos y los hechos en efectivo no registrado siguen válidos.
- **Sí:** `account_id` directo en `debt_entries` y `goal_contributions`. Sin tabla de movimientos intermedia; el saldo sigue calculado.
- **No:** crear una fila en `transactions` para cada pago de tarjeta o aporte. Habría que filtrarla en cada reporte (decisión ya tomada en SPEC 08c).
- **Sí:** en préstamos y cuentas por cobrar, la cuenta viaja en el movimiento enlazado. Son gasto e ingreso reales; evita contar el saldo de la cuenta dos veces.
- **Sí:** traspaso inline con monto editable, por defecto igual al pago. Cubre el día de pagos del usuario, que a veces traspasa de una vez más de lo que paga.
- **No:** traspaso con monto fijo igual al pago. No deja mover el total del día.
- **Sí:** traspaso y pago en una RPC. Sin traspasos huérfanos si falla el pago.
- **Sí:** el traspaso creado al pagar es independiente después. Borrar o editar el pago no lo toca; se corrige en Movimientos.
- **Sí:** saldo insuficiente solo avisa. El sobregiro es real (SPEC 08c) y bloquear impediría registrar.
- **Sí:** la sección no aparece al editar. Cambiar de cuenta es borrar y registrar de nuevo; evita reescribir traspasos al editar.
- **Sí:** el avance no lleva traspaso. Entra dinero, no hace falta mover fondos antes.
- **Sí:** dos migraciones por el `enum`. Un valor nuevo no se usa en su misma transacción.
- **Sí:** filas de pago, avance y aporte en Movimientos de solo lectura. Se editan donde nacen para no duplicar formularios.

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Olvidar sumar `advance` en una función que calcula el saldo de una deuda             | Se enumeran `debt_overview`, `check_debt_balance` y `score_balances`; criterio de aceptación de saldo y de score |
| Reemplazar `record_debt_payment` rompe a sus llamadores (acción, hoja móvil, import) | Parámetros nuevos con `default null`; se actualizan `database.ts` y las llamadas en el mismo paso                |
| La vista `ledger_entries` crece con tres ramas y `getTransactions` se vuelve lento   | Índices parciales en `account_id`; volumen personal pequeño; se mide en el paso 7                                |
| El usuario cree que un pago de tarjeta "desaparece" de los gastos                    | Texto del diálogo: "Mueve dinero de tu cuenta a la tarjeta. No cuenta como gasto"                                |
| Pagos viejos sin cuenta hacen que los saldos de las cuentas no cuadren               | Esperado; "Actualizar saldo" de SPEC 08c corrige la diferencia                                                   |
| Editar el monto de un pago con traspaso inline deja el traspaso desfasado            | Documentado: el traspaso es independiente; se corrige en Movimientos                                             |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas                   | Los saldos para la sección se cargan con el contexto de acciones rápidas (SPEC 15) o dentro de `Suspense`        |

## Lo que **no** entra en este spec

- Cuota de manejo automática (SPEC 17).
- Tarjeta como cuenta de crédito en Cuentas.
- Compras que suben solas el saldo de la tarjeta.
- Cuentas en Empresa.
- Cuenta por defecto o recordada.
- Sugerencias de traspaso al abrir el mes.
- Importar la cuenta en el SPEC 08b.
- Bloquear pagos por saldo insuficiente.
- Comisión o interés propio del avance.

Cada uno de esos puntos, si llega, va en su propio spec.
