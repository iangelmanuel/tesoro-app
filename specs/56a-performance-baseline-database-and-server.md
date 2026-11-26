# SPEC 56a — Rendimiento: línea base, base de datos y servidor

> **Estado:** Aprobado
> **Depende de:** SPEC 34, SPEC 54, SPEC 55c
> **Fecha:** 2026-11-26
> **Objetivo:** Medir el rendimiento actual de Tesoro y bajar el tiempo de respuesta del servidor con índices, políticas RLS evaluadas una vez por consulta, una sola validación de sesión por request y consultas en paralelo, sin cambiar lo que ve ni puede hacer el usuario.

## Por qué existe este spec

"Mejorar todo el rendimiento" toca cinco áreas: base de datos, servidor, sesión, bundle del cliente y landing. Hacerlo en un solo spec deja la mitad sin medir y sin terminar. Se parte en una serie:

- **56a (este):** línea base de toda la serie, base de datos, servidor y sesión.
- **56b:** bundle del cliente y dashboard (carga diferida, Recharts, re-renders, JS por ruta).
- **56c:** landing y páginas públicas (videos, LCP, fuentes, imágenes).

56a va primero porque la línea base sirve a las tres y porque el servidor es lo que más pesa en cada navegación del dashboard: nada se ve hasta que llegan los datos.

Hallazgos del reconocimiento previo:

- **Sesión repetida.** El `proxy.ts` llama `supabase.auth.getUser()` (ida al servidor de auth) en cada request. Luego `getDashboardUser`, `getPersonalWorkspace`, `tutorials/queries.ts` y `account/queries.ts` vuelven a llamar `getUser()` cada uno. `cache()` deduplica por función, no entre funciones: una página del dashboard hace 3 a 5 idas a Supabase Auth antes de leer un dato.
- **RLS por fila.** 52 políticas usan `public.is_workspace_owner(workspace_id)` o `public.is_workspace_writable(workspace_id)`. Postgres evalúa la función por cada fila que lee: una consulta de 2.000 movimientos ejecuta 2.000 subconsultas a `workspaces`.
- **Sin índice en `workspaces.owner_id`.** Esa subconsulta, y `getPersonalWorkspace`, filtran por `owner_id` sin índice.
- **Columnas de más.** Consultas como `getRecentTransactions` piden `select("*", ...)`.
- **Sin "use cache" en datos de usuario.** Se mantiene así a propósito (ver Decisiones).

## Alcance

**Entra:**

### 1. Línea base de la serie 56

- **Entorno:** Preview de Vercel contra la Supabase remota (producción).
- **Cuenta de pruebas:** la crea Claude en producción con el registro normal (`signUp` con la clave publicable) y un email ficticio. Sus credenciales viven solo en `.env.local` (`PERF_EMAIL`, `PERF_PASSWORD`, `PERF_USER_ID`, `PERF_WORKSPACE_ID`), nunca en el repo ni en el spec.
- **Datos sintéticos:** `scripts/generate-perf-csv.mjs` genera un CSV de ~2.000 movimientos en 12 meses (categorías, cuentas y montos genéricos, semilla fija para que sea reproducible). Se carga con la RPC del asistente de Importar (`import_transactions`, SPEC 08), con la sesión de la cuenta de pruebas, en el espacio Personal de la cuenta de pruebas. El CSV generado va a `tmp/` (git-ignorado). El script sí va al repo.
- **Qué se mide**, todo anotado en `docs/rendimiento.md`:
  - Lighthouse móvil (CLI con la cookie de sesión de la cuenta de pruebas, mediana de 3) de `/`, `/dashboard/personal`, `/dashboard/personal/transactions` y `/dashboard/personal/reports`: Performance, LCP, TBT, CLS y TTFB.
  - Duración de las funciones de esas rutas en Vercel (observabilidad / runtime logs), mediana de 5 cargas.
  - Tamaño de JS por ruta que imprime `next build` (lo usa 56b; se toma aquí para tener una sola foto inicial).
  - `EXPLAIN (ANALYZE, BUFFERS)` de las consultas más pesadas, con RLS activo (ver §4).
  - Tiempo del export PDF y XLSX del mes actual (`/api/export/[workspaceId]`).
  - Región de las funciones de Vercel y región del proyecto de Supabase. Si no coinciden, se documenta y se propone alinearlas; el cambio en Vercel lo confirma el usuario.

