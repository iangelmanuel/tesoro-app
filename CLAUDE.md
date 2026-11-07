# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Proyecto

**Tesoro** es un gestor y recomendador de finanzas personales y empresariales,
de código abierto (MIT, autor Angel De La Torre / Angel DM). La app no parte de
cero ni conecta bancos: se alimenta de los registros que el usuario introduce
(ingresos, gastos, deudas, metas) y a partir de ellos genera gráficas claras,
recomendaciones y un score de salud financiera.

Estado: **v0.1.0**. Por ahora solo existen la configuración base, el SEO y la
documentación. No hay código de la app todavía. Las piezas se construyen en
este orden (ver `README.md#hoja-de-ruta` y `docs/producto.md`):

1. Landing (`/`)
2. Auth con Supabase (`/sign-in`, `/sign-up`)
3. Dashboard (`/dashboard`) con un aside. Arriba del aside va un selector tipo
   tab **Personal / Empresa**:
   - **Personal** es el espacio por defecto. Todo usuario lo tiene desde el
     registro, con su estructura completa: resumen, movimientos,
     presupuestos, metas, deudas, reportes y recomendaciones.
   - **Empresa** es opcional. Si el usuario no tiene uno, el dashboard
     muestra un estado vacío que lo invita a crearlo. Su estructura: flujo
     de caja, ventas, costos/gastos operativos, reportes y recomendaciones.
4. Movimientos → gráficas → score → recomendaciones

`docs/producto.md` es la especificación de producto. Actualízalo cuando se
definan detalles, por ejemplo los factores y pesos del score.

## Comandos

Usa pnpm **12.16.1** (`packageManager`) con Node ≥ 24.19.0. Si el pnpm global
de la máquina es más viejo, antepone `npx -y pnpm@12.16.1`.

