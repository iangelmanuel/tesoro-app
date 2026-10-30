# SPEC 08b — Importar gastos fijos, deudas y metas

> **Estado:** Borrador
> **Depende de:** SPEC 04, SPEC 05, SPEC 06, SPEC 08
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario importe gastos fijos, pagos y ajustes de sus deudas y aportes a sus metas desde un `.xlsx` o `.csv`, eligiendo un destino por importación y reutilizando el asistente del SPEC 08.

## Por qué existe este spec

El SPEC 08 importa solo movimientos. Quien trae su historial en una hoja de cálculo también tiene una lista de gastos fijos, los pagos de sus préstamos y lo que ha ahorrado en cada meta.
El motor de lectura (archivo, detección de tablas, varias hojas, fechas y montos) ya existe. Este spec agrega **destinos**: cada uno con sus campos, su normalización, sus duplicados y su RPC.
Cada importación tiene **un solo destino**. Para cargar gastos fijos y aportes del mismo archivo, el usuario corre el asistente dos veces y elige otra tabla.
Las deudas y metas **no se crean** al importar: tienen campos obligatorios (cupo, día de pago, tasa, objetivo) que no vienen en una hoja típica. Se crean antes en su página.

## Alcance

**Entra:**

- Selector de destino en el paso 1 del asistente: Movimientos, Gastos fijos, Deudas y Metas. Se precarga con `?target=`.
- Botón "Importar" en la tab Gastos fijos de Presupuestos, en Deudas y en Metas, cada uno con su `target`.
- **Gastos fijos:** importar definiciones (`recurring_expenses`), con mapeo de categorías igual que el SPEC 08 (solo de gasto, con "Crear" y "No importar").
- **Deudas:** importar pagos y ajustes (`debt_entries`) a deudas activas existentes.
  - Tipo de fila en 3 modos: columna con valores, signo del monto o "todas son pagos".
  - Casilla "Registrar también como gasto/ingreso", desmarcada por defecto, para préstamos y cuentas por cobrar.
- **Metas:** importar aportes y retiros (`goal_contributions`) a metas activas existentes.
  - Tipo de fila en 3 modos: columna con valores, signo del monto o "todos son aportes".
- Deuda o meta por fila: columna opcional cuyos valores se mapean a una existente o a "No importar". Sin columna, se elige una sola para todo el archivo.
- Duplicados por destino, contra la BD y dentro del archivo, desmarcados por defecto.
- Validación del saldo final de cada deuda y meta en la vista previa.
- Columna `imports.target` y `import_id` en `recurring_expenses`, `debt_entries` y `goal_contributions`.
- "Deshacer" por destino, todo o nada, con el motivo si un trigger lo impide.
- Historial con el destino de cada importación.

**Fuera de alcance (para specs futuros):**

- Varios destinos en una misma importación.
- Crear deudas o metas desde el asistente.
- Enlazar movimientos existentes a ocurrencias de gastos fijos (pagos de gastos fijos).
- Importar presupuestos.
- Cuentas, métodos de pago y traspasos (SPEC 08c).
- Recordar el mapeo entre importaciones.
- Preseleccionar una deuda o meta desde su Sheet (`?debt=`, `?goal=`).
- Editar filas en la vista previa.
- Importar en el espacio Empresa.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_import_recurring_debts_and_goals.sql`:

```sql
create type public.import_target as enum (
  'transactions', 'recurring_expenses', 'debt_entries', 'goal_contributions'
);

alter table public.imports
  add column target public.import_target not null default 'transactions';

alter table public.recurring_expenses
  add column import_id uuid references public.imports (id) on delete set null;
alter table public.debt_entries
  add column import_id uuid references public.imports (id) on delete set null;
alter table public.goal_contributions
  add column import_id uuid references public.imports (id) on delete set null;

create index recurring_expenses_import on public.recurring_expenses (import_id)
  where import_id is not null;
create index debt_entries_import on public.debt_entries (import_id)
  where import_id is not null;
create index goal_contributions_import on public.goal_contributions (import_id)
  where import_id is not null;