### 2. Una sola validación de sesión por request

- **`src/features/account/session.ts`** (nuevo, `import "server-only"`): `getSessionUser = cache(async () => …)` con el único `supabase.auth.getUser()` del camino de lectura del dashboard. Devuelve el `User` o `null`.
- Lo usan `getDashboardUser`, `getPersonalWorkspace`, `tutorials/queries.ts` y `account/queries.ts` en vez de su propio `getUser()`.
- Las escrituras (servicios y actions que validan antes de escribir) siguen como están.
- El MCP no cambia: sigue validando el Bearer en `src/features/mcp/auth.ts`.

### 3. `proxy.ts` con `getClaims()`

- `updateSession` (`src/libs/supabase/proxy.ts`) cambia `getUser()` por `getClaims()`. Verifica el JWT ES256 con las claves públicas (JWKS), sin ida al servidor de auth, y sigue refrescando el token y las cookies.
- `updateSession` devuelve `{ response, claims }`. `proxy.ts` decide con `claims` (sesión sí/no) y lee la marca de borrado de `claims.app_metadata.deletion_requested_at`. `deletionRequestedAt` acepta el `app_metadata` en vez del `User` completo.
- Las actions de pedir y cancelar el borrado de la cuenta llaman `supabase.auth.refreshSession()` después de escribir, para que el JWT nuevo ya traiga (o pierda) la marca y el proxy redirija en el siguiente request.

### 4. Base de datos

Una migración `supabase/migrations/<timestamp>_performance_indexes_and_rls.sql`:

- **Índice** `workspaces_owner_type on public.workspaces (owner_id, type)`.
- **Funciones de conjunto**, `stable`, `security invoker`, `set search_path = ''`, con `grant execute` solo a `authenticated`:
  - `public.owned_workspace_ids()` → `setof uuid` de los espacios del usuario.
  - `public.writable_workspace_ids()` → lo mismo con `deletion_requested_at is null`.
- **Políticas reescritas:** cada `using (public.is_workspace_owner(workspace_id))` pasa a `using (workspace_id = any (array(select public.owned_workspace_ids())))`, y cada `is_workspace_writable(...)` a `writable_workspace_ids()`. El `array(select …)` hace que Postgres la evalúe una vez por consulta (InitPlan) y la use como condición del índice, no por fila. (`in (select …)` también la evalúa una vez, pero como hashed SubPlan en el filtro.) Las políticas de tablas hijas que hoy usan `exists (...)` contra su padre se reescriben igual cuando el EXPLAIN muestre la evaluación por fila.
- `is_workspace_owner` e `is_workspace_writable` se quedan: las usan RPC y triggers.
- **Índices adicionales** solo donde el EXPLAIN de §1 muestre `Seq Scan` sobre una tabla con datos del usuario, o donde el advisor de Supabase marque una llave foránea sin índice.
- **RPC nuevas** solo para una pantalla que haga 4 o más consultas sueltas a la misma tabla y donde la medición muestre que la suma de idas pesa más que la consulta. Siempre `security invoker` (pasan por RLS). Cada una con su `revoke` / `grant` y sus tipos regenerados en `src/types/database.ts`.

**Cómo se corre EXPLAIN con RLS en remota:** SQL Editor o el MCP de Supabase, dentro de `begin; … rollback;`, con `set local role authenticated;` y `set local request.jwt.claims = '{"sub":"<id de la cuenta de pruebas>","role":"authenticated"}';`. Las consultas y sus planes (antes y después) quedan en `docs/rendimiento.md`, sin ids reales.

### 5. Tests de RLS

