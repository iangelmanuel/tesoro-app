# SPEC 10 — Espacio Empresa: crear y registrar operaciones

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 08c, SPEC 09
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario cree su espacio de Empresa con nombre, NIT opcional y sector, y registre en él ventas y costos o gastos operativos con categorías de negocio, cliente o proveedor y número de factura.

## Por qué existe este spec

Hoy el tab **Empresa** muestra un estado vacío con "Crear empresa" deshabilitado. El modelo ya lo prevé (`workspace_type` tiene `business`), pero faltan las políticas de escritura en `workspaces`, los datos de la empresa y las rutas.
Tres cosas del código actual obligan a cambios transversales:

- Las categorías del sistema (`workspace_id null`) se ven en cualquier espacio. Una empresa vería "Salario" u "Ocio". Por eso entra `categories.scope`.
- Todas las actions y loaders resuelven el espacio con `getPersonalWorkspace()`. Movimientos, categorías y cuentas pasan a recibir el `workspaceId` y validarlo en el servidor.
- El trigger `seed_workspace_accounts` (SPEC 08c) ya crea "Efectivo" en cualquier espacio nuevo. Empresa lo aprovecha sin cambios.

Por ahora cada usuario tiene **una** empresa. Las rutas y el modelo se diseñan para varias, porque un plan premium futuro podría subir el límite sin migrar rutas ni datos.
Eliminar una empresa no es inmediato: se **programa** y se purga 30 días después, igual que la cuenta (SPEC 09).

## Alcance

**Entra:**

- "Crear empresa" habilitado en el estado vacío de `/dashboard/business`:
  - dialog con nombre (2 a 60 caracteres), NIT opcional y sector (lista cerrada);
  - al crear, lleva a `/dashboard/business/[id]`.
- Límite de 1 empresa por usuario, aplicado en la BD y reflejado en la UI. Una empresa programada para borrar cuenta para el límite.
- Rutas `/dashboard/business/[id]/...`:
  - `/dashboard/business` redirige a la única empresa del usuario o muestra el estado vacío;
  - un `id` ajeno, inexistente o de tipo `personal` da 404.
- Navegación de Empresa en `SITE.navigation.business` y en el aside:
  - **Resumen:** ventas, costos y gastos, y utilidad del mes actual, más los últimos 5 movimientos. Sin gráficas.
  - **Movimientos:** ventas (ingresos) y costos o gastos (egresos), con la tabla, filtros, totales y paginación del SPEC 02.
  - **Cuentas:** la página del SPEC 08c (cuentas, traspasos y ajustes) dentro de la empresa.
  - **Flujo de caja**, **Reportes** y **Recomendaciones:** página "Próximamente" (`coming-soon.tsx`).
  - **Ajustes:** editar nombre, NIT y sector, y eliminar la empresa.
- Selector de empresa en el aside (dropdown bajo el tab). Solo se pinta si el usuario tiene más de una, así que con el límite actual no se ve.
- Campos opcionales en movimientos de Empresa:
  - `counterparty`: "Cliente" en ventas, "Proveedor" en costos y gastos;
  - `invoice_ref`: "N.º de factura".
  - Se muestran en la tabla y el dialog de Empresa, no en Personal.
  - La búsqueda de Movimientos también busca en ellos.
- Categorías del sistema de negocio (semilla) y categorías propias de la empresa con el gestor del SPEC 02 (`categories-sheet.tsx`).
- Registro rápido (`QuickAddTransactionButton`) también en Empresa, sobre la empresa activa.
- Eliminar empresa con periodo de gracia:
  - `AlertDialog` destructivo que exige escribir el nombre exacto, revalidado en el servidor;
  - al confirmar, marca la empresa y vuelve a `/dashboard/business/[id]`;
  - mientras está marcada, toda ruta de esa empresa muestra solo "Esta empresa se borrará el <fecha>" con "Restaurar empresa";
  - mientras está marcada, RLS bloquea escribir en sus movimientos, categorías, cuentas, traspasos, ajustes y perfil;
  - un job diario de `pg_cron` purga las empresas marcadas hace más de 30 días, en cascada.

**Fuera de alcance (para specs futuros):**