```

- Las importaciones existentes quedan con `target = 'transactions'`.
- **RPC nuevas** (`security definer`, `search_path = ''`, `volatile`). Cada una valida al inicio que `is_workspace_owner` se cumpla para el espacio, rechaza más de 2.000 filas y crea la fila de `imports` con su `target`. `grant execute` solo a `authenticated`. Todo en una transacción:
  - `import_recurring_expenses(p_workspace_id uuid, p_filename text, p_sheets text[], p_stats jsonb, p_new_categories jsonb, p_rows jsonb) returns uuid`:
    - inserta las categorías nuevas igual que `import_transactions` (solo `expense`, `receipt`/`slate`);
    - inserta `[{ name, amount, category_id | new_category_key, frequency, day_of_month, month_of_year, starts_on, ends_on }]` con `is_active = true` e `import_id`;
    - el trigger `check_expense_category` del SPEC 04 sigue aplicando.
  - `import_debt_entries(p_workspace_id uuid, p_filename text, p_sheets text[], p_stats jsonb, p_create_transactions boolean, p_rows jsonb) returns uuid`:
    - filas `[{ debt_id, kind, amount, occurred_on, note }]`; `amount` con signo solo en ajustes;
    - verifica que cada `debt_id` sea del espacio;
    - inserta primero las filas que suben el saldo (ajustes > 0) y luego las que lo bajan (pagos y ajustes < 0), cada grupo por `occurred_on`. Así `check_debt_balance` no falla en un estado intermedio si el saldo final es ≥ 0;
    - con `p_create_transactions`, para cada pago de un `loan` o `receivable` crea el movimiento igual que `record_debt_payment` ("Pago <nombre>" en "Deudas" o "Abono <nombre>" en "Cobros") y lo enlaza en `transaction_id`. Nunca en tarjetas;
    - los triggers `check_debt_entry` y `check_debt_balance` del SPEC 06 siguen aplicando.
  - `import_goal_contributions(p_workspace_id uuid, p_filename text, p_sheets text[], p_stats jsonb, p_rows jsonb) returns uuid`:
    - filas `[{ goal_id, amount, occurred_on, note }]`; `amount` > 0 aporte, < 0 retiro;
    - verifica que cada `goal_id` sea del espacio;
    - inserta primero los aportes y luego los retiros, cada grupo por `occurred_on`;
    - los triggers `check_goal_contribution` y `check_goal_balance` del SPEC 05 siguen aplicando.
- **`undo_import` cambia** (misma firma). Según `target` borra de `transactions`, `recurring_expenses`, `debt_entries` o `goal_contributions` las filas con ese `import_id`:
  - en `debt_entries`, el trigger `sync_debt_entry_transaction` borra también los movimientos enlazados;
  - en `recurring_expenses`, los movimientos que pagaban esas ocurrencias quedan sin enlace (`on delete set null`);
  - si un trigger lo impide (deuda pagada o archivada, meta archivada o cumplida, saldo negativo), la excepción revierte todo y el import sigue `completed`.
- Las candidatas a duplicado se leen con `select` normales, que respetan RLS. No hacen falta RPC nuevas para eso.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos (en `src/features/imports/types.ts`):

```ts
type ImportTarget = Database["public"]["Enums"]["import_target"]

type ImportField =
  | /* los del SPEC 08 */ "date"
  | "amount"
  | "type"
  | "income_amount"
  | "expense_amount"
  | "category"
  | "description"
  | "note"
  | "name"
  | "frequency"
  | "day_of_month"
  | "month_of_year"
  | "starts_on"
  | "ends_on"
  | "entry_type"
  | "debt"
  | "goal"

type EntryTypeMode = "column" | "sign" | "all" // valores, signo, todas iguales

type DebtEntryTarget = "payment" | "charge" | "decrease" | "skip"
type GoalEntryTarget = "contribution" | "withdrawal" | "skip"

type LinkTarget = { kind: "existing"; id: string } | { kind: "skip" } // deuda o meta

