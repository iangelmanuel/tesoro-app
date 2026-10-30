# SPEC 05 — Metas de ahorro

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 04
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario cree en su espacio Personal metas de ahorro con monto y fecha objetivo opcional, registre aportes y retiros, y vea su progreso, el aporte mensual sugerido y si va en camino.

## Por qué existe este spec

Los SPEC 02 a 04 cubren lo que entra, lo que sale y lo que se planea gastar. Este spec agrega lo que se aparta para el futuro.
Los aportes son **independientes de los movimientos**: no cambian el balance, los gastos ni los presupuestos. Así no se inflan los gastos del mes ni hace falta un tipo "transferencia", que tocaría las agregaciones del SPEC 03.
Del SPEC 02 reutiliza las paletas de icono y color. Del SPEC 04, `revalidatePersonalPages`, `EmptyState` / `CardEmpty` y la ubicación de las tarjetas del Resumen.
Deja la RPC `goal_progress`, que puede usar el score (07).

## Alcance

**Entra:**

- Tablas `savings_goals` (nombre, monto objetivo, fecha objetivo opcional, icono, color, estado) y `goal_contributions` (monto con signo, fecha, nota opcional).
- RPC `goal_progress` con lo ahorrado por meta.
- Página `/dashboard/personal/goals`, que reemplaza el placeholder:
  - botón "Nueva meta" y diálogo para crear y editar (nombre, monto objetivo, fecha objetivo, icono y color);
  - tarjetas de metas activas, ordenadas por fecha objetivo (sin fecha al final), con:
    - icono, nombre, "ahorrado de objetivo", barra y porcentaje;
    - monto faltante;
    - fecha objetivo y aporte mensual sugerido (solo con fecha);
    - estado "En camino" o "En riesgo" (solo con fecha), con el aviso "La fecha objetivo ya pasó" si aplica;
    - al llegar al 100 %, el aviso "¡Lo lograste!" con el botón "Marcar como cumplida";
    - menú con editar, marcar como cumplida y archivar.
  - sección plegable "Cumplidas y archivadas", con la acción "Reactivar".
- Sheet por meta, que se abre desde su tarjeta:
  - resumen de la meta;
  - botones "Aportar" y "Retirar", que abren el diálogo de aporte (monto, fecha, nota);
  - historial de aportes y retiros, con editar y eliminar con confirmación;
  - en metas cumplidas o archivadas, solo lectura y el botón "Reactivar".
- En Resumen (`/dashboard/personal`), la tarjeta "Metas de ahorro" con hasta 3 metas activas, de fecha más cercana primero, con barra, porcentaje y estado, y el enlace "Ver todas".
- Estados vacíos en la página, en la sección de inactivas, en el historial y en la tarjeta del Resumen.

**Fuera de alcance (para specs futuros):**

- Que un aporte cree un movimiento o afecte el balance, o un tipo "transferencia".
- Un tipo especial "fondo de emergencia". Se crea como una meta normal.
- Ahorro automático o aportes recurrentes.
- Rendimientos o intereses de inversión.
- Metas compartidas.
- Eliminar metas. Solo se archivan.
- Metas en el espacio Empresa.
- Notificaciones de metas en riesgo.
- Totales de ahorro en las tarjetas o gráficas del SPEC 03.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_savings_goals.sql`:

```sql
create type public.goal_status as enum ('active', 'completed', 'archived');

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date date,
  icon text not null,  -- clave de CATEGORY_ICONS
  color text not null, -- clave de CATEGORY_COLORS
  status public.goal_status not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  -- Destino de la FK compuesta de goal_contributions
  unique (id, workspace_id)
);

create index savings_goals_workspace on public.savings_goals (workspace_id);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  goal_id uuid not null,
  amount numeric(14, 2) not null check (amount <> 0), -- > 0 aporte, < 0 retiro
  occurred_on date not null,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- El aporte siempre es del mismo espacio que su meta
  foreign key (goal_id, workspace_id)
    references public.savings_goals (id, workspace_id) on delete cascade
);

