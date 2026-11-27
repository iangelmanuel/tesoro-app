# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

**Tesoro** es un gestor y recomendador de finanzas personales y empresariales,
de código abierto (MIT, autor Angel De La Torre / Angel DM). La app no parte de
cero ni conecta bancos: se alimenta de los registros que el usuario introduce
(ingresos, gastos, deudas, metas) y a partir de ellos genera gráficas claras,
recomendaciones y un score de salud financiera.

Estado: **v0.4.0**. La app está construida (ver `README.md#hoja-de-ruta`,
`docs/producto.md` y `specs/`):

1. Landing (`/`), legales (`/legal/*`) y guía del MCP (`/mcp`)
2. Auth con Supabase (`/sign-in`, `/sign-up`, Google y GitHub) y Cuenta
3. Dashboard (`/dashboard`) con un aside. Arriba del aside va un selector tipo
   tab **Personal / Empresa**:
   - **Personal** es el espacio por defecto. Todo usuario lo tiene desde el
     registro, con su estructura completa: resumen, movimientos,
     presupuestos, metas, deudas, reportes y recomendaciones.
   - **Empresa** es opcional. Si el usuario no tiene uno, el dashboard
     muestra un estado vacío que lo invita a crearlo. Su estructura: flujo
     de caja, ventas, costos/gastos operativos, reportes y recomendaciones.
4. Movimientos, gráficas, score y recomendaciones en ambos espacios, más
   importar, exportar y el servidor MCP para agentes de IA

`docs/producto.md` es la especificación de producto. Actualízalo cuando se
definan detalles, por ejemplo los factores y pesos del score.

## Comandos

Usa pnpm **12.18.0** (`packageManager`) con Node ≥ 24.19.0. Si el pnpm global
de la máquina es más viejo, antepone `npx -y pnpm@12.18.0`.

```bash
pnpm dev              # servidor de desarrollo (localhost:3000)
pnpm build            # build de producción
pnpm check            # tsc --noEmit
pnpm eslint           # lint (eslint:fix para corregir)
pnpm prettier         # formatea (prettier:check solo verifica)
pnpm next typegen     # regenera los tipos de typedRoutes (antes de `check`)
pnpm test             # Vitest: tests de lógica pura (test:watch en modo watch)
pnpm brand:assets     # regenera PNG, favicon y logo/fuentes de los exports (assets/)
```

Supabase (CLI global; el proyecto remoto se enlaza con `supabase link`):

```bash
supabase migration new <nombre>   # nueva migración en supabase/migrations/
supabase db push                  # aplica las migraciones al proyecto enlazado
supabase gen types typescript --linked --schema public > src/types/database.ts
supabase start / stop             # stack local (requiere Docker, pesa en RAM)
supabase db reset                 # reaplica las migraciones en local
```

Tras cambiar el esquema, regenera `src/types/database.ts` y pásale Prettier.

Videos de la landing (SPEC 24). Solo en local: `video/` (proyecto
Hyperframes) y los scripts `scripts/seed-demo.mjs`, `record-demo.mjs`,
`prepare-demo-video.mjs` y `scripts/demo/` están git-ignorados, igual que
las skills de Hyperframes. Al repo solo llega el resultado en `public/videos/`
(MP4 + WebM + póster, ≤ 20 MB en total; el hero, ≤ 3 MB; SPEC 56c). Requiere
FFmpeg y Docker.

```bash
supabase start                         # Supabase local (el seed se niega con otra URL)
node scripts/seed-demo.mjs             # usuario demo con Personal y Empresa
pnpm build && pnpm start               # la app que se graba (sin overlay de dev)
node scripts/record-demo.mjs [tomas]   # Playwright: .webm + .json del cursor en video/raw/
node scripts/prepare-demo-video.mjs    # tomas H.264 y cursor-data.js para Hyperframes
cd video && npx hyperframes render     # video principal (clips: -c clips/<slug>.html)
```

Los renders quedan en `video/renders/<nombre>-master.mp4` y se codifican
con FFmpeg, sin audio (SPEC 56c):