type PreviewRow = {
  // igual que SPEC 08, con value según el destino:
  value?:
    | TransactionValue
    | {
        name: string
        amount: number
        categoryKey: string
        frequency: "monthly" | "yearly"
        day_of_month: number
        month_of_year: number | null
        starts_on: string
        ends_on: string | null
      }
    | {
        debtId: string
        kind: "payment" | "adjustment"
        amount: number
        occurred_on: string
        note: string | null
      }
    | {
        goalId: string
        amount: number
        occurred_on: string
        note: string | null
      }
}
```

- `charge` → ajuste con monto positivo (sube el saldo). `decrease` → ajuste con monto negativo.
- `ImportStats` no cambia.

### Campos por destino

En `src/features/imports/targets.ts`, una definición por destino: campos, cuáles son obligatorios, sinónimos de encabezado y la etiqueta en plural para el historial.

| Destino      | Campo           | Obligatorio            | Encabezados que lo sugieren                |
| ------------ | --------------- | ---------------------- | ------------------------------------------ |
| Gastos fijos | `name`          | Sí                     | nombre, gasto, concepto, descripción       |
|              | `amount`        | Sí                     | monto, valor, importe, cuota               |
|              | `category`      | No                     | categoría, rubro                           |
|              | `frequency`     | No                     | frecuencia, periodicidad                   |
|              | `day_of_month`  | Este o `starts_on`     | día, día de pago, vence                    |
|              | `month_of_year` | No                     | mes                                        |
|              | `starts_on`     | Este o `day_of_month`  | inicio, desde, fecha                       |
|              | `ends_on`       | No                     | fin, hasta                                 |
| Deudas       | `date`          | Sí                     | fecha, date, día                           |
|              | `amount`        | Sí                     | monto, valor, pago, abono                  |
|              | `entry_type`    | Solo en modo `column`  | tipo, movimiento, concepto                 |
|              | `debt`          | No (si no, deuda fija) | deuda, tarjeta, préstamo, crédito, entidad |
|              | `note`          | No                     | nota, descripción, detalle, observación    |
| Metas        | `date`          | Sí                     | fecha, date, día                           |
|              | `amount`        | Sí                     | monto, valor, aporte                       |
|              | `entry_type`    | Solo en modo `column`  | tipo, movimiento                           |
|              | `goal`          | No (si no, meta fija)  | meta, objetivo, ahorro                     |
|              | `note`          | No                     | nota, descripción, detalle, observación    |

### Normalización por destino

Fechas y montos usan las mismas reglas del SPEC 08 (`normalize.ts`). Lo nuevo va en `src/features/imports/normalize-recurring.ts`, `normalize-debt-entries.ts` y `normalize-goal-contributions.ts`.

**Gastos fijos:**

| Campo      | Regla                                                                                                                                                          | Error si falla               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Nombre     | Texto recortado. Más de 60 caracteres se recorta y se avisa                                                                                                    | "Falta el nombre"            |
| Monto      | Valor absoluto > 0 y ≤ `MAX_AMOUNT`                                                                                                                            | "Monto inválido"             |
| Frecuencia | Cada valor distinto se mapea a mensual, anual u "Omitir fila" (sugerencia: mensual, mes, monthly → mensual; anual, año, yearly → anual). Sin columna → mensual | —                            |
| Día        | Entero 1–31. Sin columna → día de `starts_on`                                                                                                                  | "Día inválido"               |
| Mes        | Entero 1–12 o nombre del mes en español. Solo para anual. Sin columna → mes de `starts_on`                                                                     | "Falta el mes" (anual)       |
| Inicio     | Fecha. Sin columna → primer día del mes actual en `America/Bogota`                                                                                             | "Fecha de inicio inválida"   |
| Fin        | Fecha opcional, ≥ inicio                                                                                                                                       | "El fin es antes del inicio" |
| Categoría  | Cada valor de origen se mapea (solo categorías de gasto). Sin columna → "Otros gastos"                                                                         | —                            |

- El paso de columnas no deja avanzar si no se mapeó ni `day_of_month` ni `starts_on`.

**Deudas:**

| Campo | Regla                                                                                                                                                                                                                                                      | Error si falla     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Fecha | Como el SPEC 08, y además ≤ hoy en `America/Bogota`                                                                                                                                                                                                        | "Fecha futura"     |
| Tipo  | `column`: cada valor se mapea a Pago, Cargo (sube el saldo), Ajuste a la baja u "Omitir fila" (sugerencia: pago, abono, payment → Pago; compra, cargo, interés, cuota de manejo → Cargo). `sign`: negativo → Pago, positivo → Cargo. `all`: todas son Pago | "Tipo desconocido" |
| Monto | Valor absoluto > 0 y ≤ `MAX_AMOUNT`. El signo lo pone el tipo                                                                                                                                                                                              | "Monto inválido"   |
| Deuda | Con columna: cada valor distinto se mapea a una deuda activa o "No importar" (sugerencia por nombre normalizado igual). Sin columna: la deuda elegida en el paso de columnas                                                                               | —                  |
| Nota  | Opcional. Más de 120 caracteres se recorta                                                                                                                                                                                                                 | —                  |

**Metas:**

| Campo | Regla                                                                                                                                                                           | Error si falla     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Fecha | Como el SPEC 08, y además ≤ hoy en `America/Bogota`                                                                                                                             | "Fecha futura"     |
| Tipo  | `column`: cada valor se mapea a Aporte, Retiro u "Omitir fila" (sugerencia: aporte, ahorro, depósito → Aporte; retiro, saca → Retiro). `sign`: negativo → Retiro. `all`: Aporte | "Tipo desconocido" |
| Monto | Valor absoluto > 0 y ≤ `MAX_AMOUNT`. Retiro → negativo                                                                                                                          | "Monto inválido"   |
| Meta  | Igual que Deuda, con metas activas                                                                                                                                              | —                  |
| Nota  | Opcional. Más de 120 caracteres se recorta                                                                                                                                      | —                  |

- Las deudas pagadas o archivadas y las metas cumplidas o archivadas no aparecen como destino.
- Si no hay ninguna deuda (o meta) activa, el selector de destino la muestra deshabilitada con "Primero crea una deuda" (o "una meta") y un enlace a su página.

### Saldos en la vista previa

- Deudas: por cada deuda con filas marcadas, se muestra saldo actual → saldo resultante (`saldo + Σ cargos − Σ pagos − Σ ajustes a la baja`).
- Metas: por cada meta, ahorrado actual → ahorrado resultante.
- Si alguno queda < 0, el botón de importar se deshabilita con "El saldo de «X» quedaría en −$ N". El usuario desmarca filas hasta corregirlo.

### Duplicados

| Destino      | Clave                                                         | Compara contra                                            |
| ------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| Gastos fijos | nombre normalizado                                            | todos los `recurring_expenses` del espacio (activos o no) |
| Deudas       | `debt_id \| payment o adjustment \| monto con signo \| fecha` | `debt_entries` de esas deudas en `[min fecha, max fecha]` |
| Metas        | `goal_id \| monto con signo \| fecha`                         | `goal_contributions` de esas metas en el mismo rango      |

- Normalizar el nombre es lo mismo que la descripción del SPEC 08: minúsculas, sin tildes y espacios colapsados.
- También se compara contra filas anteriores del mismo archivo. Los mensajes siguen el formato del SPEC 08.

### Pasos del asistente por destino

- Los pasos 1 (archivo + selector de destino), 2 (tabla) y 6 (resumen, con la etiqueta del destino) son iguales en todos.

| Paso | Movimientos  | Gastos fijos                     | Deudas                                        | Metas                           |
| ---- | ------------ | -------------------------------- | --------------------------------------------- | ------------------------------- |
| 3    | Columnas     | Columnas + valores de frecuencia | Columnas + modo de tipo + deuda fija          | Columnas + modo + meta fija     |
| 4    | Categorías   | Categorías                       | Deudas (solo con columna `debt`)              | Metas (solo con columna `goal`) |
| 5    | Vista previa | Vista previa                     | Vista previa + saldos + casilla de movimiento | Vista previa + saldos           |

- Cambiar el destino en el paso 1 reinicia el mapeo.
- El paso 4 se salta si no aplica.
- La casilla "Registrar también como gasto/ingreso" solo aparece si alguna fila marcada va a un préstamo o una cuenta por cobrar. Su texto aclara: "Desmárcala si ya importaste estos pagos como movimientos".

### Ejemplo

CSV `pagos-credito.csv` con `;` y una sola deuda (préstamo "Crédito moto", saldo 4.000.000), modo `all`, deuda fija "Crédito moto":

| Fila | Fecha      | Valor   | Estado                                |
| ---- | ---------- | ------- | ------------------------------------- |
| 2    | 05/08/2026 | 350.000 | Lista                                 |
| 3    | 05/09/2026 | 350.000 | Lista                                 |
| 4    | 05/09/2026 | 350.000 | Duplicada de la fila 3                |
| 5    | 05/12/2026 | 350.000 | Error "Fecha futura" (hoy 30/10/2026) |

Saldo de "Crédito moto": $ 4.000.000 → $ 3.300.000. Sin la casilla, no se crea ningún movimiento.

## Plan de implementación

1. **Migración.**
   - Enum `import_target`, columna `imports.target`, columnas `import_id`, las tres RPC nuevas y el cambio de `undo_import`.
   - Aplicarla con `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD:
     - `import_debt_entries` con un `debt_id` de otro espacio falla sin dejar `imports` ni entradas;
     - un retiro mayor que lo ahorrado hace fallar `import_goal_contributions` sin dejar nada;
     - `undo_import` de un import de aportes a una meta archivada falla y el import queda `completed`.