create index goal_contributions_goal
  on public.goal_contributions (goal_id, occurred_on desc, created_at desc);
```

- **Triggers:**
  - `set_updated_at` (`before update`) en `savings_goals` y `goal_contributions`.
  - `check_goal_contribution` (`before insert or update or delete` en `goal_contributions`):
    - la meta debe estar `active` (en `delete` se revisa la fila vieja);
    - `goal_id` no cambia en un `update`;
    - `occurred_on` ≤ hoy en `America/Bogota`. Si no, lanza un error.
  - `check_goal_balance` (`after insert or update or delete` en `goal_contributions`): la suma de `amount` de la meta debe quedar ≥ 0. Si no, lanza un error. Cubre retiros, ediciones y borrados de aportes.
- **RLS** activo en las dos tablas: `select`, `insert`, `update` y `delete` con `is_workspace_owner(workspace_id)` (`using` y `with check`). No hay política de `delete` en `savings_goals`: las metas solo se archivan.
- **RPC** (`security invoker`, `stable`, `search_path = ''`, `grant execute` solo a `authenticated`):
  - `goal_progress(p_workspace_id uuid)` devuelve `id, name, target_amount, target_date, icon, color, status, completed_at, created_at, saved numeric, contributions_count bigint`:
    - una fila por meta del espacio, en cualquier estado;
    - `saved`: suma de `amount` de sus aportes, 0 si no tiene.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Cálculos (en `src/features/goals/progress.ts`, fechas en `America/Bogota`):

| Valor                   | Cálculo                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Progreso                | `saved / target_amount`, en porcentaje truncado. Puede pasar de 100 %                      |
| Faltante                | `max(target_amount − saved, 0)`                                                            |
| Meses restantes         | Meses desde el mes siguiente al actual hasta el de `target_date`, contando ambos; mínimo 1 |
| Aporte mensual sugerido | `faltante / meses restantes`. Solo con fecha y faltante > 0                                |
| Inicio                  | Fecha de `created_at` en `America/Bogota`                                                  |
| Esperado hoy            | `target_amount × (hoy − inicio) / (target_date − inicio)`, con tope en `target_amount`     |

- Si `target_date ≤ inicio`, el esperado es `target_amount`.
- Ejemplo de meses restantes: hoy 30 de octubre y fecha objetivo 15 de diciembre → 2 (noviembre y diciembre). Fecha objetivo en el mes actual → 1.

Estado de una meta:

| Estado    | Condición                                            | Color  |
| --------- | ---------------------------------------------------- | ------ |
| Cumplida  | `status = 'completed'`                               | verde  |
| Archivada | `status = 'archived'`                                | neutro |
| En camino | activa, con fecha y `saved ≥ esperado hoy`           | verde  |
| En riesgo | activa, con fecha y `saved < esperado hoy`           | ámbar  |
| —         | activa sin fecha: sin etiqueta, "Sin fecha objetivo" | neutro |

- Una meta activa con `target_date < hoy` y faltante > 0 está "En riesgo", muestra "La fecha objetivo ya pasó" y su aporte sugerido es el faltante completo.
- Con `saved ≥ target_amount`, una meta activa muestra "¡Lo lograste!" y "Marcar como cumplida" en lugar del aporte sugerido.

Transiciones de estado:

| Acción               | Desde                   | Hacia       | Efecto                 |
| -------------------- | ----------------------- | ----------- | ---------------------- |
| Marcar como cumplida | `active`                | `completed` | `completed_at = now()` |
| Archivar             | `active`, `completed`   | `archived`  | `completed_at = null`  |
| Reactivar            | `completed`, `archived` | `active`    | `completed_at = null`  |

## Plan de implementación

1. **Migración.**
   - Crear la migración del modelo de datos con tipo, tablas, índices, triggers, RLS y RPC.
   - Aplicarla con `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD: un retiro mayor que lo ahorrado falla, borrar un aporte que deja el saldo negativo falla y un aporte con fecha futura falla.