- **Demo:** 1920 × 1080, H.264 `-preset slow -tune animation` CRF 32 con
  `+faststart` y VP9 CRF 53 (`-b:v 0`). VP9 conserva los separadores finos
  de la UI mejor que H.264 a igual peso.
- **Clips de funciones** (`registros`, `score`, `espacios`, `graficas`,
  `recomendaciones`): escalados a 1280 × 720 (lanczos), H.264 CRF 26
  (mismos ajustes) y VP9 CRF 36. Póster WebP (calidad 80) a 1280 × 720 del
  fotograma 45 (1,5 s).

El clip de agentes (SPEC 34) no graba la app: es HTML en
`video/clips/agentes.html`. Se renderiza con
`npx hyperframes render -c clips/agentes.html -q delivery` y se codifica
a 864 × 960 (H.264 `-tune animation` CRF 27 y VP9 CRF 40, sin audio) más el
póster WebP del segundo 12,9.

El video del hero (SPEC 40) tampoco graba la app: es un proyecto aparte en
`video/hero/` con tomas de stock (Pexels, créditos en
`docs/creditos-media.md`) en color natural, con un `adjust` suave de
`hyperframes media-treatment` (sin lavado, LUT ni viñeta).

```bash
cd video/hero
npx hyperframes render -q delivery --video-frame-format png -o renders/hero-master.mp4
npx hyperframes render -c clips/mobile.html -q delivery --video-frame-format png -o renders/hero-mobile-master.mp4
```

Se codifica sin audio: H.264 `-preset slow -tune film` CRF 36 (escritorio)
y 34 (móvil) con `+faststart`, VP9 CRF 45, y el póster WebP del primer
fotograma de cada uno, a `public/videos/hero*` (SPEC 56c).

Las variables (`DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`
local) van en el entorno o en `.env.local`, nunca en el repo. Al
re-renderizar, actualiza `SITE.landing.demo.durationSeconds`.

Tests (SPEC 54): Vitest, solo lógica pura, en `*.test.ts` junto al módulo
(`vitest.config.mts`, entorno `node`; `server-only` se cambia por un stub).
Antes de mover o cambiar un cálculo, un test de caracterización fija lo que
hace hoy. El CI (`.github/workflows/ci.yml`) corre `check`, `eslint`,
`prettier:check` y `test`, y luego `build` con
`pnpm install --frozen-lockfile`. Por eso el lockfile tiene que estar siempre
sincronizado con `package.json`.

## Arquitectura

La guía completa (capas, anatomía de una feature, flujo de un dato, nombres,
tests y lista de chequeo de PR) está en
[`docs/arquitectura.md`](docs/arquitectura.md). ESLint hace cumplir las
fronteras de capas y de paquetes (`no-restricted-imports` en
`eslint.config.mjs`), los nombres de archivo en kebab-case y avisa desde 400
líneas por archivo. Queries y servicios llevan `import "server-only"`.

- **`src/config/site.ts` (`SITE`)** es la fuente única de verdad para marca,
  autor, repo, rutas (`SITE.routes`), espacios (`SITE.workspaces`), funciones
  de la landing, navegación, legales y todos los valores de SEO. Los textos de
  marca, URLs y metadatos se leen de aquí, no se duplican en componentes. El
  objeto es `as const`: al pasar arrays a tipos mutables de Next, haz spread
  (`[...SITE.seo.manifestCategories]`).
- **`src/libs/seo.ts`**:
  - `buildMetadata(options)` genera la metadata de cada página: canonical,
    robots, Open Graph y Twitter. Cada `page.tsx` debe usarla.
  - Builders de JSON-LD: `buildApplicationSchema` (`WebApplication`),
    `buildWebsiteSchema` y `buildAuthorSchema` (`Person`), enlazados por
    `@id` (`#application`, `#website`, `#author`), más
    `buildBreadcrumbSchema`.
  - `app/layout.tsx` inyecta los tres primeros vía `<JsonLd />`
    (`src/components/seo/json-ld.tsx`).
