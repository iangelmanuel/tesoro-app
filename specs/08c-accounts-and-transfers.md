# SPEC 08c — Cuentas, métodos de pago y traspasos

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 06, SPEC 08
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario registre sus cuentas y métodos de pago (efectivo, Nequi, Bancolombia…) con su saldo calculado, asigne una cuenta opcional a cada movimiento, registre traspasos entre cuentas propias que no cuentan como ingreso ni gasto, e importe la columna Método del SPEC 08.

## Por qué existe este spec

Hoy un movimiento dice cuánto y en qué, pero no de dónde salió la plata. Quien usa efectivo, Nequi y una cuenta de banco no sabe cuánto tiene en cada una.
El Excel de referencia del SPEC 08 tiene una columna Método y filas "Traspaso" entre cuentas propias. El SPEC 08 las ignora o las manda a "No importar".
El saldo de una cuenta **no se guarda ni se pisa**, igual que en las deudas del SPEC 06: es el saldo inicial más los ingresos, menos los gastos, más o menos los traspasos y más los ajustes.
Los traspasos van en su **propia tabla**. Así `transactions` sigue teniendo solo ingresos y gastos, y reportes, presupuestos y score no cambian.

## Alcance

**Entra:**

- Tabla `accounts` con nombre, tipo (efectivo, banco, billetera digital, otra), ícono, color y saldo inicial. Se archivan y restauran, no se borran.
- Cuenta "Efectivo" sembrada en cada espacio, nuevo o existente.
- Página `/dashboard/personal/accounts` con ítem "Cuentas" en el aside:
  - una tarjeta por cuenta activa con tipo, saldo a hoy (rojo si es negativo) y "Con lo programado: $ X" si hay movimientos futuros;
  - total "Saldo en cuentas";
  - crear, editar, archivar y restaurar; "Actualizar saldo"; "Ver movimientos" (Movimientos filtrado);
  - sección "Archivadas" plegada.
- Columna `transactions.account_id` opcional, con un `select` "Cuenta" en el formulario de movimiento ("Sin cuenta" por defecto).
- Select "Cuenta" en el diálogo de pago de deuda cuando "Registrar como gasto/ingreso" está marcada.
- Tabla `transfers` (origen, destino, monto, fecha, nota), con crear, editar y eliminar.
- Tabla `account_adjustments` para "Actualizar saldo", con eliminar.
- Movimientos muestra en una sola lista los movimientos, los traspasos ("Nequi → Efectivo") y los ajustes ("Ajuste de saldo · Nequi") con estilo neutro, sin sumarlos a los totales.
- Columna "Cuenta" y filtro `?account=` en Movimientos, con "Sin cuenta".
- Tarjeta "Saldo en cuentas" en Resumen.
- Importar: campo `account` (columna Método) en el destino Movimientos, con cada valor mapeado a una cuenta existente, "Crear «valor»" o "Sin cuenta".

**Fuera de alcance (para specs futuros):**

- Tarjetas de crédito como cuentas. Siguen en Deudas (SPEC 06).
- Cuenta en gastos fijos, metas y entradas de deuda.
- Importar traspasos desde el Excel. Las filas "Traspaso" siguen yendo a "No importar".
- Cuenta en los destinos del SPEC 08b.
- Cuenta por defecto o recordar la última usada.
- Saldos de cuentas en el score (factor colchón) o en reportes.
- Monedas distintas por cuenta.
- Conciliación con extractos y conexión con bancos.
- Cuentas en el espacio Empresa.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_accounts_and_transfers.sql`:

```sql
create type public.account_kind as enum ('cash', 'bank', 'wallet', 'other');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind public.account_kind not null,
  icon text not null,  -- clave de CATEGORY_ICONS
  color text not null, -- clave de CATEGORY_COLORS
  opening_balance numeric(14, 2) not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Destino de las FK compuestas
  unique (id, workspace_id)
);

create unique index accounts_unique_name
  on public.accounts (workspace_id, lower(name));

alter table public.transactions
  add column account_id uuid,
  add foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict;

create index transactions_account on public.transactions (account_id)
  where account_id is not null;

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict,
  foreign key (to_account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete restrict
);

create index transfers_workspace_date
  on public.transfers (workspace_id, occurred_on desc, created_at desc);