2. **Componentes y piezas compartidas.**
   - Agregar `collapsible` de shadcn si no existe.
   - Extraer de `categories-sheet.tsx` el selector de icono y color a `src/features/categories/components/icon-color-picker.tsx`, sin cambiar cómo se ve el Sheet de Categorías.
   - Verificar: `pnpm check`, `pnpm eslint`, `pnpm build` pasan y el lockfile queda sincronizado.
3. **Esquemas, cálculos, consultas y acciones.**
   - `src/features/goals/schemas.ts` (Zod):
     - meta: `name` de 1 a 60, `target_amount` igual que movimientos, `target_date` opcional y posterior a hoy al crear o al cambiarla, `icon` y `color` de las paletas;
     - aporte: `kind` (`deposit` / `withdrawal`), `amount` igual que movimientos (positivo; el signo lo pone `kind`), `occurred_on` ≤ hoy y `note` hasta 120.
   - `src/features/goals/progress.ts`: progreso, faltante, meses restantes, aporte sugerido, esperado hoy y estado.
   - `src/features/goals/queries.ts`: `getGoals(workspaceId)` (RPC, convierte `numeric` con `Number()`) y `getGoalContributions(goalId)`.
   - `src/features/goals/actions.ts` (`"use server"`):
     - `createGoal`, `updateGoal`, `completeGoal`, `archiveGoal`, `reactivateGoal`;
     - `createContribution`, `updateContribution`, `deleteContribution`. Un retiro mayor que lo ahorrado devuelve "No puedes retirar más de lo ahorrado". Una meta no activa devuelve "Reactiva la meta para registrar aportes".
     - Todas validan contra el workspace Personal del usuario y llaman a `revalidatePersonalPages()`.
4. **Página de metas.**
   - `app/dashboard/personal/goals/page.tsx` reemplaza el placeholder, con `buildMetadata` `noindex` y `Suspense`.
   - `src/features/goals/components/`:
     - `goal-dialog.tsx` (client, `useActionState`): crear y editar con `IconColorPicker`;
     - `goal-card.tsx`: icono, nombre, barra, porcentaje, faltante, fecha, aporte sugerido, estado, avisos y menú de acciones;
     - `goal-progress-bar.tsx`: barra coloreada por estado, con tope visual en 100 %;
     - `inactive-goals.tsx`: sección plegable "Cumplidas y archivadas" con "Reactivar".
5. **Sheet de la meta y aportes.**
   - `src/features/goals/components/goal-sheet.tsx`: resumen, "Aportar", "Retirar" e historial. En metas no activas, solo lectura con "Reactivar".
   - `contribution-dialog.tsx` (client): crear y editar un aporte o retiro (monto, fecha con calendario, nota).
   - `contributions-list.tsx`: fecha, monto con signo (aporte en verde, retiro en rojo), nota, editar y eliminar con `alert-dialog`.
6. **Tarjeta del Resumen.**
   - `src/features/goals/components/goals-card.tsx`: hasta 3 metas activas, de fecha más cercana primero, con barra, porcentaje, estado y "Ver todas".
   - Se monta en `app/dashboard/personal/page.tsx` dentro de `Suspense`, después de las tarjetas del SPEC 04.
7. **Estados vacíos.**
   - Página sin metas: "Crea tu primera meta de ahorro" con el botón "Nueva meta".
   - Sin metas activas pero con inactivas: "No tienes metas activas" con "Nueva meta", y la sección de inactivas debajo.
   - Historial sin aportes: "Aún no hay aportes en esta meta".
   - Tarjeta del Resumen: "No tienes metas activas" con un enlace "Crear meta".