- Flujo de caja, reportes, gráficas, score y recomendaciones de Empresa (SPEC 11).
- IVA, retenciones y cualquier cálculo de impuestos.
- Facturación electrónica, inventario y nómina.
- Varios usuarios por empresa (socios, contadores) y su modelo de membresías.
- Plan premium y límites por plan.
- Presupuestos, metas, deudas, gastos recurrentes e importar en Empresa.
- Clientes y proveedores como entidades (hoy son texto libre).
- Validar el dígito de verificación del NIT.
- Correos que avisen del borrado de una empresa.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_business_workspaces.sql`.

```sql
-- Marca de borrado (solo Empresa; Personal nunca la tiene)
alter table public.workspaces
  add column deletion_requested_at timestamptz,
  add constraint workspaces_personal_not_deleted
    check (type = 'business' or deletion_requested_at is null);

-- Datos de la empresa, 1:1 con su espacio
create table public.business_profiles (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  tax_id text check (tax_id ~ '^\d{5,10}(-\d)?$'), -- NIT, DV opcional
  sector text not null,                          -- clave de SITE.businessSectors
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categorías: a qué tipo de espacio pertenecen
alter table public.categories
  add column scope public.workspace_type not null default 'personal';
-- Las propias toman el tipo de su espacio por trigger (set_category_scope)

-- Movimientos: contraparte y factura (solo se usan en Empresa)
alter table public.transactions
  add column counterparty text check (char_length(counterparty) between 1 and 80),
  add column invoice_ref text check (char_length(invoice_ref) between 1 and 40);
```

**Funciones** (todas con `search_path = ''`):

- `business_workspace_limit() returns integer`: devuelve `1`. Es el único punto a cambiar cuando exista un plan premium.
- `is_workspace_writable(p_workspace_id) returns boolean`, `security invoker`: dueño **y** `deletion_requested_at is null`.
- `create_business(p_name text, p_tax_id text, p_sector text) returns uuid`, `security invoker`:
  - inserta el espacio `business` y su `business_profiles` en una sola transacción;
  - respeta RLS y el trigger de límite.
- `request_workspace_deletion(p_workspace_id) returns timestamptz` y `cancel_workspace_deletion(p_workspace_id) returns void`, `security definer`:
  - solo actúan si `owner_id = auth.uid()` y `type = 'business'`;
  - `request_…` es idempotente: si ya hay marca, devuelve la existente.
  - `grant execute` solo a `authenticated`.
- `purge_deleted_workspaces() returns integer`, `security definer`:
  - `delete from public.workspaces where type = 'business' and deletion_requested_at < now() - interval '30 days'`;
  - `revoke` de `public`, `anon` y `authenticated`.
- Triggers:
  - `check_business_limit` (before insert en `workspaces`, tipo `business`): si el dueño ya tiene `business_workspace_limit()` empresas (marcadas incluidas), lanza `'Alcanzaste el límite de empresas'`.
  - `check_business_profile_workspace` (before insert en `business_profiles`): el espacio debe ser `business`.
  - `set_category_scope` (before insert or update en `categories`): si `workspace_id` no es null, `scope` = tipo del espacio.
  - `business_profiles_set_updated_at` con `set_updated_at()`.
  - Las funciones de trigger no se exponen como RPC.
- Cambios a funciones existentes:
  - `check_transaction_category` y `check_expense_category`: la categoría también debe tener `scope` igual al tipo del espacio.
  - Las funciones que buscan categorías del sistema por nombre (`create_debts.sql`, `import_recurring_debts_and_goals.sql`, `create_accounts_and_transfers.sql`) filtran `scope = 'personal'`.
  - `transaction_totals`: `p_search` también busca en `counterparty` e `invoice_ref`.

**RLS:**

- `workspaces`:
  - `insert`: `owner_id = auth.uid() and type = 'business' and deletion_requested_at is null`.
  - `update`: `using` y `with check` con `owner_id = auth.uid() and type = 'business'`.
  - Privilegio de columna: `revoke update on public.workspaces from authenticated; grant update (name) on public.workspaces to authenticated`. La marca solo cambia por las RPC.
  - Sin política de `delete`: la purga la hace `pg_cron`.
- `business_profiles`: `select` con `is_workspace_owner`; `insert` y `update` con `is_workspace_writable`. Sin `delete`.
- Las políticas de `insert`, `update` y `delete` de `transactions`, `categories`, `accounts`, `transfers` y `account_adjustments` pasan de `is_workspace_owner` a `is_workspace_writable`. Las de `select` no cambian.

**`pg_cron`:**

```sql
-- 08:15 UTC, después de purge-deleted-accounts
select cron.schedule(
  'purge-deleted-workspaces',
  '15 8 * * *',
  $$select public.purge_deleted_workspaces()$$
);
```

**Semilla de categorías del sistema de negocio** (`scope = 'business'`):

```text
income   Ventas de productos       package        emerald
income   Ventas de servicios       briefcase      teal
income   Otros ingresos            coins          lime
expense  Costo de ventas           store          amber
expense  Sueldos y honorarios      users          indigo
expense  Arriendo                  home           orange
expense  Servicios públicos        zap            blue
expense  Marketing y publicidad    megaphone      pink
expense  Transporte y logística    car            sky
expense  Software y herramientas   laptop         violet
expense  Impuestos y tasas         landmark       rose
expense  Comisiones bancarias      receipt        slate
expense  Otros gastos operativos   tag            slate
```

`store`, `package`, `users` y `megaphone` se agregan a `CATEGORY_ICONS` en `src/features/categories/constants.ts`.

**Constantes en `src/config/site.ts`:**

```ts
// Debe coincidir con public.business_workspace_limit(). La BD es la que manda
businessLimit: 1,

workspaceDeletionGraceDays: 30,

businessSectors: [
  { id: "commerce", label: "Comercio" },
  { id: "services", label: "Servicios" },
  { id: "manufacturing", label: "Manufactura" },
  { id: "technology", label: "Tecnología" },
  { id: "food", label: "Alimentos y restaurantes" },
  { id: "construction", label: "Construcción" },
  { id: "agriculture", label: "Agro" },
  { id: "health", label: "Salud" },
  { id: "education", label: "Educación" },
  { id: "transport", label: "Transporte" },
  { id: "other", label: "Otro" }
],

navigation: {
  // …existentes
  // `segment` se agrega a /dashboard/business/[id]
  business: [
    { name: "Resumen", segment: "", icon: "LayoutDashboard" },
    { name: "Movimientos", segment: "/transactions", icon: "ArrowLeftRight" },
    { name: "Cuentas", segment: "/accounts", icon: "Wallet" },
    { name: "Flujo de caja", segment: "/cash-flow", icon: "Activity" },
    { name: "Reportes", segment: "/reports", icon: "ChartColumn" },
    { name: "Recomendaciones", segment: "/recommendations", icon: "Lightbulb" },
    { name: "Ajustes", segment: "/settings", icon: "Settings" }
  ]
}
```

**Resolución del espacio** en `src/features/workspaces/queries.ts`:

```ts
export type Workspace = {
  id: string
  type: "personal" | "business"
  name: string
  currency: string
  deletionRequestedAt: string | null
}

getPersonalWorkspace()           // sin cambios
getBusinessWorkspaces()          // empresas del usuario, con su perfil
getWorkspace(id)                 // dueño o notFound(); con `cache`
requireWritableWorkspace(id)     // para actions: dueño y sin marca, si no lanza error
```

- El sector se valida solo con Zod contra `SITE.businessSectors`, sin `check` en la BD.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

## Plan de implementación

1. **Migración de datos y RLS.**
   - Columnas, `business_profiles`, `scope` (backfill implícito: todo lo existente queda `personal`), `counterparty` e `invoice_ref`.
   - Funciones, triggers, cambios a funciones existentes, políticas y privilegio de columna.
   - Semilla de categorías de negocio.
   - Regenerar `src/types/database.ts`.
   - Verificar: `supabase db reset` pasa. Personal sigue funcionando igual (crear, editar y borrar movimientos, categorías y cuentas).
2. **Purga.**
   - `purge_deleted_workspaces()` y el job `purge-deleted-workspaces`.
   - Verificar: `select * from cron.job` muestra los dos jobs.
3. **`SITE` y categorías.**
   - `businessLimit`, `workspaceDeletionGraceDays`, `businessSectors` y `navigation.business`.
   - Íconos nuevos en `CATEGORY_ICONS`.
   - `getCategories(workspaceId)` devuelve las del sistema con el `scope` del espacio más las propias.
4. **Resolución del espacio.**
   - `getWorkspace`, `getBusinessWorkspaces` y `requireWritableWorkspace` en `src/features/workspaces/queries.ts`.
   - Movimientos, categorías y cuentas reciben `workspaceId` (campo oculto o argumento) y lo validan con `requireWritableWorkspace`. Personal pasa su `id` y sigue igual.
   - `revalidatePath` según el espacio (`/dashboard/personal/...` o `/dashboard/business/[id]/...`).
   - Verificar: con Personal todo funciona como antes.
5. **Crear empresa.**
   - `src/features/business/schemas.ts`: `businessSchema` (nombre 2–60, `tax_id` opcional con el regex del modelo, `sector` en `z.enum`).
   - `src/features/business/actions.ts`: `createBusiness` llama a `create_business` y redirige a `/dashboard/business/[id]`. El error de límite se muestra en español.
   - `src/features/business/components/business-dialog.tsx` (crear y editar).
   - `app/dashboard/business/page.tsx`: redirige a la empresa si existe; si no, el estado vacío con el botón habilitado.
6. **Layout de la empresa y aside.**
   - `app/dashboard/business/[id]/layout.tsx`: `getWorkspace(id)`, 404 si no es `business`. Si está marcada, pinta la pantalla de restaurar en lugar de `children`.
   - `app-sidebar.tsx`: con el tab Empresa, construye los ítems desde `SITE.navigation.business` y el `id` de la ruta.
   - `src/features/business/components/business-switcher.tsx`: se pinta solo con más de una empresa.
   - Páginas "Próximamente" de `cash-flow`, `reports` y `recommendations`.
7. **Movimientos de Empresa.**
   - `app/dashboard/business/[id]/transactions/page.tsx` reutiliza la tabla, filtros, totales y paginación.
   - `transaction-dialog.tsx` y `transactions-table.tsx` reciben `workspaceType`. En `business` muestran "Cliente"/"Proveedor" y "N.º de factura", y los textos "Venta" y "Costo o gasto".
   - El schema acepta `counterparty` e `invoice_ref` opcionales. En Personal la action los guarda como `null`.
   - Búsqueda en `counterparty` e `invoice_ref` (query de la tabla y `transaction_totals`).
   - `categories-sheet.tsx` disponible en la página.
8. **Cuentas en Empresa.**
   - `app/dashboard/business/[id]/accounts/page.tsx` reutiliza los componentes del SPEC 08c con el `workspaceId` de la empresa.
9. **Resumen de Empresa.**
   - `app/dashboard/business/[id]/page.tsx`: tarjetas "Ventas", "Costos y gastos" y "Utilidad" del mes actual (`transaction_totals` con el rango del mes) y los últimos 5 movimientos.
10. **Registro rápido.**
    - `QuickAddTransactionButton` se muestra en `/dashboard/personal/*` y en `/dashboard/business/[id]/*`.
    - `QuickAddTransaction` carga categorías y cuentas del espacio activo.
11. **Ajustes y borrado.**
    - `app/dashboard/business/[id]/settings/page.tsx`: formulario de nombre, NIT y sector (`updateBusiness`).
    - `delete-business-dialog.tsx`: botón habilitado solo si el texto es igual al nombre.
    - Action `requestBusinessDeletion`: revalida el nombre en el servidor y llama a `request_workspace_deletion`.
    - `business-deleted.tsx` (pantalla del layout): fecha de borrado en `America/Bogota` y "Restaurar empresa" (`cancelBusinessDeletion`).
12. **Docs.**
    - `docs/producto.md`: espacio Empresa, límite, categorías de negocio y borrado con gracia.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).
    - `CLAUDE.md`: el job `purge-deleted-workspaces`, `business_workspace_limit()` y `is_workspace_writable`.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y no hay dependencias nuevas.
- [ ] `supabase db reset` aplica las migraciones sin errores.
- [ ] Sin empresa, el tab Empresa muestra el estado vacío con "Crear empresa" habilitado.
- [ ] Crear "Panadería Ana" con sector Alimentos y sin NIT lleva a `/dashboard/business/<id>` y el aside muestra los 7 ítems de Empresa.
- [ ] Un NIT `900123456-7` se guarda. Un NIT `ABC123` muestra un error de validación y no guarda.
- [ ] Un nombre de 1 o de 61 caracteres muestra un error de validación y no guarda.
- [ ] Con una empresa creada, `/dashboard/business` redirige a ella y el estado vacío no aparece.
- [ ] Llamar `create_business` desde SQL con la sesión de un usuario que ya tiene una empresa falla con "Alcanzaste el límite de empresas".
- [ ] Con `business_workspace_limit()` cambiado a 2 en local, el selector de empresa aparece en el aside y cambia entre las dos.
- [ ] `/dashboard/business/<id de otro usuario>` y `/dashboard/business/<id del espacio Personal>` dan 404.
- [ ] El dialog de movimientos de Empresa solo lista categorías de negocio (sistema y propias). El de Personal no lista ninguna de negocio.
- [ ] Insertar desde SQL un movimiento de Personal con la categoría "Costo de ventas" falla.
- [ ] Registrar una venta de 150.000 con cliente "Café Sol" y factura "FV-001" la muestra en la tabla con esos datos.
- [ ] Buscar "FV-001" o "Café" en Movimientos de Empresa encuentra esa venta y los totales coinciden.
- [ ] En Personal, el dialog y la tabla no muestran cliente, proveedor ni factura.
- [ ] Una categoría propia creada en Empresa no aparece en Personal, y viceversa.
- [ ] La empresa nueva tiene la cuenta "Efectivo". Crear una cuenta y un traspaso en Empresa no los muestra en Personal.
- [ ] El Resumen de Empresa muestra Ventas, Costos y gastos, y Utilidad (ventas − costos) del mes actual, y los últimos 5 movimientos.
- [ ] El registro rápido en `/dashboard/business/<id>` crea el movimiento en la empresa, no en Personal.
- [ ] Flujo de caja, Reportes y Recomendaciones muestran "Próximamente".
- [ ] Editar nombre, NIT y sector en Ajustes los actualiza en la página y en el aside.
- [ ] Un `update` directo de `deletion_requested_at` o `type` en `workspaces` con la sesión del usuario falla.
- [ ] En el dialog de eliminar, el botón queda deshabilitado hasta escribir el nombre exacto.
- [ ] Programar el borrado muestra en toda ruta de la empresa "Esta empresa se borrará el <hoy + 30 días>" y "Restaurar empresa".
- [ ] Con la empresa marcada, insertar un movimiento, una categoría o una cuenta en ella desde SQL con la sesión del usuario falla.
- [ ] Con la empresa marcada, crear otra empresa falla por el límite.
- [ ] "Restaurar empresa" quita la marca y vuelve al Resumen con todos los datos intactos.
- [ ] Con la marca a hace 31 días, `select public.purge_deleted_workspaces()` devuelve 1 y no quedan filas de esa empresa en `workspaces`, `business_profiles`, `transactions`, `categories`, `accounts`, `transfers` ni `account_adjustments`. El espacio Personal sigue intacto.
- [ ] Con la marca a hace 29 días, `purge_deleted_workspaces()` devuelve 0.
- [ ] Un usuario `authenticated` no puede ejecutar `purge_deleted_workspaces()`. Ejecutar `request_workspace_deletion` con el `id` de Personal o de otro usuario no marca nada.
- [ ] Movimientos, categorías, cuentas, presupuestos y deudas de Personal funcionan igual que antes de este spec.
- [ ] Ningún archivo del proyecto usa la `service_role` ni la clave secreta.

## Decisiones

- **Sí:** límite de 1 empresa, en la BD con `business_workspace_limit()`. Un plan premium solo cambia esa función.
- **No:** empresas ilimitadas ni límite solo en la UI. La API pública permitiría saltárselo.
- **Sí:** `SITE.businessLimit` para la UI, aunque duplica el valor. La BD es la que manda y el comentario lo dice.
- **Sí:** rutas `/dashboard/business/[id]/...` desde ya. Subir el límite no obliga a cambiar rutas.
- **Sí:** selector de empresa construido pero visible solo con más de una.
- **No:** rutas sin `[id]`. Habría que migrarlas al llegar premium.
- **Sí:** tabla `business_profiles` 1:1. `workspaces` queda genérico y Personal no carga columnas nulas.
- **No:** columnas de empresa en `workspaces`.
- **Sí:** `create_business` como RPC `security invoker`. Crea espacio y perfil en una transacción y respeta RLS.
- **Sí:** `categories.scope` con semilla de negocio. Reutiliza la tabla y los triggers de validación.
- **No:** copiar la semilla como categorías propias al crear la empresa. Duplica filas y complica mejorar la semilla.
- **Sí:** `counterparty` e `invoice_ref` en `transactions`, opcionales y como texto libre.
- **No:** tablas de clientes y proveedores. Van en su propio spec si se necesitan.
- **No:** IVA y retenciones. Tocan reglas fiscales y reportes; van después.
- **Sí:** NIT validado solo por formato (`5–10 dígitos` + DV opcional).
- **No:** validar el dígito de verificación de la DIAN. Es opcional y puede llegar después.
- **Sí:** sector como lista cerrada en `SITE.businessSectors`, validada con Zod. Agregar uno no exige migración.
- **Sí:** reutilizar cuentas y traspasos del SPEC 08c en Empresa. El trigger ya crea "Efectivo".
- **Sí:** Resumen básico sin gráficas. Las gráficas y el flujo de caja son del SPEC 11.
- **Sí:** borrado con 30 días de gracia y job `pg_cron` propio. Mismo patrón que la cuenta (SPEC 09).
- **No:** borrado inmediato. Fue la recomendación inicial, pero el usuario eligió la gracia.
- **Sí:** la marca en `workspaces.deletion_requested_at`, cambiada solo por RPC `security definer`. El privilegio de columna impide que el usuario la edite.
- **Sí:** la empresa marcada cuenta para el límite. Restaurar nunca choca con otra empresa activa.
- **Sí:** pantalla de restaurar en las rutas de la empresa marcada, y RLS que bloquea escrituras con `is_workspace_writable`.
- **No:** ocultar la empresa marcada. Restaurar sería difícil de descubrir.
- **Sí:** confirmar escribiendo el nombre exacto, revalidado en el servidor.
- **Sí:** sin política de `delete` en `workspaces`. Solo la purga borra.
- **No:** preparar membresías (`workspace_members`) para socios o contadores. Todas las políticas pasan por `is_workspace_owner`/`is_workspace_writable`, así que un spec futuro cambia esas dos funciones.
- **Sí:** registro rápido y gestor de categorías también en Empresa.

## Riesgos

| Riesgo                                                                                                                        | Mitigación                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generalizar las actions de movimientos, categorías y cuentas rompe Personal                                                   | El paso 4 se hace antes de cualquier UI de Empresa y se verifica Personal completo. Un criterio de aceptación lo repite al final                                           |
| Las búsquedas de categorías del sistema por nombre (deudas, importar, cuentas) encuentran una de negocio                      | El paso 1 agrega `scope = 'personal'` a esas funciones. Los nombres de la semilla de negocio tampoco chocan con los personales salvo "Otros ingresos"                      |
| Las tablas solo personales (presupuestos, metas, deudas, recurrentes, importar, score) aceptan el `id` de una empresa por API | Sus actions usan `getPersonalWorkspace()` y la UI no las expone en Empresa. Los datos se borran igual en la purga. Restringirlas por RLS queda para cuando Empresa las use |
| `SITE.businessLimit` y `business_workspace_limit()` se desincronizan                                                          | La BD manda: el error de límite se muestra aunque la UI deje intentar                                                                                                      |
| `revoke update` de tabla en `workspaces` rompe updates existentes                                                             | Hoy nadie actualiza `workspaces` desde el cliente. El trigger `handle_new_user` inserta como `security definer`                                                            |
| La cascada de la purga choca con FK                                                                                           | Las FK `restrict` ya son `no action` (SPEC 09). Un criterio de aceptación purga una empresa con datos en todas sus tablas                                                  |
| Cambiar las políticas de 5 tablas a `is_workspace_writable` deja huecos                                                       | Se reemplazan solo `insert`, `update` y `delete`, una por una. `select` no cambia. Personal nunca tiene marca (`check` en `workspaces`)                                    |

## Lo que **no** entra en este spec

- Flujo de caja, reportes, score y recomendaciones de Empresa (SPEC 11).
- IVA, retenciones y facturación electrónica.
- Inventario y nómina.
- Socios, contadores y varios usuarios por empresa.
- Plan premium.
- Presupuestos, metas, deudas, recurrentes e importar en Empresa.
- Clientes y proveedores como entidades.

Cada uno de esos puntos, si llega, va en su propio spec.