create table public.account_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  account_id uuid not null,
  amount numeric(14, 2) not null check (amount <> 0), -- > 0 sube el saldo
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  foreign key (account_id, workspace_id)
    references public.accounts (id, workspace_id) on delete cascade
);
```

- `on delete restrict` en las FK a `accounts` no se dispara en la práctica: no hay política de `delete` en `accounts`. Solo cuenta si se borra el espacio, y ahí la cascada viene de `workspaces`.

Saldo de una cuenta (fechas en `America/Bogota`):

```text
saldo = opening_balance
      + Σ ingresos − Σ gastos           (transactions con esa account_id)
      + Σ traspasos entrantes − Σ salientes
      + Σ ajustes
```

- **Saldo a hoy:** solo filas con `occurred_on ≤ hoy`. Es el que se muestra.
- **Con lo programado:** todas las filas. Se muestra solo si difiere del saldo a hoy.
- El saldo puede ser negativo. No hay trigger que lo bloquee.

- **Triggers:**
  - `set_updated_at` (`before update`) en `accounts` y `transfers`.
  - `check_account_active` (`before insert or update` en `transactions`, `transfers` y `account_adjustments`): si la fila nueva usa una cuenta que no usaba antes y esa cuenta está archivada, lanza un error. Editar un movimiento viejo de una cuenta archivada sin cambiar la cuenta sí se permite.
  - `seed_workspace_accounts` (`after insert` en `workspaces`): crea "Efectivo" (`cash`, `banknote`, `emerald`, saldo inicial 0).
- **Backfill** en la misma migración: crea "Efectivo" en cada espacio existente.
- **RLS** activo en las tres tablas: `select`, `insert` y `update` con `is_workspace_owner(workspace_id)` (`using` y `with check`). `delete` en `transfers` y `account_adjustments`. Sin política de `delete` en `accounts`: las cuentas solo se archivan.
- **Vista** `public.ledger_entries` (`with (security_invoker = true)`): `union all` de
  - `transactions` → `kind = type`, `account_id`, `to_account_id = null`, `category_id`, `description`, `note`;
  - `transfers` → `kind = 'transfer'`, `account_id = from_account_id`, `to_account_id`, `category_id = null`, `description = null`, `note`;
  - `account_adjustments` → `kind = 'adjustment'`, `account_id`, `to_account_id = null`, `category_id = null`, `description = null`, `note`.
  - Columnas comunes: `id, workspace_id, kind text, amount, occurred_on, created_at`.
- **RPC** (`security invoker`, `stable`, `search_path = ''`, `grant execute` solo a `authenticated`):
  - `account_balances(p_workspace_id uuid)` devuelve todas las columnas de `accounts` más `balance numeric, scheduled_balance numeric, last_activity_on date`:
    - una fila por cuenta del espacio, activa o archivada;
    - `balance` y `scheduled_balance` según la fórmula de arriba.
- **Cambios en RPC existentes** (se reemplazan con `drop function` + `create function`, porque cambia la firma):
  - `record_debt_payment` (SPEC 06) agrega `p_account_id uuid default null`. Se guarda en el movimiento creado. Se ignora si no se crea movimiento.
  - `import_transactions` (SPEC 08) agrega `p_new_accounts jsonb default '[]'` (`[{ key, name }]`, creadas con `kind = 'other'`, `wallet`, `slate`). Cada fila acepta `account_id | new_account_key`, ambos opcionales.
  - `transaction_totals` (SPEC 02) no cambia: solo suma `transactions`, así los traspasos y ajustes no cuentan como ingreso ni gasto.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos (en `src/features/accounts/types.ts`):

```ts
type AccountKind = Database["public"]["Enums"]["account_kind"]

type AccountWithBalance = AccountRow & {
  balance: number
  scheduled_balance: number
  last_activity_on: string | null
}

