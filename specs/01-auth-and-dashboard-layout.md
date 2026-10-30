# SPEC 01 — Autenticación con Supabase y layout del dashboard

> **Estado:** Aprobado
> **Depende de:** ninguno
> **Fecha:** 2026-10-29
> **Objetivo:** Que un usuario pueda registrarse o iniciar sesión (email, Google o GitHub) y entre a un dashboard con aside y tab Personal/Empresa, donde su espacio Personal ya existe.

## Por qué existe este spec

Tesoro se divide en 5 specs: (01) auth + layout, (02) movimientos personales, (03) resumen y gráficas, (04) gastos fijos, ahorro/metas y tarjetas/deudas, (05) score y recomendaciones.
Este spec deja lista la base sobre la que se construye todo lo demás: sesión, tablas `profiles` y `workspaces` con RLS, clientes de Supabase, shadcn/ui y el layout del dashboard.

## Alcance

**Entra:**

- Supabase CLI local (`supabase/`) con migraciones versionadas, aplicadas también al proyecto remoto con `supabase db push`.
- Tablas `profiles` y `workspaces` con RLS, más un trigger que crea el perfil y el espacio Personal al registrarse.
- Registro (`/sign-up`) con nombre, email y contraseña. No se pide confirmar el email.
- Inicio de sesión (`/sign-in`) con email + contraseña.
- OAuth con Google y GitHub, con callback en `/auth/callback`.
- `proxy.ts` que refresca la sesión y protege `/dashboard/*`. También redirige a `/dashboard` a quien ya tiene sesión y entra a `/sign-in` o `/sign-up`.
- shadcn/ui inicializado sobre Tailwind 4.
- Tema Claro/Oscuro/Sistema con `next-themes`, por defecto Sistema.
- Layout del dashboard: aside con un tab Personal/Empresa arriba, navegación del espacio y un menú de usuario abajo (nombre, email, toggle de tema, cerrar sesión).
- `/dashboard` redirige a `/dashboard/personal`.
- Páginas placeholder "Próximamente" para Resumen, Movimientos, Presupuestos, Metas, Deudas, Reportes y Recomendaciones.
- Tab Empresa (`/dashboard/business`) con un estado vacío y el botón "Crear empresa" deshabilitado.

**Fuera de alcance (para specs futuros):**

- Confirmar el email y recuperar o restablecer la contraseña.
- Magic link.
- La landing completa. `app/page.tsx` no se toca.
- Crear o administrar empresas, o cualquier dato de Empresa.
- Movimientos, gráficas, presupuestos, metas, deudas, score y recomendaciones (SPEC 02–05).
- Importar el Excel o un CSV.
- Editar el perfil, cambiar el avatar y borrar la cuenta.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_profiles_and_workspaces.sql`:

```sql
create type public.workspace_type as enum ('personal', 'business');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  avatar_url text,
  currency char(3) not null default 'COP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type public.workspace_type not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un solo espacio Personal por usuario; Empresas ilimitadas (futuro)
create unique index workspaces_one_personal_per_owner
  on public.workspaces (owner_id) where type = 'personal';
```

- **RLS** activo en las dos tablas:
  - `profiles`: `select` y `update` solo donde `id = auth.uid()`.
  - `workspaces`: `select` solo donde `owner_id = auth.uid()`.
  - No hay políticas de `insert` ni `delete` para el cliente: las filas las crea el trigger.
- **Trigger** `on_auth_user_created` (`after insert on auth.users`) llama a la función `public.handle_new_user()`, que es `security definer` con `search_path = ''`:
  - Inserta el `profile`. `full_name` sale de `raw_user_meta_data->>'full_name'`, luego de `->>'name'` (OAuth) y por último de la parte local del email.
  - `avatar_url` sale de `raw_user_meta_data->>'avatar_url'`.
  - Inserta un workspace `type = 'personal'`, `name = 'Personal'`.
- Los tipos TS se generan con `supabase gen types typescript --local` en `src/types/database.ts`.

## Plan de implementación

1. **Dependencias y shadcn/ui.**
   - Instalar con versiones exactas `@supabase/supabase-js`, `@supabase/ssr`, `zod` y `next-themes`.
   - `shadcn init` con alias `@/components/ui` y utils en `src/libs/utils.ts` (`cn`).
   - Agregar `button`, `input`, `label`, `card`, `tabs`, `sidebar`, `dropdown-menu`, `avatar`, `separator`, `sonner`.
   - Verificar: `pnpm check`, `pnpm eslint`, `pnpm build` pasan y el lockfile queda sincronizado.
2. **Supabase local.**
   - `supabase init` crea `supabase/config.toml`.
   - En `config.toml`: `site_url`, redirect `http://localhost:3000/auth/callback`, `enable_confirmations = false`, y Google/GitHub activados con `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` etc.
   - Documentar esas variables (solo servidor/CLI) en `.env.example`.
   - Verificar: `supabase start` levanta.
