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
```

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
  - `robots.ts` bloquea `/dashboard/`, `/api/` y `/auth/`.
  - Las rutas públicas nuevas se agregan a `STATIC_ROUTES` en `sitemap.ts`.
- `app/` contiene solo rutas. El resto del código vive en `src/` (alias
  `@/*` → `./src/*`). Estilos globales en `src/styles/globals.css` (Tailwind
  4, cargado vía `@tailwindcss/turbopack` en `next.config.ts`).
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

## Pendientes conocidos

- Faltan los assets que `SITE`/metadata ya referencian:
  - `/opengraph-image.png`
  - `/brand/logo.png`
  - `/apple-touch-icon.png`
  - `/icons/icon-192.png` y `/icons/icon-512.png`
- `sitemap.ts` lista `/sign-in` y `/sign-up`, que aún no existen.