type LedgerKind = "income" | "expense" | "transfer" | "adjustment"
```

Etiquetas y valores por defecto de cada tipo (en `src/features/accounts/constants.ts`):

| `kind`   | Etiqueta          | Ícono      | Color     |
| -------- | ----------------- | ---------- | --------- |
| `cash`   | Efectivo          | `banknote` | `emerald` |
| `bank`   | Banco             | `landmark` | `blue`    |
| `wallet` | Billetera digital | `wallet`   | `violet`  |
| `other`  | Otra              | `wallet`   | `slate`   |

- El ícono y el color se pueden cambiar con el `icon-color-picker.tsx` de categorías. Si una clave no existe en `CATEGORY_ICONS` o `CATEGORY_COLORS`, se agrega ahí.

### Movimientos con traspasos y ajustes

- `getTransactions` lee de `ledger_entries` en lugar de `transactions`, con la misma paginación y orden. La categoría y la cuenta se resuelven en memoria con las listas que la página ya carga.
- Filtros (`searchParams` de `/dashboard/personal/transactions`):

| Parámetro  | Valores                         | Efecto en traspasos y ajustes                                                                         |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `type`     | `income`, `expense`, `transfer` | `income`/`expense` los excluyen; `transfer` muestra solo traspasos y ajustes                          |
| `category` | id de categoría                 | Los excluye                                                                                           |
| `account`  | id de cuenta o `none`           | Una cuenta: filas donde es origen o destino. `none`: movimientos sin cuenta, sin traspasos ni ajustes |
| `q`        | texto                           | Busca en `note` (y en `description` de los movimientos)                                               |

- Un valor inválido de `account` cae a "todas", igual que los demás filtros.
- Los totales del encabezado siguen viniendo de `transaction_totals`, filtrados por cuenta si hay `account`.
- Fila de traspaso: ícono `ArrowLeftRight`, "Nequi → Efectivo", monto sin signo, en gris. Editar abre el diálogo de traspaso.
- Fila de ajuste: "Ajuste de saldo · Nequi", monto con signo, en gris. Solo eliminar.

### Actualizar saldo

- El diálogo pide el saldo real. El ajuste es `saldo real − saldo a hoy`, con fecha de hoy y nota opcional.
- Si la diferencia es 0, no crea nada y dice "El saldo ya coincide".

### Importar la columna Método

- Nuevo campo `account` en el destino Movimientos. Encabezados que lo sugieren: método, medio de pago, forma de pago, cuenta.
- El paso 4 (categorías) agrega una sección "Cuentas": cada valor distinto de la columna con su número de filas y un `select` con cuentas activas, "Crear «valor»" y "Sin cuenta".
- Sugerencia: si el valor normalizado coincide con el nombre de una cuenta, se propone esa. Si no, "Crear «valor»" (máximo 40 caracteres). Valor vacío → "Sin cuenta".
- La cuenta no hace omitir filas: no hay "No importar" en esta sección.
- Deshacer una importación no borra las cuentas creadas en ella.

Ejemplo con el Excel de referencia (hoja "Octubre", columna Método con "Nequi", "Efectivo" y "Bancolombia"):

| Valor       | Filas | Destino sugerido               |
| ----------- | ----- | ------------------------------ |
| Efectivo    | n     | Efectivo (existente, sembrada) |
| Nequi       | n     | Crear «Nequi»                  |
| Bancolombia | n     | Crear «Bancolombia»            |

## Plan de implementación

1. **Migración.**
   - `accounts`, `transfers`, `account_adjustments`, `transactions.account_id`, triggers, backfill, RLS, vista `ledger_entries` y `account_balances`.
   - Reemplazar `record_debt_payment` e `import_transactions` con el parámetro nuevo.
   - Aplicarla con `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD:
     - cada espacio existente tiene "Efectivo";
     - un movimiento con una cuenta de otro espacio falla por la FK compuesta;
     - un traspaso de una cuenta a sí misma falla;
     - un traspaso nuevo con una cuenta archivada falla;
     - un usuario A no ve filas de B en `ledger_entries`.
2. **Feature de cuentas.**
   - `src/features/accounts/types.ts`, `constants.ts`, `schemas.ts` (Zod de cuenta, traspaso y ajuste, con `amountSchema`) y `queries.ts` (`getAccountBalances`).
   - `actions.ts` (`"use server"`): crear, editar, archivar y restaurar cuenta; crear, editar y eliminar traspaso; actualizar saldo y eliminar ajuste. Todas con `revalidatePersonalPages()`.
3. **Página de cuentas.**
   - `app/dashboard/personal/accounts/page.tsx` con `buildMetadata` `noindex` y `Suspense`.
   - `src/features/accounts/components/`: `accounts-grid.tsx`, `account-card.tsx`, `account-dialog.tsx`, `transfer-dialog.tsx`, `adjust-balance-dialog.tsx` y `archived-accounts.tsx`.
   - Ítem "Cuentas" (`Wallet`) en `SITE.navigation.personal`, después de Movimientos, y la ruta en `SITE.routes` si las demás se leen de ahí.