- `supabase/tests/rls_workspace_access.test.sql` (pgTAP, `supabase test db`, en local con Docker):
  - Usuario A lee y escribe sus filas en cada tabla con `workspace_id`.
  - Usuario A no lee ni escribe filas del espacio de B.
  - Un espacio con `deletion_requested_at` se lee pero no se escribe.
- Se escriben y pasan **antes** de reescribir las políticas (caracterizan el acceso de hoy) y vuelven a pasar después, sin cambios.

### 6. Consultas del servidor

Página por página del dashboard (Personal y Empresa), de las queries en `src/features/*/queries.ts`:

- **Cascadas:** consultas independientes que hoy se esperan en serie pasan a `Promise.all`, o a componentes hermanos dentro de su propio `Suspense` (patrón de SPEC 51).
- **Columnas explícitas:** cada `select("*")` de una query de lectura pasa a la lista de columnas que usa la pantalla.
- **Límites:** listas que hoy traen todo y cortan en JS pasan a `.limit()` / `.range()` en la consulta.
- Los cálculos puros que se muevan llevan antes su test de caracterización (regla de SPEC 54).

### 7. MCP y exportación

- Solo se benefician de §2 a §6. Su contrato no cambia: nombres, descripciones, esquemas y respuestas de las tools, y el contenido de los archivos exportados.
- Se mide el tiempo del export PDF y XLSX antes y después.

### 8. Documentación

- `docs/rendimiento.md` (nuevo): método de medición, tablas antes/después y la lista de lo aplicado.
- `docs/arquitectura.md`: `getSessionUser` como única lectura de sesión del dashboard y el patrón de políticas `workspace_id = any (array(select …))`.
- `CLAUDE.md` (sección Supabase): el patrón nuevo de políticas reemplaza la frase sobre `is_workspace_writable` / `is_workspace_owner`.
- `CHANGELOG.md` `[Unreleased]`: entrada en inglés.

**Fuera de alcance (para 56b, 56c u otros specs):**

- Bundle del cliente, `next/dynamic`, Recharts, `motion`, re-renders y JS por ruta (56b).
- Videos, fuentes, imágenes y LCP de la landing y las públicas (56c).
- Caché entre requests de datos de usuario (`"use cache: private"`, `cacheTag`, `updateTag`).
- Cambiar `revalidatePath` por invalidación por tags.
- Cambios de esquema que no sean índices, funciones de conjunto, políticas o RPC de lectura.
- Subir la versión: se hace al cerrar la serie, en 56c.

## Modelo de datos

No hay tablas ni columnas nuevas. Cambia esto:

```sql
-- Índice
create index workspaces_owner_type on public.workspaces (owner_id, type);

-- Conjunto de espacios del usuario, evaluado una vez por consulta
create function public.owned_workspace_ids()
returns setof uuid
language sql stable security invoker set search_path = ''
as $$ select id from public.workspaces where owner_id = (select auth.uid()) $$;

-- Forma de la política reescrita (ejemplo)
using (workspace_id = any (array(select public.owned_workspace_ids())))
```

```ts
// src/features/account/session.ts
export const getSessionUser: () => Promise<User | null>

// src/libs/supabase/proxy.ts
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; claims: JwtPayload | null }>
```

## Plan de implementación