- **Rutas de metadata** en `app/`: `robots.ts`, `sitemap.ts` y `manifest.ts`,
  todas derivadas de `SITE`:
  - `robots.ts` bloquea `/dashboard/`, `/api/`, `/auth/` y `/oauth/`.
  - Las rutas públicas nuevas se agregan a `STATIC_ROUTES` en `sitemap.ts`.
- **Exportar** (SPEC 32 y 33): `app/api/export/[workspaceId]/route.ts`
  responde el `.xlsx`, el `.csv` o el `.pdf`. `exceljs` solo se importa desde
  `src/features/exports/workbook/`, y `pdfmake`, `html-to-pdfmake` y `jsdom`
  solo desde `src/features/exports/pdf/`; nunca desde un componente cliente.
  `pdfmake` va en `serverExternalPackages` (`next.config.ts`). Las lecturas
  entran por `exports/queries.ts` (`loadExportData`) y viven por sección:
  `movement-export-queries.ts` (lo común), `personal-export-queries.ts`,
  `debt-export-queries.ts` y `business-export-queries.ts`, con los cálculos
  puros en `export-calculations.ts`. Los Route
  Handlers resuelven el espacio con `findWorkspace` (null → 404 en JSON), no
  con `getWorkspace` (`notFound()` responde HTML). Si cambian `--accent`,
  `--income`, `--expense`, `--muted`, `--balance` o `--chart-*`, actualiza
  `workbook/theme.ts` (de ahí también lee `pdf/theme.ts`). Las notas y
  descripciones del usuario nunca pasan por HTML en el PDF.
- **Importar** (SPEC 08 y 08b): el asistente vive en
  `src/features/imports/components/` (`use-import-wizard.ts`, reducer en
  `wizard-state.ts`, tipos en `wizard-types.ts` y datos derivados en
  `wizard-selectors.ts`). La normalización es pura: `normalize-values.ts`
  (fechas, montos, filas de las tablas), `normalize-transactions.ts` y un
  `normalize-*.ts` por destino. Una action por destino
  (`transaction-import-actions.ts`, `recurring-import-actions.ts`,
  `debt-entry-import-actions.ts`, `goal-contribution-import-actions.ts`)
  sobre `import-service.ts`; duplicados y deshacer en `actions.ts`.
- **MCP para agentes de IA** (SPEC 34, guía en `docs/mcp.md`):
  `app/api/mcp/route.ts` (Streamable HTTP sin estado,
  `@modelcontextprotocol/sdk`) con OAuth 2.1 del servidor de Supabase
  (consentimiento en `app/oauth/consent/`, descubrimiento en
  `app/.well-known/*`). El Bearer se valida en `src/features/mcp/auth.ts`
  (`getClaims` + `getUser`) y se usa con la clave publicable: todo pasa por
  RLS, nunca `service_role`. La ruta corre dentro de
  `runWithSupabaseClient`, así `createClient()` devuelve el cliente del
  agente y las tools reusan las consultas de la UI; ahí no sirven funciones
  que lean la sesión sin token (`getPersonalWorkspace`). Las tools viven en
  `src/features/mcp/tools/`, un archivo por tool (`tools/write/create-debt.ts`,
  `record-debt-payment.ts`…), y se registran en `catalog.ts`;
  `catalog.test.ts` fija su nombre, descripción y esquema (de ahí sale
  también la página `/mcp`). Las escrituras usan los servicios compartidos
  con las actions (`transactions/service.ts`, con sus mensajes en
  `transactions/transaction-errors.ts`, `accounts/transfer-service.ts`, `debts/entry-payment-service.ts`,
  `debts/entry-service.ts`, `debts/receivable-service.ts`,
  `goals/contribution-service.ts`, `categories/service.ts`) y los
  prellenados del diálogo de movimiento (`recurring-expenses/payment.ts`,
  `incomeReceiptValues` en `recurring-incomes/receipt.ts`), validan todo
  antes de escribir y dejan log en `mcp_operations` para revertir con
  `undo_mcp_operation`. La excepción es `import_statement` (SPEC 43): valida
  con los esquemas de la UI y luego inserta en bloque. Si falta un dato o es
  ambiguo, la tool no escribe y responde `needs_input` (`needsInput` en
  `tools/shared.ts`; cuenta y categoría por id o nombre en
  `tools/write/references.ts`). Una tabla nueva en el log va en
  `SNAPSHOT_TABLES` y en el `check` de `mcp_operation_rows.table_name`; las
  asignaciones (`debt_entry_allocations`, `recurring_income_allocations`) las
  restaura undo al final, por padre. `/api/mcp` y `/.well-known/*` no pasan
  por `updateSession` (matcher de `proxy.ts`).