4. **Cuenta en el movimiento.**
   - `transaction-dialog.tsx`: `select` "Cuenta" con las cuentas activas y "Sin cuenta". Al editar un movimiento de una cuenta archivada, la muestra como "(archivada)".
   - Schema y acciones de movimientos aceptan `account_id`.
   - Diálogo de pago de deuda: `select` "Cuenta" visible cuando "Registrar como gasto/ingreso" está marcada.
5. **Movimientos con traspasos y ajustes.**
   - `getTransactions` lee `ledger_entries` y aplica la tabla de filtros.
   - `transactions-table.tsx`: columna "Cuenta" y filas de traspaso y ajuste.
   - `transactions-filters.tsx`: filtro de cuenta y opción "Traspasos" en tipo.
   - Botón "Traspaso" en la cabecera de Movimientos.
6. **Resumen.**
   - Tarjeta "Saldo en cuentas" con el total de las cuentas activas y enlace a Cuentas.
7. **Importar Método.**
   - Campo `account` en `types.ts`, `constants.ts` y `targets.ts` (o donde viva la definición de campos del destino Movimientos).
   - Sección "Cuentas" en `categories-step.tsx`, columna "Cuenta" en `preview-step.tsx`.
   - `confirmImport` envía `p_new_accounts` y `account_id | new_account_key` por fila.
8. **Docs.**
   - `docs/producto.md`: sección "Cuentas y traspasos" con el saldo, los tipos y el efecto (ninguno) en reportes y score. Agrega `accounts`, `transfers` y `account_adjustments` a la tabla del modelo de datos.
   - `ROADMAP.md`: respuestas a las preguntas abiertas de "Cuentas y métodos de pago" y su número 08c.
   - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `accounts`, `transfers`, `account_adjustments`, `transactions.account_id`, `ledger_entries` y `account_balances`.
- [ ] Un usuario nuevo y uno existente tienen la cuenta "Efectivo" con saldo $ 0.
- [ ] "Cuentas" aparece en el aside y abre `/dashboard/personal/accounts`.
- [ ] Crear "Nequi" (billetera digital, saldo inicial 200.000) la muestra con $ 200.000. Otra cuenta "nequi" falla con "Ya existe una cuenta con ese nombre".
- [ ] Un gasto de 50.000 en Nequi con fecha de hoy deja el saldo en $ 150.000. Uno de 30.000 con fecha de mañana no cambia el saldo y muestra "Con lo programado: $ 120.000".
- [ ] Un traspaso de 100.000 de Nequi a Efectivo deja Nequi en $ 50.000 y Efectivo en $ 100.000.
- [ ] Ese traspaso aparece en Movimientos como "Nequi → Efectivo" y los totales de ingresos y gastos del mes no cambian.
- [ ] Reportes, Presupuestos y el score dan los mismos números antes y después de registrar traspasos y ajustes.
- [ ] "Actualizar saldo" de Nequi a 40.000 crea un ajuste de −$ 10.000 y deja el saldo en $ 40.000. Con 40.000 de nuevo dice "El saldo ya coincide".
- [ ] Un gasto que deja una cuenta en negativo se guarda y el saldo se ve en rojo.
- [ ] Un traspaso de una cuenta a sí misma falla en el formulario y en la BD.
- [ ] Archivar Nequi la quita de los `select` de movimiento y traspaso, la pasa a "Archivadas" y sus movimientos conservan la cuenta. Restaurarla la devuelve.
- [ ] Editar la descripción de un movimiento de una cuenta archivada funciona sin cambiar la cuenta.
- [ ] `?account=<id de Nequi>` muestra sus movimientos, los traspasos donde es origen o destino y sus ajustes. `?account=none` muestra solo movimientos sin cuenta.
- [ ] `?type=income` no muestra traspasos ni ajustes. `?type=transfer` muestra solo traspasos y ajustes.
- [ ] Un pago de préstamo con "Registrar como gasto" y cuenta Bancolombia crea el gasto con esa cuenta y baja su saldo.
- [ ] Resumen muestra "Saldo en cuentas" con la suma de los saldos de las cuentas activas.
- [ ] Importar la hoja "Octubre" del Excel de referencia con la columna Método mapeada sugiere "Efectivo" para "Efectivo" y "Crear «Nequi»" para "Nequi". Al confirmar, se crea Nequi y sus movimientos quedan en ella.
- [ ] Deshacer esa importación borra los movimientos y deja la cuenta Nequi.
- [ ] Importar sin mapear Método deja los movimientos sin cuenta, como antes del spec.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer, crear ni editar cuentas, traspasos o ajustes de B, ni usar una cuenta de B en sus movimientos.
- [ ] Nadie puede borrar una cuenta con la clave publicable.
- [ ] Un cliente `anon` no puede ejecutar `account_balances` ni leer `ledger_entries`.