8. **Docs.**
   - `docs/producto.md`: sección "Metas de ahorro" con el modelo, los cálculos, los estados y las transiciones.
   - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 05.
   - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y las dependencias nuevas tienen versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `savings_goals`, `goal_contributions`, `goal_status` y `goal_progress`.
- [ ] Crear la meta "Viaje", 3.000.000, con fecha 31 de marzo de 2027, la muestra entre las activas con 0 % y faltante `$ 3.000.000`.
- [ ] Crear una meta sin nombre, con monto 0 o con fecha objetivo de hoy o pasada muestra un error de validación en español y no escribe en la BD.
- [ ] Una meta sin fecha objetivo muestra progreso y faltante, "Sin fecha objetivo", y no muestra aporte sugerido ni estado.
- [ ] El 30 de octubre de 2026, "Viaje" (creada el 1 de octubre, objetivo 31 de marzo de 2027) con 500.000 ahorrados muestra "En camino" y aporte sugerido `$ 500.000` (2.500.000 / 5 meses). Con 400.000 muestra "En riesgo".
- [ ] Una meta activa con fecha objetivo pasada y faltante > 0 muestra "En riesgo", "La fecha objetivo ya pasó" y el faltante como aporte sugerido.
- [ ] Aportar 500.000 desde el Sheet suma al progreso, aparece en el historial y no cambia el balance, los gastos ni los presupuestos del Resumen.
- [ ] Retirar 200.000 de una meta con 500.000 deja 300.000. Retirar 400.000 muestra "No puedes retirar más de lo ahorrado" y no escribe en la BD.
- [ ] Un retiro mayor que lo ahorrado, o borrar un aporte que deja el saldo negativo, falla en la BD aunque se salte la validación del cliente.
- [ ] Un aporte con fecha futura falla en el formulario y en la BD.
- [ ] Editar el monto de un aporte y borrar un aporte actualizan el progreso.
- [ ] Al llegar al 100 %, la tarjeta muestra "¡Lo lograste!" y "Marcar como cumplida". Marcarla la mueve a "Cumplidas y archivadas" como "Cumplida".
- [ ] Una meta cumplida o archivada no acepta aportes, ni desde la UI ni saltando la validación del cliente, y su Sheet es de solo lectura.
- [ ] "Reactivar" una meta cumplida o archivada la devuelve a las activas con sus aportes intactos.
- [ ] Archivar una meta activa la mueve a la sección de inactivas como "Archivada".
- [ ] Las metas activas se ordenan por fecha objetivo, con las que no tienen fecha al final.
- [ ] El icono y el color elegidos se ven en la tarjeta, en el Sheet y en el Resumen.
- [ ] Resumen muestra "Metas de ahorro" con hasta 3 metas activas, de fecha más cercana primero, y "Ver todas" abre `/dashboard/personal/goals`.
- [ ] Los estados vacíos de la página, del historial y de la tarjeta del Resumen muestran los textos definidos.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer, crear, editar ni archivar metas o aportes del workspace de B, y `goal_progress` con el workspace de B devuelve vacío.
- [ ] Un aporte con `workspace_id` distinto al de su meta falla en la BD.
- [ ] Un cliente `anon` no puede ejecutar `goal_progress`.
- [ ] No existe forma de eliminar una meta desde el cliente (sin política `delete`).

## Decisiones