- `app/` contiene solo rutas. El resto del código vive en `src/` (alias
  `@/*` → `./src/*`). Estilos globales en `src/styles/globals.css` (Tailwind
  4, cargado vía `@tailwindcss/turbopack` en `next.config.ts`).

## UI y tema

- **Contexto de diseño**: `PRODUCT.md` (usuarios, propósito, voz, principios
  y restricciones visuales) es el contexto de Impeccable
  (`.claude/skills/impeccable/`). Léelo antes de diseñar o revisar UI.
- **`docs/ui.md`** es la guía de la interfaz: tokens, contraste verificado,
  componentes propios, dónde vive cada pantalla y cómo usar los comandos de
  Impeccable (`teach`, `audit`, `critique`, `polish`, `distill`, `animate`).
- **Tema**: las páginas públicas (`/`, `/legal/*`, `/mcp`) van siempre en
  claro: `app/(public)/layout.tsx` monta `ThemeProvider` con
  `forcedTheme="light"` y cada otro grupo de rutas monta el suyo (nunca en el
  layout raíz, SPEC 40). En el resto,
  Atkinson Hyperlegible Next (local con `next/font/local`, `--font-sans`;
  también en los PDF) y oscuro por defecto
  (`defaultTheme="dark"`; el tema se cambia en el menú de cuenta). Fondo casi
  negro y tarjetas gris oscuro **sin borde**; radios grandes en tarjetas y
  pill en botones, tabs y selects. Montos con `tabular-nums`.
- **Un solo título por pantalla**: lo pone el header (`DashboardTitle`); las
  páginas no repiten `<h1>`. Las acciones principales van en los accesos
  rápidos del header, no en la página.
- KPIs con `StatCard`, cabeceras de tarjeta con `CardHeading`, ayudas con
  `HelpHint` (textos en `src/config/help.ts`), vacíos con `EmptyState` /
  `CardEmpty`. Estados con `tone.ts`, nunca con la paleta cruda de Tailwind.
  Las piezas compartidas del dashboard viven en `src/components/dashboard/`
  por rol: `shell/`, `quick-actions/`, `hide-amounts/`, `feedback/`, `data/`,
  `overlays/`, más `command/`, `mobile/`, `shortcuts/` y `sidebar/`.
- **Skeletons** (SPEC 51): cada componente que carga datos exporta su
  `…Skeleton` en el mismo archivo y con el mismo contenedor (mismas filas,
  alturas y radios). `Suspense` por tarjeta y un `loading.tsx` por ruta que
  los compone dentro de `LoadingRegion` (`aria-busy`). Las pantallas
  arman su skeleton en un archivo `…-screen-skeleton.tsx` (o junto al
  componente) para reusarlo en el `Suspense` y en el `loading.tsx`.
- **Carga diferida y React Compiler** (SPEC 56b): `reactCompiler: true`
  memoiza el cliente; no se agregan `memo` / `useMemo` / `useCallback`
  nuevos, no se suprimen reglas `react-hooks` (`useEffectEvent` en su
  lugar) y `"use no memo"` va siempre con comentario. Lo que no se usa al
  entrar se carga con `lazyWithPreload` (`src/libs/lazy-with-preload.ts`)
  dentro de un `Suspense` con su skeleton y precarga en `onPointerEnter` /
  `onFocus` del disparador (`onTriggerIntent` en `FormDialog`, `preload`
  de `useQuickActions`): gráficas desde su `…-lazy.tsx`, formularios de
  diálogo, paleta, calendario de `DatePickerField`, `@dnd-kit` de
  Movimientos (en idle) y el cuerpo de los Sheets de detalle
  (`…-sheet-body.tsx`). Skeletons y constantes no se importan del módulo
  diferido. Ver `docs/ui.md#carga-diferida-spec-56b`.
