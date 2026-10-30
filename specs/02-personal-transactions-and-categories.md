# SPEC 02 — Movimientos personales y categorías

> **Estado:** Aprovado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-29
> **Objetivo:** Que el usuario registre, edite, elimine y filtre los ingresos y gastos de su espacio Personal, clasificados con categorías del sistema o propias.

## Por qué existe este spec

Los movimientos son la materia prima de todo Tesoro: gráficas (03), presupuestos (04), metas (05), deudas (06) y score (07) se calculan a partir de ellos.
Este spec también deja la función `is_workspace_owner` y el trigger `set_updated_at`, que reutilizan todas las tablas siguientes.

## Alcance

**Entra:**

- Función SQL `public.is_workspace_owner(workspace_id)` para las políticas RLS de este spec y los siguientes.
- Función de trigger reutilizable `public.set_updated_at()`.
- Categorías del sistema (sembradas en la migración, fijas, no editables ni ocultables).
- Categorías propias por espacio: crear, renombrar, cambiar icono y color, archivar y restaurar. No se borran.
- Icono elegido de un set curado de lucide y color de una paleta fija.
- Movimientos con tipo, monto, fecha, categoría, descripción y nota opcional. Se permiten fechas futuras.
- Página `/dashboard/personal/transactions`:
  - tabla paginada por URL, 20 por página, más recientes primero;
  - totales (ingresos, gastos, balance) del periodo filtrado completo, no solo de la página;
  - filtros por mes (por defecto el mes actual, con opción "Todos"), tipo, categoría y texto, todos en la URL;
  - crear y editar en un diálogo, y eliminar con confirmación.
- Sheet "Categorías" abierto desde Movimientos para administrar las categorías propias.
- Botón "Nuevo movimiento" en el header del dashboard, visible solo en rutas `/dashboard/personal/*`, que abre el mismo diálogo.
- Estado vacío con una invitación a registrar el primer movimiento.

**Fuera de alcance (para specs futuros):**

- Gráficas y Resumen (SPEC 03).
- Gastos recurrentes y presupuestos (SPEC 04).
- Importar Excel o CSV (SPEC 08).
- Adjuntos o recibos.
- Multimoneda. Todo usa la moneda del perfil (COP por defecto).
- Ocultar categorías del sistema.
- Borrar categorías físicamente o reasignar sus movimientos.
- Scroll infinito.
- Movimientos en el espacio Empresa.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_categories_and_transactions.sql`:

```sql
-- Reutilizable por todas las tablas con datos de un espacio
create function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces
    where id = p_workspace_id and owner_id = (select auth.uid())
  );
$$;

create function public.set_updated_at() returns trigger ... -- new.updated_at = now()

create type public.transaction_type as enum ('income', 'expense');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade, -- null = del sistema
  type public.transaction_type not null,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null,   -- clave de CATEGORY_ICONS
  color text not null,  -- clave de CATEGORY_COLORS
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nombre único por espacio y tipo, sin distinguir mayúsculas
create unique index categories_unique_name
  on public.categories (workspace_id, type, lower(name))
  where workspace_id is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  occurred_on date not null,
  description text not null check (char_length(description) between 1 and 120),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_workspace_date
  on public.transactions (workspace_id, occurred_on desc, created_at desc);
create index transactions_category on public.transactions (category_id);
```

- **Triggers:**
  - `set_updated_at` (`before update`) en `categories` y `transactions`.
  - `check_transaction_category` (`before insert or update` en `transactions`): la categoría debe tener el mismo `type` que el movimiento y ser del sistema (`workspace_id is null`) o del mismo `workspace_id`. Si no, lanza un error.
- **Semilla del sistema** (en la misma migración, `workspace_id = null`):
  - Ingresos: Salario, Freelance, Otros ingresos.
  - Gastos: Vivienda, Comida, Transporte, Salud, Educación, Ocio, Servicios, Compras, Otros gastos.
  - Cada una con `icon` y `color` de las claves curadas.
- **RLS** activo en las dos tablas:
  - `categories`:
    - `select`: `workspace_id is null or is_workspace_owner(workspace_id)`.
    - `insert` y `update`: `workspace_id is not null and is_workspace_owner(workspace_id)` en `using` y `with check`.
    - Sin política de `delete`: las categorías solo se archivan.
  - `transactions`: `select`, `insert`, `update` y `delete` con `is_workspace_owner(workspace_id)` (`using` y `with check`).
- **RPC** `public.transaction_totals(p_workspace_id, p_from, p_to, p_type, p_category_id, p_search)`:
  - `security invoker`, devuelve `income numeric, expense numeric`.
  - Aplica los mismos filtros que la tabla. Los parámetros `null` no filtran.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Constantes en TypeScript:

```ts
// src/features/categories/constants.ts
export const CATEGORY_ICONS = {
  home: "House",
  utensils: "Utensils",
  car: "Car"
  // ~24 claves → nombre del ícono de lucide-react
} as const