2. **Destinos y tipos.**
   - `src/features/imports/targets.ts` con la definición de cada destino y la tabla de campos.
   - Ampliar `types.ts` y `constants.ts` (sinónimos de frecuencia, tipo de deuda y tipo de meta, meses en español).
   - Pasar `target` por `wizard-state.ts` con `transactions` por defecto. El flujo de movimientos no cambia.
3. **Normalización y duplicados.**
   - `normalize-recurring.ts`, `normalize-debt-entries.ts` y `normalize-goal-contributions.ts`: funciones puras de las tablas anteriores.
   - Claves nuevas en `duplicates.ts`.
   - Cálculo de saldos resultantes en `src/features/imports/balances.ts`.
4. **Acciones y consultas.**
   - `schemas.ts`: Zod por destino. Reutiliza los límites de los schemas de los SPEC 04, 05 y 06.
   - `actions.ts`:
     - `getDuplicateCandidates` recibe el `target`;
     - `confirmRecurringImport`, `confirmDebtEntriesImport` y `confirmGoalContributionsImport` revalidan, llaman a su RPC y a `revalidatePersonalPages()`;
     - `undoImport` traduce los errores de trigger a un mensaje con el nombre de la deuda o meta.
   - `queries.ts`: deudas activas con saldo y metas activas con ahorrado, para los selectores y los saldos.