3. **Migración.** Crear la migración del modelo de datos, aplicarla con `supabase db reset` y generar `src/types/database.ts`. Verificar: un usuario creado desde Studio local tiene su fila en `profiles` y su workspace `personal`.
4. **Clientes de Supabase.**
   - `src/libs/supabase/client.ts`: `createBrowserClient`.
   - `src/libs/supabase/server.ts`: `createServerClient` con `cookies()`.
   - `src/libs/supabase/proxy.ts`: `updateSession`. Todos tipados con `Database`.
5. **`proxy.ts` (raíz).**
   - Llama a `updateSession` y valida con `supabase.auth.getUser()` (o `getClaims()`).
   - Sin sesión en `/dashboard/*` redirige a `/sign-in?next=<ruta>`. Con sesión en `/sign-in` o `/sign-up` redirige a `/dashboard`.
   - El matcher excluye estáticos e imágenes.
6. **Esquemas y Server Actions de auth.**
   - `src/features/auth/schemas.ts` (Zod):
     - `signUpSchema`: `fullName` de 2 a 80 caracteres, email válido, `password` de mínimo 8 caracteres.
     - `signInSchema`.
   - `src/features/auth/actions.ts` (`"use server"`):
     - `signUp`: `auth.signUp` con `options.data.full_name`.
     - `signIn`: `signInWithPassword`.
     - `signInWithOAuth(provider)`: `redirectTo` a `/auth/callback`.
     - `signOut`.
   - Los errores de Supabase se traducen a mensajes en español.
7. **Páginas de auth.**
   - `app/(auth)/layout.tsx` es un layout centrado con la marca.
   - `app/(auth)/sign-in/page.tsx` y `app/(auth)/sign-up/page.tsx` usan `buildMetadata`.
   - Formularios client con `useActionState` y botones "Continuar con Google" y "Continuar con GitHub".
   - Cada página enlaza a la otra.
8. **Callback OAuth.** `app/auth/callback/route.ts` hace `exchangeCodeForSession(code)` y redirige a `next` (solo rutas internas) o a `/dashboard`. Si falla, redirige a `/sign-in?error=oauth`.
9. **Tema.** `src/components/theme/theme-provider.tsx` (`next-themes`, `attribute="class"`, `defaultTheme="system"`) envuelve el `body` en `app/layout.tsx`, con `suppressHydrationWarning` en `<html>`.
10. **Rutas y navegación en `SITE`.**
    - Agregar a `SITE.routes`: `dashboardPersonal`, `dashboardBusiness`, `authCallback`.
    - Agregar a `SITE.navigation.personal` los 7 ítems `{ name, href, icon }` con slugs en inglés: `/dashboard/personal`, `/transactions`, `/budgets`, `/goals`, `/debts`, `/reports`, `/recommendations`.
11. **Layout del dashboard.**
    - `app/dashboard/layout.tsx`: server. Lee el usuario y su `profile`, y monta `SidebarProvider` + `AppSidebar`.
    - `src/components/dashboard/app-sidebar.tsx`.
    - `workspace-tabs.tsx`: tabs Personal/Empresa que navegan entre `/dashboard/personal` y `/dashboard/business`. El tab activo sale de la ruta.
    - `user-menu.tsx`: avatar con iniciales de respaldo, nombre, email, toggle de tema y "Cerrar sesión".
    - `app/dashboard/page.tsx` redirige a `/dashboard/personal`.
12. **Placeholders.**
    - `src/components/dashboard/coming-soon.tsx`.
    - Una página por ítem de `SITE.navigation.personal`, cada una con su título y `ComingSoon`.
    - `app/dashboard/business/page.tsx` muestra el estado vacío con "Crear empresa" deshabilitado.
    - Todas con `buildMetadata` y `noindex`.
13. **Docs.**
    - `docs/producto.md`: modelo `profiles`/`workspaces`, métodos de auth y división en 5 specs.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).
    - `CLAUDE.md`: quitar de pendientes que `/sign-in` y `/sign-up` no existen. Agregar los comandos de Supabase.
    - `README.md`: setup de Supabase local y de los proveedores OAuth.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona.