```bash
pnpm dev              # servidor de desarrollo (localhost:3000)
pnpm build            # build de producción
pnpm check            # tsc --noEmit
pnpm eslint           # lint (eslint:fix para corregir)
pnpm prettier         # formatea (prettier:check solo verifica)
pnpm next typegen     # regenera los tipos de typedRoutes (antes de `check`)
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
(MP4 + WebM + póster, ≤ 25 MB en total). Requiere FFmpeg y Docker.

```bash
supabase start                         # Supabase local (el seed se niega con otra URL)
node scripts/seed-demo.mjs             # usuario demo con Personal y Empresa
pnpm build && pnpm start               # la app que se graba (sin overlay de dev)
node scripts/record-demo.mjs [tomas]   # Playwright: .webm + .json del cursor en video/raw/
node scripts/prepare-demo-video.mjs    # tomas H.264 y cursor-data.js para Hyperframes
cd video && npx hyperframes render     # video principal (clips: -c clips/<slug>.html)
```

El clip de agentes (SPEC 34) no graba la app: es HTML en
`video/clips/agentes.html`. Se renderiza con
`npx hyperframes render -c clips/agentes.html -q delivery` y se codifica
a 864 × 960 (H.264 `-tune animation` CRF 27 y VP9 CRF 40, sin audio) más el
póster WebP del segundo 12,9.

Las variables (`DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`
local) van en el entorno o en `.env.local`, nunca en el repo. Al
re-renderizar, actualiza `SITE.landing.demo.durationSeconds`.

Aún no hay tests. El CI (`.github/workflows/ci.yml`) corre `check`, `eslint`,
`prettier:check` y luego `build` con `pnpm install --frozen-lockfile`. Por eso
el lockfile tiene que estar siempre sincronizado con `package.json`.

## Arquitectura

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
    (`src/components/seo/JsonLd.tsx`).
- **Rutas de metadata** en `app/`: `robots.ts`, `sitemap.ts` y `manifest.ts`,
  todas derivadas de `SITE`:
  - `robots.ts` bloquea `/dashboard/`, `/api/`, `/auth/` y `/oauth/`.
  - Las rutas públicas nuevas se agregan a `STATIC_ROUTES` en `sitemap.ts`.
- **Exportar** (SPEC 32 y 33): `app/api/export/[workspaceId]/route.ts`
  responde el `.xlsx`, el `.csv` o el `.pdf`. `exceljs` solo se importa desde
  `src/features/exports/workbook/`, y `pdfmake`, `html-to-pdfmake` y `jsdom`
  solo desde `src/features/exports/pdf/`; nunca desde un componente cliente.
  `pdfmake` va en `serverExternalPackages` (`next.config.ts`). Los Route
  Handlers resuelven el espacio con `findWorkspace` (null → 404 en JSON), no
  con `getWorkspace` (`notFound()` responde HTML). Si cambian `--accent`,
  `--income`, `--expense`, `--muted`, `--balance` o `--chart-*`, actualiza
  `workbook/theme.ts` (de ahí también lee `pdf/theme.ts`). Las notas y
  descripciones del usuario nunca pasan por HTML en el PDF.
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
  `src/features/mcp/tools/` y se registran en `catalog.ts` (de ahí sale
  también la página `/mcp`). Las escrituras usan los servicios compartidos
  con las actions (`transactions/service.ts`,
  `accounts/transfer-service.ts`, `debts/entry-service.ts`,
  `categories/service.ts`), validan todo antes de escribir y dejan log en
  `mcp_operations` para revertir con `undo_mcp_operation`. `/api/mcp` y
  `/.well-known/*` no pasan por `updateSession` (matcher de `proxy.ts`).
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
- **Tema**: Inter (`next/font/google`, `--font-sans`) y oscuro por defecto
  (`defaultTheme="dark"`; el toggle del aside cambia a claro). Fondo casi
  negro y tarjetas gris oscuro **sin borde**; radios grandes en tarjetas y
  pill en botones, tabs y selects. Montos con `tabular-nums`.
- **Un solo título por pantalla**: lo pone el header (`DashboardTitle`); las
  páginas no repiten `<h1>`. Las acciones principales van en los accesos
  rápidos del header, no en la página.
- KPIs con `StatCard`, cabeceras de tarjeta con `CardHeading`, ayudas con
  `HelpHint` (textos en `src/config/help.ts`), vacíos con `EmptyState` /
  `CardEmpty` y carga con `CardSkeleton`. Estados con `tone.ts`, nunca con la
  paleta cruda de Tailwind.
- Listas y tarjetas de grilla con las clases de
  `src/components/dashboard/surface.ts`, sin `rounded-xl border` ni
  `border-dashed`. Los campos de formulario van con relleno suave y sin borde
  (tokens `--field-*` en `globals.css`).
- Los traspasos se registran desde el diálogo de movimiento (opción
  "Traspaso"); las páginas no llevan un botón de traspaso aparte.
- **HeroUI v3** (`@heroui/react` y `@heroui/styles`), sin Provider. Se
  importa **directo de `@heroui/react`**: no hay wrappers ni
  `src/components/ui/`. `cn` también sale de `@heroui/react`.
- Componentes compuestos (`Modal.Header`, `Select.Popover`…). En componentes
  de servidor se usan los nombres exportados (`CardHeader`, `ToastProvider`),
  no la notación con punto.
- Botones con `onPress`, `isDisabled`, `isIconOnly`; enlaces con estilo de
  botón: `<Link className={buttonVariants({ variant })}>`.
- Formularios: `useActionState` + Zod. Cada campo es `TextField` / `Select` /
  `DatePicker` con `Label` y `FieldError` dentro y
  `validationBehavior="aria"` (valida el servidor).
- Fechas: `DatePickerField` (`src/components/forms/date-picker-field.tsx`),
  que trabaja con `YYYY-MM-DD`. Hora opcional de un evento: `TimePickerField`
  (`HH:MM` o `""`) y `timeSchema`; se muestra con `formatTime`. Toasts: `toast` de `@heroui/react`.
- Gráficas: Recharts con `src/components/charts/*`: `ChartCard` (cabecera
  con leyenda y cifra), `ChartContainer`, las props de `chart-style.ts` y los
  montos abreviados de `chart-format.ts`. Colores siempre desde tokens.
  Funciones que llaman componentes de servidor no van en archivos
  `"use client"`.
- Tokens en `globals.css` con los nombres de HeroUI (`--accent` es el
  primario, `--muted` es texto atenuado, `--surface`, `--overlay`,
  `--default`, `--danger`…), más los propios `--brand`, `--income`,
  `--expense`, `--balance`, `--category-*` y `--chart-*`.
- Primario por espacio: `WorkspaceThemeRoot` + `getWorkspaceTheme(pathname)`
  ponen `data-workspace` y `globals.css` lo aplica con `:has()`. Neutro fuera
  del dashboard, emerald en Personal, naranja en Empresa. Nunca se pasa el
  color por props; `data-workspace` solo aparece en esos dos archivos.
- **Aside** (SPEC 31): `SITE.navigation.personal` / `.business` son grupos
  (`{ label, items }`): "Día a día", "Tu plan" / "Tu operación" (donde se
  configura) y "Entiende tu dinero" / "Entiende tu negocio". Los
  consumidores planos usan `flattenNav` (`nav.ts`). En escritorio el ancho se
  ajusta (240–360 px) y se guarda en la cookie `tesoro-sidebar-width`
  (`sidebar/width.ts`). Ver `docs/ui.md`.
- **Móvil (`< 768 px`)**: hoja de acciones rápidas (**Movimiento rápido**,
  Categorías y Verificar) y barra inferior
  (`src/components/dashboard/mobile/`) en vez del aside; el selector Personal /
  Empresa vive solo en el aside (Drawer). Tablas como tarjetas
  (`DataRows`), filtros de Movimientos en hoja y controles de 44 px o más. Ver
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
- Las políticas de escritura de las tablas de un espacio usan
  `is_workspace_writable(workspace_id)` (dueño y sin marca de borrado). Las de
  `select` usan `is_workspace_owner`. En las actions, el espacio se resuelve
  con `requireWritableWorkspace(id)`.
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