5. **Paso 1 y paso 3.**
   - `file-step.tsx`: selector de destino, leído de `?target=` (valor inválido → `transactions`), con los destinos deshabilitados si no hay deudas o metas activas.
   - `columns-step.tsx`: campos según el destino, modo de tipo, valores de frecuencia o de tipo y la deuda o meta fija.
6. **Paso 4.**
   - `link-step.tsx`: cada valor de la columna `debt` o `goal` con su número de filas y un `select` (activas y "No importar").
   - `categories-step.tsx` filtra a categorías de gasto en gastos fijos.
7. **Pasos 5 y 6.**
   - `preview-step.tsx`: columnas según el destino, bloque de saldos y la casilla de movimiento.
   - `summary-step.tsx`: etiqueta del destino y enlace a su página.
8. **Historial.**
   - `import-history.tsx`: columna de destino y confirmación de deshacer con "N gastos fijos", "N pagos y ajustes" o "N aportes y retiros".
   - En deudas con movimientos creados, la confirmación avisa que también se borran esos movimientos.
9. **Entradas.**
   - Botón "Importar" en la tab Gastos fijos de `app/dashboard/personal/budgets`, en `app/dashboard/personal/debts` y en `app/dashboard/personal/goals`, con su `?target=`.
10. **Docs.**
    - `docs/producto.md`: sección "Importar" con los destinos, campos y duplicados.
    - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 08b.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `import_target`, `imports.target`, los tres `import_id` y las tres RPC nuevas.
