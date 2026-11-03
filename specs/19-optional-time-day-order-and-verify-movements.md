# SPEC 20 — Hora opcional, orden manual dentro del día y Verificar movimientos

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 08c, SPEC 16, SPEC 18
> **Fecha:** 2026-11-03
> **Objetivo:** Que cada movimiento pueda guardar una hora opcional, que el usuario reordene a mano los movimientos del mismo día, y que una modal "Verificar movimientos" liste todo el historial en formato compacto para compararlo contra el extracto del banco.

## Por qué existe este spec

El usuario registra pagos futuros y después ocurre un movimiento anterior: el orden de la lista no coincide con el del banco y el historial "se descuadra". Hoy el orden es `occurred_on desc, created_at desc`, y `created_at` es el momento de captura, no el del hecho. No hay forma de corregirlo sin cambiar la fecha.

Hacen falta tres piezas que se apoyan entre sí:

1. **Hora opcional** en todo evento con fecha, para dejar constancia exacta cuando el usuario la conoce.
2. **Orden manual dentro del día**, que nunca cruza días: mover una fila no cambia su fecha.
3. **Verificar movimientos**, una vista de solo lectura sin filtro mensual, pensada para recorrer el historial largo y cotejarlo con el banco.

Este spec es el primero de tres que salen del mismo pedido. Los otros dos quedan fuera (ver "Fuera de alcance"): **SPEC 21** (movimientos como fuente de verdad: borrar el movimiento deja la deuda o el gasto fijo como pendiente) y **SPEC 22** (metas como billetera, con cuenta obligatoria y pagos desde metas).

## Alcance

**Entra:**

- **Hora opcional (`occurred_time`)** en los eventos con fecha de usuario:
  - `transactions`, `transfers`, `account_adjustments`, `debt_entries` y `goal_contributions`;
  - la hora es la hora local del usuario (misma convención que `occurred_on`, zona `America/Bogota`); no hay conversión de zona;
  - sin hora el comportamiento es idéntico al de hoy;
  - un gasto fijo pagado hereda la hora del movimiento que lo paga (no tiene hora propia);
  - **no llevan hora:** presupuestos (son por mes), la plantilla del gasto fijo, la fecha objetivo de una meta, la fecha de vencimiento de una deuda y la fecha de inicio de una deuda.
- **Campo de hora en los diálogos** que ya tienen fecha de evento: movimiento, traspaso, ajuste de saldo de cuenta, pago/avance de deuda, ajuste de saldo de deuda, aporte/retiro de meta.
  - Nuevo `TimePickerField` (`src/components/forms/time-picker-field.tsx`), hermano de `DatePickerField`, sobre el `TimeField` de HeroUI.
  - Trabaja con `HH:MM` o `""` (sin hora). Etiqueta "Hora (opcional)".
  - Se puede borrar la hora una vez puesta.
  - Va en la misma fila que la fecha en `>= 768 px` y debajo en móvil.
- **Mostrar la hora** donde se muestra la fecha del evento, solo si existe: tabla de Movimientos, tarjetas móviles, historial de pagos de deuda y de aportes de meta, lista de ajustes. Formato `3:05 p. m.` (locale `es-CO`) en `formatTime` de `src/libs/format.ts`, con espacio duro como los demás formateadores.
- **Orden manual dentro del día (`day_position`)**:
  - columna `day_position integer not null default 0` en las cinco tablas de evento;
  - orden de la lista y de Verificar: `occurred_on desc, day_position asc, created_at desc, id`;
  - una fila nueva entra con `day_position = 0` y queda arriba de su día (igual que hoy, donde lo más reciente va primero);
  - mover una fila reasigna `day_position = 1..n` a todas las filas de ese día de ese espacio;
  - la hora **no** reordena sola: es información. El orden lo manda `day_position`;
  - **solo dentro del mismo día.** Mover nunca cambia `occurred_on`; no existe la acción de mover a otro día;
  - cambiar la fecha de una fila (`occurred_on`) reinicia su `day_position` a 0 en la base de datos (trigger), así llega arriba del día nuevo.