- [ ] Todas las dependencias nuevas tienen versión exacta, sin `^` ni `~`.
- [ ] `supabase db reset` aplica la migración sin errores.
- [ ] Registrarse en `/sign-up` con nombre, email y contraseña entra directo a `/dashboard/personal`, sin pedir confirmar el email.
- [ ] Tras registrarse, existe exactamente 1 fila en `profiles` y 1 workspace `personal` para ese usuario.
- [ ] Con un email ya registrado, `/sign-up` muestra un error en español y no crea filas.
- [ ] Una contraseña de menos de 8 caracteres o un email inválido muestra un error de validación sin llamar a Supabase.
- [ ] `/sign-in` con credenciales incorrectas muestra "Email o contraseña incorrectos".
- [ ] "Continuar con Google" y "Continuar con GitHub" completan el login y crean `profile` y workspace con el nombre y avatar del proveedor.
- [ ] Entrar a `/dashboard/personal/goals` sin sesión redirige a `/sign-in?next=/dashboard/personal/goals`, y tras iniciar sesión vuelve a esa ruta.
- [ ] Entrar a `/sign-in` con sesión activa redirige a `/dashboard`.
- [ ] `/dashboard` redirige a `/dashboard/personal`.
- [ ] El aside muestra el tab Personal/Empresa, los 7 ítems de navegación y el menú de usuario. Cada ítem abre su página "Próximamente" y queda marcado como activo.
- [ ] El tab Empresa abre `/dashboard/business` con el estado vacío y el botón "Crear empresa" deshabilitado.
- [ ] El toggle cambia entre Claro, Oscuro y Sistema, y la preferencia se mantiene al recargar.
- [ ] "Cerrar sesión" borra la sesión y lleva a `/sign-in`. Volver atrás a `/dashboard` redirige a `/sign-in`.
- [ ] Un usuario A, con la clave publicable y su sesión, no puede leer el `profile` ni los `workspaces` del usuario B (consulta probada en SQL/cliente).
- [ ] Ningún archivo del cliente importa la `service_role` ni la referencia.
- [ ] `app/page.tsx` no cambia.

## Decisiones

- **Sí:** dividir Tesoro en 5 specs. Uno solo sería demasiado grande y la implementación improvisaría.
- **Sí:** un solo espacio Personal y Empresas ilimitadas (después), con un índice único parcial. Es el modelo de `CLAUDE.md`.
- **No:** varios espacios Personales. Complica la navegación sin necesidad.
- **Sí:** crear `workspaces` desde ahora. Evita migrar datos cuando llegue Empresa, y los movimientos de SPEC 02 ya colgarán de `workspace_id`.
- **Sí:** el trigger `security definer` crea `profile` y workspace. Funciona igual con email y con OAuth, y el cliente no necesita políticas de `insert`.
- **Sí:** email + contraseña, Google y GitHub.
- **No:** magic link. No se pidió.
- **No:** confirmar el email ni recuperar la contraseña en este spec. Quedan para uno futuro.
- **Sí:** Supabase CLI local + `db push` al remoto. Las migraciones van versionadas, como exige `CLAUDE.md`.
- **Sí:** rutas `/dashboard/personal/...` y en el futuro `/dashboard/business/[id]/...`. La URL refleja el espacio activo.
- **No:** guardar el espacio activo en una cookie. Las URLs no se podrían compartir.
- **Sí:** slugs en inglés. Son consistentes con `/sign-in` y `/dashboard`. La UI va en español.
- **Sí:** shadcn/ui. Trae sidebar, tabs y charts (Recharts) para los specs siguientes.
- **No:** Tailwind puro. Toma demasiado tiempo para el nivel visual que se busca.
- **Sí:** Server Actions + Zod con `useActionState`. Es un solo patrón para todos los formularios futuros.
- **No:** react-hook-form. Sería una dependencia extra sin necesidad por ahora.
- **Sí:** tema Sistema por defecto con `next-themes`.
- **Sí:** no tocar la landing. El usuario la deja para después.
- **Sí:** el tab Empresa como estado vacío, sin acción ni escritura en la BD.
- **No:** importar el Excel. Va en un spec aparte.

## Riesgos

| Riesgo                                                                                                | Mitigación                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cacheComponents` en Next 16 exige `<Suspense>` alrededor de lecturas dinámicas (`cookies()`, sesión) | El layout del dashboard lee la sesión dentro de un `Suspense` con un skeleton del aside. Antes de implementar se consulta `node_modules/next/dist/docs/` |
| `supabase start` necesita Docker                                                                      | Se documenta en el README. Sin Docker, la misma migración se aplica al remoto con `supabase db push`                                                     |
| OAuth necesita credenciales de Google Cloud y de GitHub                                               | Las variables `SUPABASE_AUTH_EXTERNAL_*` van documentadas en `.env.example` y el setup en el README. Sin ellas, email + contraseña sigue funcionando     |
| Open redirect con `?next=`                                                                            | Solo se aceptan rutas internas que empiezan con `/` y no con `//`                                                                                        |
| El trigger falla y deja un usuario sin `profile`                                                      | La función es atómica dentro del insert de `auth.users`: si falla, el registro falla y se muestra un error                                               |

## Lo que **no** entra en este spec

- Confirmar el email, recuperar la contraseña y magic link.
- La landing completa.
- Crear y administrar empresas.
- Movimientos, gráficas, presupuestos, metas, deudas, score y recomendaciones.
- Importar el Excel o un CSV.
- Editar el perfil y borrar la cuenta.

Cada uno de esos puntos, si llega, va en su propio spec.