1. **Datos de prueba.** Escribir `scripts/generate-perf-csv.mjs` y agregar `tmp/` a `.gitignore`. El usuario crea la cuenta de pruebas en producción e importa el CSV. Verificar: la cuenta muestra 12 meses en Reportes.
2. **Línea base.** Desplegar un Preview de Vercel del `master` actual. Medir todo lo de §1 y escribir la tabla "Antes" en `docs/rendimiento.md`. Correr `get_advisors` (performance y security) de Supabase y anotar los avisos.
3. **Tests de RLS.** Escribir `supabase/tests/rls_workspace_access.test.sql`. `supabase start` + `supabase test db` pasa contra el esquema de hoy.
4. **Sesión única.** Crear `src/features/account/session.ts` con `getSessionUser` y su JSDoc. Cambiar los cuatro consumidores. `pnpm check` y `pnpm test` pasan.
5. **Proxy con `getClaims`.** Cambiar `updateSession` y `proxy.ts`; adaptar `deletionRequestedAt`. Agregar `refreshSession()` en las actions de pedir y cancelar el borrado. Probar a mano en local: sin sesión → `/sign-in`; cuenta marcada → `/account-deleted`; cancelar → vuelve al dashboard.
6. **Migración de índice y funciones.** Índice `workspaces_owner_type` y las dos funciones de conjunto, sin tocar políticas. `supabase db reset` y `supabase test db` pasan.
7. **Políticas reescritas.** Misma migración o una segunda (`<timestamp>_rewrite_workspace_rls_policies.sql`), tabla por tabla. `supabase test db` pasa sin cambiar los tests.
8. **Índices y RPC del EXPLAIN.** Con los planes de §1, agregar los índices que falten. Crear las RPC que la medición justifique. Regenerar `src/types/database.ts` y pasarle Prettier.
9. **Queries del servidor.** Recorrer las páginas de Personal y luego las de Empresa: cascadas, columnas explícitas y límites (§6). Un commit por feature. `pnpm check`, `pnpm eslint` y `pnpm test` pasan en cada uno.
10. **Push a producción.** Claude muestra la lista de migraciones pendientes y pide el OK explícito del usuario. Con el OK, `supabase db push`. Correr `get_advisors` otra vez.
11. **Medición "Después".** Nuevo Preview de Vercel con la rama. Repetir §1 y llenar la tabla "Después" en `docs/rendimiento.md`, con la diferencia por fila.
12. **Documentación.** `docs/arquitectura.md`, `CLAUDE.md` y `CHANGELOG.md` (§8).

## Criterios de aceptación

- [ ] `docs/rendimiento.md` tiene el método y las tablas "Antes" y "Después" de Lighthouse, duración de funciones, JS por ruta, EXPLAIN y export, con las mismas rutas en ambas.
- [ ] Ninguna ruta medida empeora más de un 10 % en TTFB ni en duración de función entre "Antes" y "Después".
- [ ] `/dashboard/personal` y `/dashboard/personal/transactions` bajan su duración de función mediana respecto a "Antes".
- [ ] En el camino de lectura del dashboard, `supabase.auth.getUser()` solo aparece en `src/features/account/session.ts` (verificable con grep en `queries.ts` y `dashboard-user.ts`).
- [ ] `src/libs/supabase/proxy.ts` usa `getClaims()` y no llama `getUser()`.
- [ ] Sin sesión, `/dashboard/personal` redirige a `/sign-in?next=…`.
- [ ] Una cuenta que pide su borrado es redirigida a `/account-deleted` en el siguiente request; al cancelarlo vuelve a entrar al dashboard.
- [ ] Ninguna política RLS de una tabla con `workspace_id` llama `is_workspace_owner(workspace_id)` ni `is_workspace_writable(workspace_id)` por fila.
- [ ] El EXPLAIN "Después" de la lista de movimientos muestra la función de conjunto como `InitPlan`, no como `SubPlan` por fila.
- [ ] `supabase test db` pasa antes y después de reescribir las políticas, con los mismos tests.
- [ ] El advisor de performance de Supabase no reporta `auth_rls_initplan` ni `unindexed_foreign_keys` sobre tablas de `public`.
- [ ] El advisor de security no reporta avisos nuevos respecto a la línea base.
- [ ] Ninguna query de lectura de `src/features/*/queries.ts` usa `select("*")`.
- [ ] Las tools del MCP pasan `catalog.test.ts` sin cambios y el export PDF y XLSX del mes da el mismo contenido que antes.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.
- [ ] Las credenciales de la cuenta de pruebas no aparecen en ningún archivo versionado.

## Decisiones