- **UI de reordenar en `transactions-table.tsx` y en las tarjetas móviles**:
  - botones **↑ / ↓** en cada fila (accesibles, 44 px táctiles en móvil); ↑ y ↓ intercambian con la fila vecina **del mismo día**;
  - **arrastre en escritorio** (`>= 768 px`), solo dentro del mismo día; soltar fuera del día no hace nada;
  - un día con una sola fila visible no muestra controles; la primera fila de un día no muestra ↑, la última no muestra ↓;
  - `useOptimistic`: la fila se mueve al instante y se revierte con un toast si el servidor falla;
  - los controles aparecen solo con permiso de escritura (`requireWritableWorkspace`), y no mientras el orden sea ambiguo, es decir con la búsqueda de texto activa. Con filtros de tipo, categoría o cuenta sí funcionan: la fila se coloca en la posición de la fila vecina visible.
  - se reordenan todas las filas de la lista unificada, incluidos traspasos, ajustes, pagos de tarjeta, avances y aportes con cuenta (las filas grises de SPEC 16): el orden es de la lista, no de la tabla de origen.
- **RPC `move_ledger_entry(p_workspace_id uuid, p_kind text, p_id uuid, p_target_kind text, p_target_id uuid)`**:
  - `security invoker`, `search_path = ''`, `grant execute` solo a `authenticated`;
  - exige que ambas filas existan, sean del espacio y tengan el mismo `occurred_on`; si no, error;
  - arma el orden completo del día (las cinco tablas), saca la fila y la coloca en la posición de la fila objetivo, y escribe `day_position = 1..n` en una sola transacción;
  - respeta RLS y `is_workspace_writable`.
- **Verificar movimientos (modal)**:
  - botón **Verificar** en la barra de la página de Movimientos (Personal y Empresa);
  - modal con scroll interno y botón **Cargar más** (páginas de 50 filas, `range` sobre `ledger_entries`, sin `count: exact`);
  - **sin filtro mensual**: arranca desde lo más reciente y sigue hacia atrás sin importar el mes;
  - **selector de cuenta** opcional (solo Personal), para cotejar contra el extracto de una cuenta; "Todas" por defecto; con una cuenta elegida, los traspasos muestran el signo respecto de esa cuenta;
  - cada fila es compacta, de una o dos líneas: icono de flecha, fecha y hora (si hay), cuenta, monto, descripción y nota;
  - **flecha verde ↑** ingreso y avance de tarjeta; **flecha roja ↓** gasto, pago de tarjeta y aporte a meta; **flecha gris ⇄** traspaso (muestra "Origen → Destino") y ajuste de saldo; el retiro de una meta se pinta como ingreso para la cuenta (verde). El color sale de los tokens `--income`, `--expense` y un neutro, nunca de la paleta cruda;
  - la flecha no es el único portador del significado: cada fila lleva texto accesible ("Ingreso", "Gasto", "Traspaso", "Ajuste") y el monto con signo;
  - solo lectura: no hay editar, borrar ni reordenar en la modal;
  - en móvil es una hoja a pantalla completa con la misma lista;
  - misma regla de orden que la tabla, incluido `day_position`.