## Decisiones

- **Sí:** saldo calculado (inicial + movimientos ± traspasos + ajustes). Igual que las deudas del SPEC 06: nada se pisa y el historial explica cada cambio.
- **No:** saldo manual. Se desactualiza con el primer gasto.
- **Sí:** ajustes como filas propias con "Actualizar saldo". El usuario copia el saldo del banco, no una diferencia.
- **Sí:** traspasos en tabla `transfers`. `transactions` sigue con ingresos y gastos, y ninguna consulta de los SPEC 03 a 07 cambia.
- **No:** tipo `transfer` en `transactions`. Obliga a filtrarlo en cada reporte, presupuesto y factor del score.
- **Sí:** traspasos y ajustes no afectan reportes ni score. No son ingreso ni gasto.
- **No:** usar los saldos en el factor colchón del SPEC 07. Cambia el score de todos y depende de que el usuario registre todas sus cuentas.
- **Sí:** saldo a hoy, con "Con lo programado" aparte. Los gastos programados no han salido de la cuenta.
- **Sí:** saldo negativo permitido. Un sobregiro o un movimiento olvidado es real; bloquear impediría registrar gastos.
- **Sí:** cuenta opcional por movimiento. Los movimientos viejos y los importados sin Método siguen válidos.
- **No:** cuenta por defecto o la última usada. Se decide después de ver el uso.
- **Sí:** semilla "Efectivo" en cada espacio. Casi todos usan efectivo y la página no arranca vacía.
- **Sí:** cuentas solo se archivan. Igual que categorías, deudas y metas; los movimientos no pierden su cuenta.
- **Sí:** tarjetas de crédito fuera de cuentas. Ya son deudas en el SPEC 06 y sus compras son gastos.
- **Sí:** traspasos y ajustes mezclados en Movimientos vía la vista `ledger_entries`. Una sola lista paginada con el orden real.
- **No:** dos consultas mezcladas en el servidor. Rompe la paginación.
- **Sí:** FK compuestas `(account_id, workspace_id)`. La BD garantiza que la cuenta sea del mismo espacio, como en metas y deudas.
- **Sí:** importar solo la columna Método. Una fila "Traspaso" del Excel no trae la cuenta destino.
- **Sí:** cuentas creadas al importar se quedan al deshacer. Igual que las categorías del SPEC 08.
- **Sí:** página propia con ítem en el aside. Los saldos se consultan seguido, a diferencia de las categorías.

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cambiar `getTransactions` a la vista rompe filtros o paginación de Movimientos   | Los criterios de filtros cubren cada parámetro, y `?type=income`/`expense` dan lo mismo que antes             |
| La vista no respeta RLS                                                          | `security_invoker = true` y un criterio prueba que A no ve filas de B                                         |
| Reemplazar `record_debt_payment` e `import_transactions` rompe a quien los llama | Los parámetros nuevos tienen `default`. Se actualizan `src/types/database.ts` y las llamadas en el mismo paso |
| El saldo inicial de las cuentas sembradas no coincide con la realidad            | "Actualizar saldo" visible en cada tarjeta                                                                    |
| Movimientos viejos sin cuenta hacen que los saldos no cuadren                    | Es esperado: los saldos solo cuentan lo asignado. "Actualizar saldo" corrige la diferencia                    |
| `account_balances` lento con muchos movimientos                                  | Índices `transactions_account` y `transfers_workspace_date`. Volumen personal pequeño                         |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas               | La página de cuentas y la tarjeta de Resumen leen dentro de `Suspense`                                        |

## Lo que **no** entra en este spec

- Tarjetas de crédito como cuentas.
- Cuenta en gastos fijos, metas, entradas de deuda y destinos del SPEC 08b.
- Importar traspasos.
- Cuenta por defecto.
- Saldos en el score o en reportes.
- Monedas por cuenta.
- Conciliación y bancos.
- Cuentas en Empresa.

Cada uno de esos puntos, si llega, va en su propio spec.