- **Montar solo lo que se ve** (SPEC 57): los diálogos controlados se montan
  al abrirse (`useOpenedOnce`) y lo propio de una pantalla, solo en ella
  (`useViewport` + cookie `tesoro-viewport`, sin efectos que cambien lo
  pintado). Metas, deudas, cobros, gastos e ingresos fijos de los accesos
  rápidos no viajan en el layout: se piden con
  `GET /api/quick-actions/form-data`. Ver `docs/ui.md#montar-solo-lo-que-se-ve-spec-57`.
- Listas y tarjetas de grilla con las clases de
  `src/components/dashboard/data/surface.ts`, sin `rounded-xl border` ni
  `border-dashed`. Los campos de formulario van con relleno suave y sin borde
  (tokens `--field-*` en `globals.css`).
- Los traspasos se registran desde el diálogo de movimiento (opción
  "Traspaso"); las páginas no llevan un botón de traspaso aparte.
- **shadcn + Base UI** (SPEC 51, `components.json` con `style: "base-maia"`):
  las primitivas viven en **`src/components/ui/`** y son código nuestro (se
  personalizan ahí, no se envuelven). Se agregan con
  `pnpm exec shadcn add <nombre>` y luego se reescribe `from "cn"` a
  `@/libs/cn` y `bg-accent` / `bg-muted` a `bg-highlight` / `bg-subtle`.
  `cn` sale de `@/libs/cn` (`clsx` + `tailwind-merge`). Botones con
  `onClick` y `disabled`; 44 px de área táctil (`touch-hitbox` para lo que
  se dibuja más chico); foco con `outline-2 outline-offset-2 outline-ring`.
  Toda la app (dashboard, cuenta, auth, OAuth y públicas) usa solo shadcn +
  Base UI (SPEC 53). Las props de estado son las nativas (`disabled`,
  `onClick`); `RowAction` también usa `disabled`. El aside móvil, los Sheets
  de detalle (`DetailSheet`) y el menú móvil público son modales.
- Formularios (SPEC 52a): `useActionState` + Zod, con las piezas de
  `src/components/forms/`:
  - `TextInputField` (`FieldLabel` + `Input` + `FieldError`), `SelectField`
    (Select corto; opciones con `description` opcional), `SegmentedField`
    (2 o 3 opciones como tabs; `SEGMENT_TRACK_CLASS` / `SEGMENT_ITEM_CLASS`
    para las que van en línea) y `CreatableSelect` (Combobox con búsqueda y
    "+ Crear …", base de `AccountSelectField` y `CategorySelectField`);
  - `amount-format.ts`: `amountInput` / `rateInput` dan el texto inicial de
    un monto o una tasa en un campo (es-CO);
  - `FormDialog` (Dialog de shadcn con título, descripción y el formulario;
    controlado o con `trigger`, que es un `ReactElement`);
  - el error del servidor va por `error` y se anuncia con `aria-invalid` +
    `aria-describedby` hacia `FieldError` (`role="alert"`); el cliente no
    valida antes.
    `FieldLabel` es el `Label` de `ui/` con asterisco (`isRequired`), rojo
    (`isInvalid`) y atenuado (`disabled`), más el (?) de `FieldHelp`.
- Fechas: `DatePickerField` (`src/components/forms/date-picker-field.tsx`):
  botón + `Calendar` (react-day-picker) en un `Popover`, semana desde el lunes,
  con `YYYY-MM-DD` (pasa a `Date` local a mediodía solo para pintar). Hora
  opcional de un evento: `TimePickerField`, `<input type="time">` nativo con
  "Quitar hora" (`HH:MM` o `""`) y `timeSchema`; se muestra con `formatTime`.
  Toasts: `toast` de `@/components/ui/sonner` (errores con `toast.error`, en
  `role="alert"`). El `Toaster` vive en el layout del dashboard; fuera de
  él solo lo monta `app/account-deleted/layout.tsx`. `FormDialog` siempre es
  modal.