- **Documentación:** `docs/producto.md` (sección Movimientos: hora, orden del día y Verificar), `docs/ui.md` (patrón de `TimePickerField` y controles de orden), `CLAUDE.md` si cambia alguna convención, `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- **SPEC 21:** movimientos como fuente de verdad (borrar un movimiento de pago deja la deuda o el gasto fijo como pendiente; las filas grises de pago, avance y aporte se vuelven eliminables desde Movimientos).
- **SPEC 22:** metas como billetera (cuenta obligatoria en la meta, retiros a cuenta o sin cuenta, pagar desde el saldo de una meta, modelo de saldo que viaja entre billeteras).
- Mover un movimiento a otro día arrastrando o con las flechas.
- Orden automático por hora.
- Marcar filas como "verificadas" o conciliadas con el banco (sin columna `verified_at`).
- Importar un extracto bancario y compararlo automáticamente.
- Hora en presupuestos, en la plantilla del gasto fijo, en fechas objetivo o de vencimiento.
- Hora en el asistente de importación (SPEC 08): las filas importadas entran sin hora.
- Validar que la hora no sea futura. La regla "la fecha no puede ser futura" de los pagos se mantiene solo para la fecha.

## Modelo de datos

Una migración, `supabase/migrations/<timestamp>_add_time_and_day_order.sql`:

```sql
alter table public.transactions
  add column occurred_time time,
  add column day_position integer not null default 0;
alter table public.transfers
  add column occurred_time time,
  add column day_position integer not null default 0;
alter table public.account_adjustments
  add column occurred_time time,
  add column day_position integer not null default 0;
alter table public.debt_entries
  add column occurred_time time,
  add column day_position integer not null default 0;
alter table public.goal_contributions
  add column occurred_time time,
  add column day_position integer not null default 0;
```

- `occurred_time` sin zona horaria, nulo cuando el usuario no la pone. Sin índice: nunca filtra.
- `day_position` no necesita índice propio: el orden se resuelve dentro de un `occurred_on` ya filtrado. Se revisa con `explain` en el paso 1 y, si el orden por `(workspace_id, occurred_on desc)` ya lo cubre, no se agrega nada.
- **Trigger `reset_day_position`** (`before update` en las cinco tablas): si cambia `occurred_on`, deja `new.day_position = 0`.
- **`ledger_entries` se reemplaza** (`create or replace view`) agregando al **final** de la lista de columnas `occurred_time` y `day_position`, porque `create or replace view` solo permite agregar columnas al final. Las cinco ramas del `union all` las exponen.
- **RPC nueva:** `move_ledger_entry` (ver Alcance). No hay otra forma de escribir `day_position` desde el cliente: las actions no hacen `update` directo.
- **Actualizar las RPC y acciones que insertan eventos** para aceptar `occurred_time` con `default null`: `record_debt_payment`, `record_card_advance`, `record_goal_contribution`, `record_transaction`, las de traspaso y ajuste. Los parámetros nuevos van al final y con `default null`, así los llamadores existentes no se rompen.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos y esquemas:

```ts
// src/features/transactions/schemas.ts (y los demás esquemas de evento)
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida")
  .or(z.literal(""))
  .transform((value) => value || null)
```

```ts
// src/features/transactions/types.ts
interface LedgerEntry {
  // ...campos actuales
  occurred_time: string | null // "HH:MM:SS" desde Postgres
  day_position: number
}
```

Convenciones:

- La hora viaja al servidor como `HH:MM` y Postgres la guarda como `time`; al mostrarla se recorta a `HH:MM`.
- Editar un evento sin tocar la hora conserva la hora guardada; borrar el campo la deja en `null`.
- `day_position` nunca se muestra ni se edita en formularios.

## Plan de implementación

1. **Migración.**
   - Columnas, trigger `reset_day_position`, vista `ledger_entries` ampliada y `move_ledger_entry`; `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD: filas viejas quedan con `occurred_time` nulo y `day_position` 0; mover una fila reasigna `1..n` del día; mover hacia otro día falla; cambiar `occurred_on` reinicia `day_position`; un usuario de otro espacio no puede mover filas ajenas.
2. **Orden en la lectura.**
   - `getTransactions` ordena por `occurred_on desc, day_position asc, created_at desc, id`.
   - `LedgerEntry` y los selects incluyen `occurred_time` y `day_position`. La app se ve igual que antes (todo en 0 y sin hora).