- [ ] Las importaciones previas al spec aparecen en el historial como "Movimientos" y su "Deshacer" sigue funcionando.
- [ ] Importar movimientos da exactamente el mismo resultado que antes del spec.
- [ ] `/dashboard/personal/import?target=goal_contributions` abre con "Metas" elegido. `?target=foo` abre con "Movimientos".
- [ ] El botón "Importar" de Gastos fijos, Deudas y Metas abre el asistente con su destino.
- [ ] Sin deudas activas, "Deudas" aparece deshabilitado con "Primero crea una deuda" y enlace a Deudas. Igual con Metas.
- [ ] Gastos fijos: el paso de columnas no avanza sin `day_of_month` ni `starts_on`.
- [ ] Gastos fijos: una fila con solo inicio `15/03/2026` y frecuencia anual queda con día 15, mes 3 e inicio 2026-03-15.
- [ ] Gastos fijos: una fila con solo día 5 queda con inicio el primer día del mes actual.
- [ ] Gastos fijos: una fila anual sin mes ni inicio queda en error con "Falta el mes".
- [ ] Gastos fijos: un nombre igual a uno existente, sin distinguir mayúsculas ni tildes, aparece como "Posible duplicado", desmarcado.
- [ ] Gastos fijos: una categoría "Crear «Gimnasio»" crea la categoría de gasto y el gasto fijo queda en ella.
- [ ] Gastos fijos importados aparecen en la tab Gastos fijos con sus ocurrencias y suman al comprometido de Presupuestos.
- [ ] Deudas: el ejemplo de la sección "Ejemplo" da exactamente esos estados y el saldo final de $ 3.300.000.
- [ ] Deudas: en modo signo, `-200000` es un Pago y `80000` un Cargo que sube el saldo.
- [ ] Deudas: con la columna `debt`, un valor mapeado a "No importar" deja sus filas como omitidas.
- [ ] Deudas: si el saldo resultante de una deuda es negativo, el botón de importar está deshabilitado con el mensaje del saldo.
- [ ] Deudas: con la casilla marcada, cada pago a un préstamo crea su gasto "Pago <nombre>" en "Deudas", enlazado. Desmarcada, no crea movimientos.
- [ ] Deudas: la casilla no aparece si todas las filas van a tarjetas.
- [ ] Metas: en modo signo, `-50000` es un retiro. Un retiro que deja el ahorrado en negativo bloquea la importación.
- [ ] Metas: un archivo con un retiro anterior a los aportes del mismo archivo se importa bien si el ahorrado final es ≥ 0.
- [ ] Deudas y metas: una fila con fecha posterior a hoy queda en error con "Fecha futura".
- [ ] Confirmar crea la fila de `imports` con su `target`, y las filas del destino con su `import_id`.
- [ ] Si la RPC falla, no queda ni la fila de `imports` ni ninguna fila del destino ni movimientos creados.
- [ ] Tras importar, Presupuestos, Deudas, Metas, Resumen, Reportes y Recomendaciones reflejan los cambios sin recargar a mano.
- [ ] Deshacer un import de deudas con movimientos creados borra las entradas y sus movimientos.
- [ ] Deshacer un import de aportes de una meta archivada falla con un mensaje que nombra la meta, y el import sigue "Completado".
- [ ] Un usuario A no puede llamar `import_recurring_expenses`, `import_debt_entries` ni `import_goal_contributions` sobre el espacio de B, ni con una deuda o meta de B dentro de su propio espacio.
- [ ] Un cliente `anon` no puede ejecutar las tres RPC nuevas.