- Gráficas: Recharts con `src/components/charts/*`: `ChartCard` (cabecera
  con leyenda y cifra), `ChartContainer`, las props de `chart-style.ts` y los
  montos abreviados de `chart-format.ts`. Colores siempre desde tokens.
  Funciones que llaman componentes de servidor no van en archivos
  `"use client"`.
- Tokens en `globals.css` con los nombres de shadcn (`--background`,
  `--card`, `--popover`, `--primary`, `--secondary`, `--muted-foreground`,
  `--destructive`, `--border`, `--input`, `--ring`, `--sidebar-*`,
  `--chart-*`, `--radius`), con dos renombres: `--highlight` (el `--accent`
  de shadcn) y `--subtle` (su `--muted`); el texto atenuado es
  `text-muted-foreground`. Más
  los propios `--brand`, `--income` (turquesa), `--expense` (coral),
  `--balance` (tinta), `--category-*`, `--field-*`, `*-soft` de estados y
  las sombras.
- Primario por espacio: `WorkspaceThemeRoot` + `getWorkspaceTheme(pathname)`
  ponen `data-workspace` y `globals.css` cambia `--primary`, `--ring` y
  `--sidebar-primary` con `:has()`. Neutro fuera del dashboard, emerald en
  Personal, naranja en Empresa. Nunca se pasa el color por props;
  `data-workspace` solo aparece en esos dos archivos. Los overlays de
  Base UI se montan en ese contenedor (`PortalContainerProvider`).
- **Aside** (SPEC 31): `SITE.navigation.personal` / `.business` son grupos
  (`{ label, items }`): "Día a día", "Tu plan" / "Tu operación" (donde se
  configura) y "Entiende tu dinero" / "Entiende tu negocio". Los
  consumidores planos usan `flattenNav` (`shell/nav.ts`). En escritorio el ancho se
  ajusta (240–360 px) y se guarda en la cookie `tesoro-sidebar-width`
  (`sidebar/width.ts`). Cada ítem lleva su letra de atajo (`shortcut`), que
  el aside muestra como estación de la línea del espacio. Ver `docs/ui.md`.
- **Menús rápidos** (SPEC 51): una sola lista de acciones en
  `quick-actions/quick-actions-context.tsx` (`actions` + `run(key)`) para el header, la
  hoja móvil y la paleta. Paleta de comandos en `dashboard/command/`
  (⌘K / Ctrl+K; Tus datos con `loadCommandEntities` y
  `requireWorkspace`). Atajos en `src/config/shortcuts.ts` +
  `dashboard/shortcuts/` (N, T, ?, G + letra), apagables con la cookie
  `tesoro-shortcuts`. Menú contextual de fila con `RowContextMenu`.
- **Móvil (`< 768 px`)**: hoja de acciones rápidas (Drawer de Base UI, con
  "Buscar o ejecutar" y la lista de acciones) y barra inferior
  (`src/components/dashboard/mobile/`) en vez del aside; el selector Personal /
  Empresa vive solo en el aside (Sheet). Tablas en `ScrollTable` (se
  deslizan en horizontal), filtros de Movimientos en hoja y controles de
  44 px o más. Ver
  `docs/ui.md#móvil`.
- Todo par texto/fondo nuevo debe dar AA (4.5:1 texto, 3:1 gráficos y foco)
  en claro y oscuro.
- `next.config.ts` tiene activos `cacheComponents`, `partialPrefetching` y
  `typedRoutes`, entre otras opciones. Antes de usar APIs de Next, consulta
  `node_modules/next/dist/docs/`.