3. **Formato y campo de hora.**
   - `formatTime` en `src/libs/format.ts` y `TimePickerField` en `src/components/forms/time-picker-field.tsx`; `timeSchema` compartido.
   - Aún sin conectarlo: `pnpm check` pasa.
4. **Hora en movimientos y traspasos.**
   - `transaction-dialog.tsx`, `transfer-dialog.tsx` y sus actions; la tabla y las tarjetas muestran la hora si existe.
   - Un gasto fijo pagado desde "Pagar" hereda la hora del movimiento (ya la guarda el movimiento).
5. **Hora en ajustes, deudas y metas.**
   - Ajuste de cuenta, `payment-dialog.tsx`, `adjust-balance-dialog.tsx` de deudas, `contribution-dialog.tsx` y sus RPC/actions; los historiales muestran la hora si existe.
6. **Reordenar.**
   - Action `moveLedgerEntry` que llama a la RPC.
   - Botones ↑/↓ en `transactions-table.tsx` y tarjetas móviles con `useOptimistic`.
   - Arrastre en escritorio con `useDrag` / `useDrop` de `react-aria` (ya es dependencia, sin librería nueva), limitado al mismo día.
7. **Verificar movimientos.**
   - Query `getVerifyEntries(workspaceId, { accountId, offset })` y action para cargar más.
   - `verify-movements-dialog.tsx` y `verify-row.tsx` en `src/features/transactions/components/`, con el botón en la barra de Movimientos; hoja a pantalla completa en móvil.