## Decisiones

- **Sí:** un destino por importación. Reutiliza el flujo de 6 pasos casi sin cambios y cada RPC escribe en una sola tabla.
- **No:** varios destinos en una pasada. Multiplica el estado del asistente y deja una RPC que escribe en cuatro tablas.
- **Sí:** deudas y metas solo existentes. Tienen campos obligatorios que una hoja típica no trae.
- **No:** crear metas desde el asistente aunque pidan pocos campos. Mantiene la regla igual para los dos destinos.
- **Sí:** deuda o meta por columna opcional, o una fija para todo el archivo. Cubre el extracto de una tarjeta y una hoja con todas las metas.
- **Sí:** gastos fijos como definiciones. Sus pagos ya entran como movimientos con el SPEC 08.
- **No:** enlazar movimientos a ocurrencias. Emparejar por fecha y monto es otro problema y se equivoca fácil.
- **Sí:** deudas con pagos y ajustes (Cargo y Ajuste a la baja). Las compras con tarjeta siguen siendo gastos del SPEC 08, pero los intereses y cargos de un extracto sí suben el saldo.
- **Sí:** 3 modos de tipo con "todas son pagos" o "todos son aportes". Un archivo de pagos de un crédito no trae columna de tipo.
- **Sí:** casilla de movimiento desmarcada por defecto. Quien ya importó sus movimientos con el SPEC 08 contaría el pago dos veces.
- **No:** casilla en tarjetas. Igual que el SPEC 06: el pago de tarjeta no es gasto.
- **Sí:** el saldo final se valida en la vista previa y la RPC ordena las inserciones (primero lo que suma). El trigger de saldo revisa fila a fila y fallaría por orden, no por datos.
- **Sí:** deshacer todo o nada, con el motivo. Igual que el SPEC 08; un estado "Deshecho parcial" complica el historial.
- **Sí:** duplicado de gasto fijo por nombre. Dos gastos fijos con el mismo nombre casi siempre son el mismo.
- **Sí:** las candidatas a duplicado se leen con `select` normales. RLS ya filtra por espacio y no hace falta una RPC por tabla.
- **Sí:** misma página con selector y `?target=`. Un solo asistente y entradas desde cada página.
- **No:** rutas separadas por destino. Más páginas con el mismo contenido.

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                                    |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Refactorizar el asistente rompe la importación de movimientos                           | `transactions` es el destino por defecto y un criterio exige el mismo resultado que antes                                     |
| Pagos importados como movimientos (SPEC 08) y además como pagos de deuda con movimiento | Casilla desmarcada por defecto, con el texto "Desmárcala si ya importaste estos pagos como movimientos"                       |
| El saldo de una deuda o meta cambia entre la vista previa y la confirmación             | El trigger de saldo revisa en la RPC; si falla, no queda nada y se muestra el error                                           |
| Deshacer gastos fijos deja movimientos que pagaban sus ocurrencias sin enlace           | La confirmación de deshacer lo avisa. Los movimientos no se borran                                                            |
| Deshacer bloqueado por una deuda pagada o una meta cumplida                             | El mensaje nombra la deuda o meta y dice qué hacer (reactivarla)                                                              |
| `security definer` salta RLS si la verificación falla                                   | Cada RPC verifica `is_workspace_owner` y que cada `debt_id`/`goal_id` sea del espacio, y un criterio prueba el acceso cruzado |
| Nombres de meses o frecuencias en otro idioma                                           | Valores de frecuencia mapeables a mano; meses en número o en español                                                          |

## Lo que **no** entra en este spec

- Varios destinos en una importación.
- Crear deudas o metas desde el asistente.
- Enlazar movimientos a ocurrencias de gastos fijos.
- Importar presupuestos.
- Cuentas, métodos de pago y traspasos (SPEC 08c).
- Recordar el mapeo.
- Preseleccionar una deuda o meta desde su Sheet.
- Editar filas en la vista previa.
- Importar en Empresa.

Cada uno de esos puntos, si llega, va en su propio spec.