- **Sí:** serie 56a / 56b / 56c. Un spec con las cinco áreas no se puede verificar ni cerrar en un solo PR.
- **Sí:** medir en un Preview de Vercel contra la Supabase remota. Refleja la latencia real entre función y base de datos, que en local no existe.
- **No:** medir en local con `seed-demo.mjs`. Reproducible, pero esconde justo la latencia de red que se quiere bajar.
- **Sí:** cuenta de pruebas creada por Claude con el registro normal y datos por la RPC del asistente de Importar, sin pedirle credenciales al usuario. No hace falta la `service_role` remota en ningún script.
- **No:** flag `--allow-remote` en `seed-demo.mjs`. Pasaría la `service_role` de producción por un script local.
- **No:** medir con la cuenta real del usuario. No es reproducible y expone datos reales en la documentación.
- **Sí:** solo deduplicar sesión y paralelizar consultas, sin caché entre requests. Son datos financieros: verlos viejos o mezclados entre usuarios es peor que unos milisegundos.
- **No:** `"use cache: private"` + `cacheTag` + `updateTag` en esta serie. Exige tocar unas 40 actions y el MCP; si la medición "Después" lo justifica, va en su propio spec.
- **Sí:** `getClaims()` en el proxy. Quita una ida al servidor de auth en cada request. El costo es que un token revocado sigue valiendo hasta que expira (≤ 1 h); se acepta porque las lecturas siguen pasando por RLS y `getSessionUser` valida con `getUser()`.
- **Sí:** `refreshSession()` tras pedir o cancelar el borrado. Sin él, la marca del JWT llega tarde y el proxy no redirige hasta el siguiente refresco.
- **Sí:** `workspace_id = any (array(select public.owned_workspace_ids()))` en las políticas. Mismo acceso, evaluado una vez por consulta (InitPlan) y usado como condición del índice.
- **No:** `workspace_id in (select …)`. También evalúa el conjunto una vez, pero como hashed SubPlan en el filtro: no cumple el criterio de InitPlan ni lo aprovecha el índice.
- **No:** solo el índice sin tocar las políticas. Baja el costo por fila, pero sigue siendo por fila.
- **Sí:** funciones de conjunto `security invoker`. Leen `workspaces` con su propia política (`owner_id = auth.uid()`); no hace falta `security definer`.
- **Sí:** tests de RLS con pgTAP antes de reescribir. Es la única forma de demostrar que el acceso no cambió.
- **Sí:** índices y RPC solo con evidencia de EXPLAIN o del advisor. Un índice sin uso cuesta en cada escritura.
- **Sí:** el MCP y el export entran solo del lado servidor. Ganan solos con la base de datos; tocar su contrato sería otro spec.
- **Sí:** Claude corre `supabase db push` solo con el OK explícito del usuario en ese momento.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| La reescritura de una política abre o cierra acceso por error            | Tests pgTAP antes y después, sin cambiar los tests. El push a producción solo después de que pasen.                   |
| `getClaims()` acepta un JWT de una sesión ya cerrada en otro dispositivo | El proxy solo decide redirecciones. Los datos siguen detrás de RLS y `getSessionUser` valida contra el servidor.      |
| La marca de borrado no llega al JWT                                      | `refreshSession()` tras pedir o cancelar; criterio de aceptación manual para los dos casos.                           |
| La medición varía entre corridas (red, arranque en frío)                 | Mediana de 5 cargas por ruta, descartando la primera (arranque en frío). Mismo Preview y misma cuenta en ambas fotos. |
| El CSV de pruebas queda en el repo con datos que parecen reales          | El CSV va a `tmp/` (git-ignorado). Solo el script entra al repo, con datos genéricos y semilla fija.                  |
| Región de Vercel y de Supabase distintas, y la ganancia queda tapada     | Se mide y se documenta en §1. El cambio de región lo decide el usuario.                                               |
| Una RPC nueva salta RLS                                                  | Siempre `security invoker`, con `revoke` a `public` y `anon`. Cubierta por los tests de RLS.                          |

## Lo que **no** entra en este spec

- Bundle del cliente, carga diferida y re-renders (SPEC 56b).
- Videos, fuentes, imágenes y LCP de la landing (SPEC 56c).
- Caché entre requests de datos de usuario e invalidación por tags.
- Cambios al contrato del MCP o al contenido de los archivos exportados.
- Subir la versión (al cerrar la serie).

Cada uno, si llega, va en su propio spec.