8. **Docs.**
   - `docs/producto.md`, `docs/ui.md`, `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] La migración se aplica sin errores; `src/types/database.ts` incluye `occurred_time` y `day_position` en las cinco tablas y en `ledger_entries`, y la RPC `move_ledger_entry`.
- [ ] Tras migrar, todos los movimientos existentes se ven en el mismo orden que antes y sin hora.
- [ ] Registrar un movimiento sin hora lo guarda con `occurred_time` nulo y la tabla no muestra hora.
- [ ] Registrar un movimiento con hora 14:30 la muestra como `2:30 p. m.` en la tabla, en la tarjeta móvil y en la modal Verificar.
- [ ] Editar un movimiento con hora y vaciar el campo hora lo deja sin hora.
- [ ] El campo de hora existe en los diálogos de movimiento, traspaso, ajuste de cuenta, pago/avance de deuda, ajuste de deuda y aporte/retiro de meta, y no existe en presupuestos, gasto fijo ni meta (creación).
- [ ] Pagar un gasto fijo con hora 09:15 deja el movimiento con esa hora y la ocurrencia como pagada.
- [ ] Con 5 movimientos de hoy, ↑ en el tercero lo intercambia con el segundo y el cambio persiste al recargar.
- [ ] Un movimiento nuevo del mismo día aparece arriba de los ya ordenados a mano.
- [ ] No hay forma de mover un movimiento de hoy sobre uno de ayer: la RPC lo rechaza y la UI no lo ofrece; `occurred_on` no cambia nunca por reordenar.
- [ ] La primera fila de un día no muestra ↑, la última no muestra ↓, y un día con una sola fila no muestra controles.
- [ ] Arrastrar una fila sobre otra del mismo día la reordena en escritorio; soltarla sobre una fila de otro día no hace nada.
- [ ] La fila se mueve al instante y, si la RPC falla, vuelve a su lugar y aparece un toast de error.
- [ ] Con la búsqueda de texto activa no hay controles de reordenar; con filtro de tipo, categoría o cuenta sí, y el orden relativo resultante se conserva al quitar el filtro.
- [ ] Los traspasos, ajustes, pagos de tarjeta, avances y aportes con cuenta se reordenan junto con los movimientos del mismo día.
- [ ] Cambiar la fecha de un movimiento lo deja arriba de su día nuevo.
- [ ] Un usuario sin permiso de escritura (espacio marcado para borrar) no ve los controles y la RPC rechaza su llamada.
- [ ] Un usuario A no puede mover filas del espacio de B; un cliente `anon` no puede ejecutar `move_ledger_entry`.
- [ ] El botón Verificar abre una modal que muestra los 50 movimientos más recientes y "Cargar más" agrega 50 más, cruzando meses sin cambiar ningún filtro.
- [ ] Cada fila de Verificar muestra fecha (y hora si hay), cuenta, monto, descripción y nota en formato compacto; ingreso con flecha verde, gasto con flecha roja y traspaso o ajuste con flecha gris.
- [ ] El pago de tarjeta y el aporte a meta salen con flecha roja, y el avance de tarjeta con flecha verde.
- [ ] Con una cuenta elegida en Verificar solo salen filas que tocan esa cuenta, y un traspaso muestra su monto con signo respecto de esa cuenta.
- [ ] El orden de Verificar coincide con el de la tabla de Movimientos, incluido el reordenado a mano.
- [ ] Verificar es de solo lectura: no hay botones de editar, borrar ni reordenar.
- [ ] En 360 px la modal de Verificar ocupa la pantalla, no tiene scroll horizontal y cada fila cabe en dos líneas como máximo.
- [ ] En Empresa, Verificar funciona sin selector de cuenta y la hora y el orden aplican a sus movimientos.
- [ ] Los controles nuevos (↑/↓, campo de hora, botón Verificar) miden 44 px o más de alto táctil en móvil y los pares texto/fondo nuevos cumplen AA en claro y oscuro.
- [ ] `docs/producto.md`, `docs/ui.md` y `CHANGELOG.md` están actualizados.

## Decisiones

- **Sí:** partir el pedido en tres specs. El pedido original mezcla cuatro dominios (orden y hora, fuente de verdad, metas como billetera y Verificar). Este spec cubre el que no cambia saldos ni modelos de dinero. SPEC 21 y SPEC 22 siguen en el mismo orden.
- **Sí:** `occurred_time time null` junto a `occurred_on date`. Las columnas `date` están en reportes, vistas, RPC e importación; no se tocan.
- **No:** `occurred_at timestamptz` único. Reemplazaría `occurred_on` en todo el sistema y obligaría a manejar zona horaria para algo que el usuario trata como "hora del día".
- **Sí:** la hora es informativa y **no reordena sola**. El problema real del usuario es que el orden de captura no coincide con el del banco; si una hora mal puesta reordenara, aparecerían saltos inesperados. El orden lo decide `day_position`.
- **No:** orden automático por hora cuando existe. Se descartó porque mezcla dos fuentes de orden en el mismo día y obliga a explicar por qué una fila sin hora se queda donde la dejaron.
- **Sí:** `day_position` en cada tabla de origen y una RPC `move_ledger_entry` que reasigna todo el día. Una vista unificada necesita una posición común; reasignar `1..n` evita decimales o huecos.
- **No:** tabla aparte `day_order`. Cada lectura haría join y hay que limpiar huérfanos al borrar filas de cinco tablas.
- **Sí:** la RPC recibe una fila objetivo y no un índice. La lista está paginada y filtrable; el cliente solo conoce a sus vecinos visibles, no el índice real dentro del día.
- **Sí:** filas nuevas con `day_position = 0` quedan arriba de su día. Mantiene el comportamiento actual de "lo más reciente primero" sin renumerar el día en cada alta.
- **Sí:** cambiar `occurred_on` reinicia `day_position` en un trigger y no en la action. Cubre ediciones desde cualquier pantalla, RPC o importación.
- **Sí:** flechas ↑/↓ más arrastre en escritorio, con `useOptimistic`. Las flechas funcionan con teclado y dedo; el arrastre acelera en escritorio. Sin librería nueva: se usa `useDrag` / `useDrop` de `react-aria`, ya instalada (se confirma al implementar; si no resulta, se dejan solo las flechas).
- **Sí:** el orden cubre también las filas grises de SPEC 16 (traspasos, ajustes, pagos, aportes). Si no, el orden del día en Movimientos y en el extracto quedaría incompleto.
- **Sí:** Verificar es una modal de solo lectura con "Cargar más", sin filtro mensual y con selector opcional de cuenta. Pedido explícito: una lista larga y mínima para comparar con el banco.
- **No:** casilla "Verificado" por fila. Añade esquema en cinco tablas y un flujo de conciliación que el usuario no pidió; si se quiere, va en otro spec.
- **Sí:** en Verificar, el color sigue el efecto sobre la cuenta (pago de tarjeta y aporte a meta en rojo, avance en verde). Es lo que ve el usuario en el extracto, aunque en Movimientos esas filas sean grises y no sumen a ingresos o gastos.
- **Sí:** el gasto fijo no tiene hora propia, hereda la del movimiento. Es una plantilla; el momento real es el del pago.
- **No:** validar que la hora no sea futura. La fecha futura ya se controla donde corresponde; la hora no cambia saldos.
- **Pendientes registrados para los specs siguientes (decisiones ya tomadas con el usuario):**
  - SPEC 21: las filas grises de pago de tarjeta, avance y aporte pasan a ser eliminables desde Movimientos y el borrado cae en cascada a `debt_entries` / `goal_contributions`; en préstamos y cuentas por cobrar, borrar el gasto o ingreso enlazado borra el pago; el gasto fijo ya es derivado y vuelve a pendiente solo. No se unifican las tablas.
  - SPEC 22: cada meta recibe una cuenta obligatoria; las metas existentes toman la cuenta Efectivo del usuario (se crea si no existe) y los aportes antiguos quedan "Fuera de cuentas", sin cambiar ningún saldo; retiros a cuenta o sin cuenta; pagos desde el saldo de una meta; modelo de saldo que viaja entre billeteras sin duplicarse.

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Un día se parte entre dos páginas de Movimientos (`PAGE_SIZE = 20`)                          | La RPC trabaja con el día completo en la base; en el borde de página la fila vecina no es visible y el control se deshabilita |
| `create or replace view` falla si cambian columnas existentes                                | Las dos columnas nuevas van al final y el resto queda idéntico, como en SPEC 16                                               |
| Dos pestañas reordenan el mismo día a la vez                                                 | Gana la última escritura; la RPC bloquea las filas del día y tras cada acción se revalida la lista                            |
| Reordenar con filtros activos da un orden relativo que el usuario no espera                  | Se coloca la fila en la posición de su vecina visible y el resultado se ve al quitar el filtro; sin controles con búsqueda    |
| Cambiar la firma de `record_*` rompe llamadores (acciones, hoja móvil, importación)          | Parámetros nuevos al final con `default null`; se actualizan `database.ts` y las llamadas en el mismo paso                    |
| El trigger `reset_day_position` pisa un reorden cuando se edita la fecha y se mueve a la vez | Son dos acciones distintas; el trigger solo actúa si `occurred_on` cambia                                                     |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas                           | La modal carga con una action al abrir y no con una lectura en el render de la página                                         |
| Una hora puesta a mano contradice el orden de la lista y confunde                            | Documentado: la hora es dato; el orden es manual. La modal Verificar muestra ambos tal cual                                   |

## Lo que **no** entra en este spec

- Fuente de verdad desde Movimientos y borrado en cascada de pagos de deuda o gastos fijos (SPEC 21).
- Metas como billetera, cuenta obligatoria en metas, retiros y pagos desde metas (SPEC 22).
- Mover movimientos entre días.
- Orden automático por hora.
- Marcar movimientos como verificados o conciliar contra el banco.
- Importar extractos bancarios.
- Hora en presupuestos, plantilla de gasto fijo, fechas objetivo o de vencimiento, e importación.

Cada uno de esos puntos, si llega, va en su propio spec.