- **Sí:** aportes independientes de los movimientos. No inflan los gastos del mes ni cambian presupuestos o reportes.
- **No:** que cada aporte cree un gasto. Mezclaría ahorro con consumo en Reportes y presupuestos.
- **No:** que el usuario elija por aporte si crea un movimiento. Dos caminos que mantener; un tipo "transferencia" merece su propio spec.
- **No:** tipo especial "fondo de emergencia". Es una meta normal; el score (07) la puede tratar aparte.
- **Sí:** fecha objetivo opcional. Las metas abiertas también sirven; sin fecha no hay aporte sugerido ni estado.
- **Sí:** fecha objetivo posterior a hoy al crearla o cambiarla. Una meta nueva con fecha pasada nace vencida. Al editar otros campos, una fecha ya pasada se conserva.
- **Sí:** avance lineal desde la creación, sin margen. Fácil de explicar; los ahorros previos se registran como un primer aporte.
- **No:** ritmo de los últimos 3 meses. Castiga a las metas recién creadas sin historial.
- **No:** campo de fecha de inicio editable. Un campo más en el formulario sin un caso claro.
- **Sí:** meses restantes desde el mes siguiente al actual. Predecible y no reparte en un mes que casi terminó.
- **Sí:** meta vencida como "En riesgo" con aviso. Se mantienen los tres estados del borrador.
- **No:** estado "vencida" aparte. Un estado más en el modelo y en la UI.
- **Sí:** "cumplida" manual, con aviso al llegar al 100 %. El usuario decide si sigue ahorrando.
- **No:** cumplida automática. Un retiro posterior la reabriría sin que el usuario lo note.
- **Sí:** el saldo de una meta nunca queda negativo, validado con trigger además de Zod. Cubre retiros, ediciones y borrados.
- **Sí:** cumplidas y archivadas en una sección aparte, reactivables, sin aportes mientras no estén activas.
- **No:** eliminar metas. La historia de ahorro no se pierde.
- **Sí:** editar y borrar aportes desde el historial. Permite corregir errores, igual que Movimientos.
- **Sí:** aportes con fecha hasta hoy, también antes de la creación de la meta. Un ahorro futuro aún no existe.
- **Sí:** monto con signo en una sola tabla. La suma es directa; `kind` solo existe en el formulario.
- **Sí:** `workspace_id` en `goal_contributions` con FK compuesta a la meta. RLS con `is_workspace_owner(workspace_id)` como el resto de tablas, y la BD garantiza que el aporte sea del mismo espacio.
- **Sí:** icono y color con las paletas de categorías. Reutiliza el selector del SPEC 02.
- **Sí:** Sheet por meta para el historial. Sin rutas nuevas, como el Sheet de Categorías.
- **No:** ruta `/dashboard/personal/goals/[id]`. Suma una ruta dinámica y metadata sin necesidad.
- **Sí:** nota opcional de hasta 120 caracteres en los aportes.
- **Sí:** top 3 de metas en el Resumen, de fecha más cercana primero.

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Editar o borrar un aporte deja el saldo negativo                                     | Trigger `check_goal_balance` (`after`) revisa la suma de la meta en `insert`, `update` y `delete`                          |
| `check` no puede usar la fecha de hoy                                                | La fecha ≤ hoy se valida en el trigger `check_goal_contribution` con `America/Bogota`, no con un `check`                   |
| "Hoy" y "mes actual" cambian según la zona horaria del servidor                      | Se calculan siempre en `America/Bogota`, igual que en SPEC 02 a 04                                                         |
| El usuario espera que el balance baje al ahorrar                                     | El diálogo de aporte dice "Los aportes no cambian tu balance ni tus movimientos"                                           |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas                   | Página y tarjeta leen sesión dentro de `Suspense`. Antes de implementar se consulta `node_modules/next/dist/docs/`         |
| El Resumen sin movimientos muestra el estado vacío del SPEC 03 y oculta las tarjetas | Igual que las tarjetas del SPEC 04: la tarjeta de metas solo aparece cuando hay movimientos. Las metas siguen en su página |
| `numeric` llega como `number` o `string`                                             | Las consultas convierten con `Number()`                                                                                    |

## Lo que **no** entra en este spec

- Aportes que crean movimientos o afectan el balance, y el tipo "transferencia".
- Fondo de emergencia como tipo especial.
- Ahorro automático y aportes recurrentes.
- Rendimientos e intereses.
- Metas compartidas.
- Eliminar metas.
- Metas en Empresa.
- Notificaciones.
- Ahorro en las tarjetas y gráficas del SPEC 03.

Cada uno de esos puntos, si llega, va en su propio spec.