- `NEXT_PUBLIC_SITE_URL` define la URL base (canonical/OG/sitemap). Variables
  en `.env.example`. Supabase usará `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Supabase

- Toda tabla con datos de usuario lleva RLS con políticas explícitas.
- Los datos se separan por espacio (Personal/Empresa) y se validan contra el
  usuario autenticado en el servidor.
- El cliente solo usa la clave publicable. La `service_role` nunca llega al
  navegador.
- Los cambios de esquema van en migraciones versionadas.
- Storage: bucket público `avatars` (1 MB, solo WebP), escritura solo en la
  carpeta `<user_id>/`. Postgres no borra archivos de Storage: se borran desde
  las actions con la sesión del usuario.
- `pg_cron` corre tres jobs diarios:
  - `purge-deleted-accounts` borra las cuentas marcadas para borrar hace más
    de 30 días (`raw_app_meta_data.deletion_requested_at`);
  - `purge-deleted-workspaces` borra las empresas marcadas hace más de 30 días
    (`workspaces.deletion_requested_at`);
  - `purge-mcp-operations` borra las operaciones del MCP de más de 30 días
    (ventana para revertir).
- Servidor OAuth 2.1 de Supabase activo (Authentication → OAuth Server, ruta
  `/oauth/consent`, registro dinámico; `[auth.oauth_server]` en
  `config.toml`). Las claves de firma JWT son asimétricas (ES256).
- `business_workspace_limit()` es el único punto que fija cuántas empresas
  tiene un usuario (hoy 1). `SITE.businessLimit` solo lo refleja en la UI.
- Las políticas de las tablas de un espacio usan funciones de conjunto
  (SPEC 56a): `workspace_id = any (array(select public.owned_workspace_ids()))`
  para `select` y `... writable_workspace_ids()` (dueño y sin marca de
  borrado) para escribir. El `array(select …)` se evalúa una vez por consulta
  (InitPlan); no se llama `is_workspace_owner(workspace_id)` ni
  `is_workspace_writable(workspace_id)` en una política (son por fila; se
  quedan para RPC y triggers). Cada llave foránea lleva índice. El acceso lo
  fija `supabase/tests/rls_workspace_access.test.sql` (pgTAP,
  `supabase start` + `supabase test db`): una tabla nueva con `workspace_id`
  entra en su matriz. Las imágenes locales nuevas de Supabase no dan permisos
  de tabla por defecto; el test replica los de producción.
- En las actions, el espacio se resuelve con `requireWritableWorkspace(id)`
  y, tras escribir, se revalida con
  `revalidateWorkspacePages` (`src/features/workspaces/revalidate.ts`). Los
  servicios devuelven `ServiceResult` (`workspaces/service-result.ts`).
- Tesoro no envía correos por ahora: sin confirmación de email, recuperar
  contraseña ni cambio de email. En Supabase, _Confirm email_ va apagado. Al
  integrar un servicio de correo propio se reactivan esos flujos.

## Convenciones

- **Versiones exactas, sin `^` ni `~`**, por seguridad. `saveExact: true` en
  `pnpm-workspace.yaml` lo aplica a `pnpm add`. Builds nativos permitidos en
  `allowBuilds` (ahí `sharp: true`).
- Prettier: sin punto y coma, comillas dobles, sin trailing commas, un
  atributo JSX por línea, imports ordenados automáticamente (react → next →
  terceros → `@/` → relativos → CSS) y clases de Tailwind ordenadas.
- Naming: archivos kebab-case, componentes PascalCase, constantes
  UPPER_SNAKE_CASE, rutas kebab-case, SQL snake_case.
- Commits: Conventional Commits (`feat(scope): ...`).
- Idioma: la UI, el README, CONTRIBUTING, SECURITY y `docs/` van en
  **español** (locale `es-CO`, moneda por defecto COP). El `CHANGELOG.md` va
  en **inglés**, formato Keep a Changelog + SemVer. Cada cambio relevante se
  anota en `[Unreleased]`.
- Al subir de versión, actualiza `package.json`, `SITE.info.version`,
  `CHANGELOG.md` y la tabla de `SECURITY.md`.
- El estilo de documentación sigue el del proyecto hermano `../angel-website`.