export const CATEGORY_COLORS = {
  emerald: "...", // clases Tailwind con variante dark
  rose: "..."
  // ~10 claves
} as const
```

Parámetros de URL de `/dashboard/personal/transactions`:

| Parámetro  | Valores                    | Por defecto                    |
| ---------- | -------------------------- | ------------------------------ |
| `month`    | `YYYY-MM` o `all`          | mes actual en `America/Bogota` |
| `type`     | `income`, `expense`        | sin filtro                     |
| `category` | uuid                       | sin filtro                     |
| `q`        | texto (descripción y nota) | sin filtro                     |
| `page`     | entero ≥ 1                 | `1`                            |

Convenciones:

- Montos en `numeric(14, 2)`. La UI de COP los muestra sin decimales con `Intl.NumberFormat("es-CO")`.
- Fechas `date` sin hora. El "mes actual" y "hoy" se calculan en `America/Bogota`.
- Orden de la tabla: `occurred_on desc, created_at desc`.
- La búsqueda de texto es `ilike` sobre `description` y `note`, escapando `%` y `_`.

## Plan de implementación

1. **Componentes shadcn.**
   - Agregar `dialog`, `alert-dialog`, `select`, `table`, `popover`, `calendar`, `textarea`, `badge`, `pagination` y `toggle-group`.
   - Dependencias nuevas (p. ej. `react-day-picker`) con versión exacta.
   - Verificar: `pnpm check`, `pnpm eslint`, `pnpm build` pasan y el lockfile queda sincronizado.
2. **Migración.**
   - Crear la migración del modelo de datos con funciones, tablas, índices, triggers, RLS, semilla y RPC.
   - Aplicarla con `supabase db push` (o `supabase db reset` en local) y regenerar `src/types/database.ts`.
   - Verificar: un usuario ve las 12 categorías del sistema y ninguna de otro usuario.
3. **Helpers compartidos.**
   - `src/libs/format.ts`: `formatCurrency(amount, currency)` y `formatDate(date)` en `es-CO`.
   - `src/features/workspaces/queries.ts`: `getPersonalWorkspace()` lee el workspace `personal` del usuario autenticado.
4. **Categorías: constantes, esquemas y consultas.**
   - `src/features/categories/constants.ts`: `CATEGORY_ICONS` y `CATEGORY_COLORS`.
   - `src/features/categories/schemas.ts` (Zod): `name` de 1 a 40, `type`, `icon` y `color` como claves válidas.
   - `src/features/categories/queries.ts`: `getCategories(workspaceId)` devuelve las del sistema y las propias (activas y archivadas).
   - `src/features/categories/components/category-badge.tsx`: icono + color + nombre.
5. **Categorías: Server Actions y Sheet.**
   - `src/features/categories/actions.ts` (`"use server"`): `createCategory`, `updateCategory` (nombre, icono, color), `archiveCategory`, `restoreCategory`.
   - Cada acción valida con Zod y contra el workspace Personal del usuario. El nombre duplicado muestra un error en español.
   - `src/features/categories/components/categories-sheet.tsx`: lista por tipo, formulario de crear/editar con selector de icono y de color, y archivar/restaurar.
6. **Movimientos: esquemas, consultas y acciones.**
   - `src/features/transactions/schemas.ts` (Zod):
     - `amount` > 0 y ≤ 999.999.999.999,99;
     - `occurred_on` fecha válida (se permiten futuras);
     - `description` de 1 a 120, `note` hasta 500;
     - `type` y `category_id`.
   - `src/features/transactions/filters.ts`: parsea y valida los parámetros de URL con valores por defecto.
   - `src/features/transactions/queries.ts`: `getTransactions(filters)` (paginado, `count: "exact"`) y `getTransactionTotals(filters)` (RPC).
   - `src/features/transactions/actions.ts` (`"use server"`): `createTransaction`, `updateTransaction`, `deleteTransaction`.
     - No se acepta una categoría archivada, salvo que ya sea la categoría actual del movimiento editado.
     - Los errores de Supabase se traducen a español.
7. **Diálogo de movimiento.**
   - `src/features/transactions/components/transaction-dialog.tsx` (client, `useActionState`), en modo crear o editar.
   - Campos: tipo (`toggle-group`), monto, fecha (Calendar + Popover, locale `es`), categoría (`select` filtrado por tipo, solo activas), descripción y nota.
   - Cambiar el tipo limpia la categoría.
   - Al guardar: toast con `sonner`, cierra el diálogo y refresca los datos.
8. **Página de Movimientos.**
   - `app/dashboard/personal/transactions/page.tsx` reemplaza el placeholder. Usa `buildMetadata` con `noindex` y lee datos dentro de `Suspense`.
   - `transactions-filters.tsx` (client): mes, tipo, categoría (archivadas al final con "(archivada)") y texto con debounce. Cambiar un filtro vuelve a `page=1`.
   - `transactions-totals.tsx`: tarjetas de ingresos, gastos y balance.
   - `transactions-table.tsx`: fecha, descripción, categoría, monto con signo y color por tipo, y acciones editar/eliminar (`alert-dialog`).
   - Paginación con `pagination` de shadcn.
   - Botones "Nuevo movimiento" y "Categorías" en la cabecera de la página.
9. **Estados vacíos.**
   - Sin ningún movimiento en el espacio: invitación "Registra tu primer movimiento" con el botón que abre el diálogo.
   - Con movimientos pero sin resultados para los filtros: "No hay movimientos con estos filtros" y un enlace para limpiarlos.
10. **Registro rápido en el header.**
    - `src/components/dashboard/quick-add-transaction.tsx`: carga las categorías en servidor dentro de `Suspense` y renderiza un botón client que usa `usePathname()`.
    - Solo se muestra en `/dashboard/personal/*` y abre `TransactionDialog`.
    - Se monta en el header de `app/dashboard/layout.tsx`.
11. **Docs.**
    - `docs/producto.md`: modelo de categorías y movimientos, reglas de categorías y filtros.
    - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 02.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y las dependencias nuevas tienen versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `categories`, `transactions` y `transaction_totals`.
- [ ] Un usuario nuevo ve 3 categorías de ingreso y 9 de gasto del sistema, sin opción de editarlas ni archivarlas.
- [ ] Crear un ingreso de 1.500.000 con categoría Salario lo muestra en la tabla como `$ 1.500.000` en verde, y suma a "Ingresos".
- [ ] Crear un movimiento con monto 0, sin descripción o sin categoría muestra un error de validación en español y no escribe en la BD.
- [ ] Un movimiento con fecha futura se guarda y aparece en el mes de esa fecha.
- [ ] Editar un movimiento cambia sus datos. Cambiar el tipo limpia la categoría y obliga a elegir una del nuevo tipo.
- [ ] Eliminar pide confirmación. Al confirmar, el movimiento desaparece y los totales se actualizan.
- [ ] Al abrir `/dashboard/personal/transactions` sin parámetros se filtra por el mes actual.
- [ ] Con 25 movimientos en el mes hay 2 páginas: la 1 muestra 20 y la 2 muestra 5, ordenados por fecha descendente.
- [ ] Los totales reflejan todos los movimientos filtrados, no solo los de la página actual.
- [ ] Filtrar por tipo, categoría o texto actualiza la URL, la tabla y los totales. Recargar la página conserva los filtros.
- [ ] Buscar "mercado" encuentra movimientos con esa palabra en la descripción o en la nota, sin distinguir mayúsculas.
- [ ] Crear una categoría propia "Mascotas" con icono y color la muestra en el selector del formulario de gastos.
- [ ] Crear otra categoría de gasto "mascotas" en el mismo espacio muestra un error de nombre duplicado.
- [ ] Archivar "Mascotas" la quita del selector del formulario. Sus movimientos la conservan y en el filtro aparece como "Mascotas (archivada)".
- [ ] Editar un movimiento cuya categoría está archivada se puede guardar sin cambiar la categoría.
- [ ] Restaurar "Mascotas" la devuelve al selector del formulario.
- [ ] Sin movimientos, la página muestra la invitación a registrar el primero. Con filtros sin resultados, muestra "No hay movimientos con estos filtros".
- [ ] El botón "Nuevo movimiento" del header aparece en `/dashboard/personal/goals` y no en `/dashboard/business`. Guardar desde ahí crea el movimiento.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer, crear, editar ni borrar movimientos o categorías del workspace de B (probado con el cliente o SQL).
- [ ] Insertar un movimiento con una categoría de otro tipo o de otro workspace falla en la BD aunque se salte la validación del cliente.
- [ ] Borrar una categoría con `delete` desde el cliente no tiene efecto (no hay política).

## Decisiones

- **Sí:** `numeric(14, 2)`. COP se muestra sin decimales, pero si llega multimoneda no hay que migrar.
- **No:** `bigint` en pesos. Ataría el modelo a monedas sin centavos.
- **Sí:** categorías del sistema fijas y visibles para todos. Menos tablas y menos RLS.
- **No:** ocultar categorías del sistema por espacio. Se puede agregar después con una tabla aparte.
- **Sí:** las categorías propias solo se archivan, con FK `on delete restrict`. Los movimientos históricos nunca pierden su categoría.
- **No:** borrar o reasignar movimientos al eliminar. Más UI y riesgo de perder historia.
- **Sí:** restaurar categorías archivadas. Es la única forma de deshacer un archivo, porque no hay borrado.
- **Sí:** nombre único por espacio y tipo, sin distinguir mayúsculas. Evita "Comida" y "comida" duplicadas.
- **Sí:** icono de un set curado (`CATEGORY_ICONS`) y color de una paleta fija (`CATEGORY_COLORS`), guardados como claves. Legibles en claro y oscuro, reutilizables en las gráficas del SPEC 03 y sin imports dinámicos.
- **No:** cualquier icono de lucide ni color hex libre. Más bundle y riesgo de contraste bajo.
- **Sí:** se permiten fechas futuras. El usuario lo pidió para registrar gastos ya conocidos.
- **Sí:** paginación por URL, 20 por página. Enlaces compartibles y encaja con Server Components y `cacheComponents`.
- **No:** scroll infinito. Exige fetch desde el cliente y estado extra.
- **Sí:** el filtro de mes abre en el mes actual. Es el periodo que más se consulta y mantiene los totales relevantes.
- **Sí:** totales con una RPC `security invoker` en Postgres. Respeta RLS y no depende de la página cargada.
- **No:** sumar en el cliente. Solo vería la página actual.
- **Sí:** se puede cambiar el tipo al editar, limpiando la categoría. Corrige errores sin borrar y recrear.
- **Sí:** las categorías archivadas aparecen en el filtro, marcadas. Permite revisar movimientos históricos.
- **Sí:** trigger `check_transaction_category` en la BD además de Zod. La regla de tipo y espacio no depende del cliente.
- **Sí:** `is_workspace_owner` como `security invoker`. La política `select` de `workspaces` ya limita las filas al dueño, así que no hace falta `security definer`.
- **Sí:** administrar categorías en un Sheet desde Movimientos. Sin ruta ni ítem nuevo en el aside.
- **No:** página `/dashboard/personal/categories`. No justifica un ítem de navegación todavía.
- **Sí:** botón "Nuevo movimiento" en el header, solo en rutas Personal. Empresa aún no tiene datos.
- **Sí:** selector de fecha con Calendar + Popover de shadcn. Consistente con el resto de la UI.
- **No:** `input type="date"` nativo. Su apariencia depende del navegador.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas (`searchParams`, sesión) | La página y el botón del header leen datos dentro de `Suspense` con skeletons. Antes de implementar se consulta `node_modules/next/dist/docs/` |
| Los datos no se refrescan tras una Server Action                                            | Se usa la API de revalidación que indiquen los docs de Next 16 (`revalidatePath`/`refresh`) para la página de Movimientos                      |
| El mes actual cambia según la zona horaria del servidor                                     | "Hoy" y "mes actual" se calculan siempre en `America/Bogota`                                                                                   |
| `ilike` con `%` o `_` del usuario devuelve resultados de más                                | Se escapan esos caracteres antes de construir el patrón                                                                                        |
| Montos grandes pierden precisión en JS                                                      | `numeric(14, 2)` cabe en `number` sin pérdida para montos ≤ 999.999.999.999,99, que es el máximo de Zod                                        |
| Una categoría archivada rompe la edición de movimientos viejos                              | El formulario incluye la categoría actual aunque esté archivada, y la acción la acepta solo si no cambió                                       |

## Lo que **no** entra en este spec

- Gráficas y Resumen.
- Gastos recurrentes y presupuestos.
- Importar Excel o CSV.
- Adjuntos o recibos.
- Multimoneda.
- Ocultar categorías del sistema, borrar categorías o reasignar movimientos.
- Scroll infinito.
- Movimientos en Empresa.

Cada uno de esos puntos, si llega, va en su propio spec.
