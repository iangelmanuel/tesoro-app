# SPEC 09 — Cuenta y perfil

> **Estado:** Borrador
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario gestione su cuenta desde `/dashboard/account` (nombre, avatar, moneda, email y contraseña), recupere su contraseña si la olvida y pueda programar el borrado de su cuenta con 30 días de gracia.

## Por qué existe este spec

El SPEC 01 dejó fuera editar el perfil, recuperar la contraseña, confirmar el email y borrar la cuenta. Hoy un usuario que olvida su contraseña pierde el acceso, y no hay forma de irse de Tesoro sin escribir al autor.
El borrado no es inmediato: se **programa** y la cuenta se purga 30 días después. Durante ese tiempo el usuario puede restaurarla iniciando sesión.
La marca del borrado vive en `auth.users.raw_app_meta_data`, no en `profiles`. Así `proxy.ts` la lee del `getUser()` que ya hace, sin otra consulta por request, y el usuario no la puede editar.
La confirmación de email queda **lista pero apagada**: el código soporta ambos modos y se activa solo con configuración.

## Alcance

**Entra:**

- Página `/dashboard/account` dentro del layout del dashboard (mismo aside, sin ítem activo), con cuatro secciones apiladas:
  - **Perfil:** avatar (subir y quitar), nombre y email.
  - **Preferencias:** moneda.
  - **Seguridad:** cambiar contraseña, o crearla si el usuario solo entra con OAuth.
  - **Zona de peligro:** eliminar la cuenta.
- Ítem "Cuenta" en el menú de usuario, encima de "Tema".
- Avatar en Supabase Storage (bucket público `avatars`, escritura solo en la carpeta propia):
  - acepta JPG, PNG y WebP de hasta 5 MB;
  - el cliente lo recorta al centro en cuadrado y lo sube como WebP de 256×256;
  - "Quitar foto" borra el archivo y deja las iniciales.
- Editar el nombre (2 a 80 caracteres, igual que el registro).
- Elegir la moneda entre COP, USD, EUR, MXN, PEN, CLP y ARS. Solo cambia el formato: los montos guardados no se convierten.
- Cambiar el email con doble confirmación (enlace al correo actual y al nuevo). Mientras está pendiente se muestra "Cambio pendiente a X".
- Cambiar la contraseña pidiendo la actual. Si el usuario no tiene contraseña (solo OAuth), "Crear contraseña" sin pedir la actual.
- "Olvidé mi contraseña": `/forgot-password` envía el enlace y `/reset-password` fija la nueva.
- Ruta `/auth/confirm` que verifica los enlaces de email (`token_hash` + `type`) para confirmación de registro, recuperación y cambio de email.
- Confirmación de email lista pero apagada (`enable_confirmations = false`):
  - si se activa, `/sign-up` lleva a `/check-email` con botón "Reenviar correo";
  - `/sign-in` con email sin confirmar muestra el error en español y el enlace para reenviar.
- Plantillas de email en español con la marca Tesoro en `supabase/templates/`: `confirmation.html`, `recovery.html` y `email_change.html`.
- Borrado de cuenta con periodo de gracia:
  - diálogo de peligro que exige escribir el email exacto;
  - al confirmar: borra los archivos del avatar, deja `avatar_url` en `null`, marca la cuenta, cierra la sesión y lleva a `/sign-in` con un aviso;
  - si vuelve a iniciar sesión dentro de los 30 días, cualquier ruta del dashboard lo manda a `/account-deleted`, con la fecha de borrado, "Restaurar cuenta" y "Cerrar sesión";
  - un job diario de `pg_cron` borra de `auth.users` las cuentas marcadas hace más de 30 días, y en cascada todos sus datos.
- Migración que cambia las FK `on delete restrict` a `no action` para que la cascada del borrado no falle (ver Riesgos).

**Fuera de alcance (para specs futuros):**

- 2FA.
- Vincular o desvincular proveedores OAuth.
- Exportar los datos personales.
- Convertir montos al cambiar la moneda, o monedas distintas por espacio o cuenta.
- SMTP propio (Resend u otro). Sin él, Supabase limita los correos por hora.
- Encender la confirmación de email en producción.
- Avisar por email que la cuenta se va a borrar o que se borró.
- Cerrar las demás sesiones al cambiar la contraseña.
- Editor de recorte del avatar.
- Plantillas de `invite`, `magic_link` y `reauthentication`.
- Datos y ajustes del espacio Empresa.

## Modelo de datos

Este spec no crea tablas. Reutiliza `profiles` (SPEC 01): `full_name`, `avatar_url` y `currency` ya existen.

Migración `supabase/migrations/<timestamp>_account_and_profile.sql`:

```sql
-- Bucket de avatares: público para leer, 1 MB, solo WebP
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp']);

-- Políticas en storage.objects (select, insert, update, delete), todas con:
--   bucket_id = 'avatars'
--   and (storage.foldername(name))[1] = (select auth.uid())::text

-- ¿El usuario tiene contraseña? (los de solo OAuth no)
create function public.has_password() returns boolean ...
  -- security definer, stable, search_path = ''
  -- encrypted_password is not null and encrypted_password <> ''
  -- de auth.users where id = auth.uid()

-- Marca y desmarca el borrado en raw_app_meta_data
create function public.request_account_deletion() returns timestamptz ...
create function public.cancel_account_deletion() returns void ...

-- Purga las cuentas marcadas hace más de 30 días. La llama pg_cron.
create function public.purge_deleted_accounts() returns integer ...

create extension if not exists pg_cron with schema pg_catalog;

-- 08:00 UTC = 03:00 America/Bogota
select cron.schedule(
  'purge-deleted-accounts',
  '0 8 * * *',
  $$select public.purge_deleted_accounts()$$
);
```

- **Marca de borrado:** clave `deletion_requested_at` (ISO 8601) en `auth.users.raw_app_meta_data`. Llega al cliente como `user.app_metadata.deletion_requested_at`.
  - Fecha de borrado = `deletion_requested_at + 30 días`, mostrada en `America/Bogota`.
- **Funciones** (todas `security definer` con `search_path = ''`):
  - `has_password`, `request_account_deletion` y `cancel_account_deletion`: `revoke` de `public` y `anon`, `grant execute` solo a `authenticated`. Solo tocan la fila `auth.uid()`.
  - `request_account_deletion` es idempotente: si ya hay marca, devuelve la existente.
  - `purge_deleted_accounts`: `revoke` de `public`, `anon` y `authenticated`. Hace `delete from auth.users where (raw_app_meta_data->>'deletion_requested_at')::timestamptz < now() - interval '30 days'` y devuelve cuántas borró.
- **Cascada:** `auth.users` → `profiles` → `workspaces` → todas las tablas del espacio (ya son `on delete cascade`).
- **FK a `no action`:** se recrean con `on delete no action` estas FK `on delete restrict`:
  - `transactions.category_id`, `recurring_expenses.category_id` y `budgets.category_id` (SPEC 02 y 04);
  - `transactions.account_id`, `transfers.from_account_id` y `transfers.to_account_id` (SPEC 08c).
  - Fuera de la cascada se comportan igual: siguen bloqueando borrar una categoría o cuenta en uso (error `23503`).
- **Moneda:** sin cambio en la BD (`char(3)`). La lista válida vive en `SITE.currencies` y se valida con Zod en la Server Action.
- `CLP` se agrega a `ZERO_DECIMAL_CURRENCIES` en `src/libs/format.ts`.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Constantes en `src/config/site.ts`:

```ts
routes: {
  // …existentes
  account: "/dashboard/account",
  accountDeleted: "/account-deleted",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  checkEmail: "/check-email",
  authConfirm: "/auth/confirm"
},

currencies: [
  { code: "COP", label: "Peso colombiano" },
  { code: "USD", label: "Dólar estadounidense" },
  { code: "EUR", label: "Euro" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "PEN", label: "Sol peruano" },
  { code: "CLP", label: "Peso chileno" },
  { code: "ARS", label: "Peso argentino" }
],

accountDeletionGraceDays: 30
```

Enlaces de las plantillas (todos a `/auth/confirm`):

```text
confirmation  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
recovery      {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
email_change  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/dashboard/account
```

## Plan de implementación

1. **Migración de FK.**
   - Migración que recrea las 6 FK `restrict` como `no action`.
   - Verificar: `supabase db reset` pasa. Borrar desde SQL un usuario de prueba con movimientos, categorías, cuentas y traspasos elimina todas sus filas sin error.
   - Borrar una categoría en uso desde la app sigue mostrando el error de siempre.
2. **Migración de cuenta.**
   - Bucket `avatars` y sus 4 políticas.
   - Funciones `has_password`, `request_account_deletion`, `cancel_account_deletion` y `purge_deleted_accounts`.
   - `pg_cron` y el job `purge-deleted-accounts`.
   - Regenerar `src/types/database.ts`.
   - Verificar: `select * from cron.job` muestra el job. Un usuario A no puede subir a `avatars/<id de B>/`.
3. **Config de auth local.**
   - En `supabase/config.toml`:
     - `minimum_password_length = 8`;
     - redirect `http://localhost:3000/auth/confirm` en `additional_redirect_urls`;
     - `[auth.email.template.confirmation]`, `.recovery` y `.email_change` con asunto en español y `content_path` a `./supabase/templates/*.html`.
   - Crear las 3 plantillas con la marca Tesoro y el enlace de la tabla de arriba.
   - Verificar: `supabase stop && supabase start` levanta y los correos se ven en Mailpit.
4. **`SITE` y formato.**
   - Agregar las rutas, `currencies` y `accountDeletionGraceDays` a `SITE`.
   - Agregar `CLP` a `ZERO_DECIMAL_CURRENCIES`.
   - Agregar `/forgot-password` a `STATIC_ROUTES` en `sitemap.ts`. `/reset-password`, `/check-email` y `/account-deleted` llevan `noindex`.
5. **`/auth/confirm`.**
   - `app/auth/confirm/route.ts`: `verifyOtp({ token_hash, type })` y redirige a `next` (con `safeRedirectPath`).
   - Si falla, redirige a `/sign-in?error=link` ("El enlace expiró o ya se usó").
6. **Olvidé mi contraseña.**
   - `src/features/auth/schemas.ts`: `forgotPasswordSchema` (email) y `resetPasswordSchema` (`password` mínimo 8 + `confirmPassword` igual).
   - Actions `requestPasswordReset` (`resetPasswordForEmail`) y `resetPassword` (`updateUser({ password })`).
   - `requestPasswordReset` siempre responde "Si existe una cuenta con ese email, te enviamos un enlace", salvo el error de límite ("Demasiados intentos, espera unos minutos").
   - Páginas `app/(auth)/forgot-password/page.tsx` y `app/(auth)/reset-password/page.tsx`.
   - `/reset-password` sin sesión redirige a `/forgot-password?error=expired`. Al guardar, redirige a `/dashboard` con un toast.
   - Enlace "¿Olvidaste tu contraseña?" en `/sign-in`.
   - `proxy.ts`: `/forgot-password` entra en `AUTH_ROUTES`. `/reset-password` no.
7. **Confirmación de email lista.**
   - `signUp`: si `auth.signUp` no devuelve sesión, redirige a `/check-email?email=<email>`. Si devuelve sesión, sigue entrando a `/dashboard` como hoy.
   - `app/(auth)/check-email/page.tsx` con "Reenviar correo" (`auth.resend({ type: "signup" })`).
   - `translateAuthError` traduce `email_not_confirmed` y `/sign-in` muestra el enlace a `/check-email`.
8. **Página de cuenta (esqueleto + perfil).**
   - `app/dashboard/account/page.tsx` con `buildMetadata` (`noindex`) y las 4 secciones.
   - `src/features/account/queries.ts`: `getAccount()` (usuario, `profile`, `has_password()`, `new_email`), con `cache`.
   - `src/features/account/schemas.ts` y `actions.ts`: `updateProfile` (nombre) y `updateCurrency` (`z.enum` de `SITE.currencies`).
   - El select de moneda dice "Solo cambia el formato. Tus montos no se convierten."
   - Ítem "Cuenta" (`UserRound`) en `user-menu.tsx`.
   - Tras guardar, `revalidatePath` del layout del dashboard para que el aside y los montos se actualicen.
9. **Avatar.**
   - `src/features/account/components/avatar-uploader.tsx` (client):
     - valida tipo y 5 MB;
     - recorta al centro con `<canvas>` y exporta WebP 256×256;
     - sube a `avatars/<user_id>/<uuid>.webp` con el cliente de navegador.
   - Action `setAvatar(path)`:
     - verifica que `path` empiece con `<user_id>/`;
     - guarda la URL pública en `avatar_url`;
     - borra los demás archivos de la carpeta.
   - Action `removeAvatar`: borra la carpeta y deja `avatar_url` en `null`.
10. **Cambiar email.**
    - `changeEmailSchema` y action `changeEmail` (`updateUser({ email })`).
    - Responde "Te enviamos un enlace a tu correo actual y al nuevo. El cambio se aplica cuando confirmes los dos."
    - Si `user.new_email` existe, la sección muestra "Cambio pendiente a X".
    - `/dashboard/account` muestra un aviso si llega `?notice=email-confirmed`.
11. **Contraseña.**
    - Con contraseña: `changePasswordSchema` (actual, nueva mínimo 8, confirmar). La action verifica la actual con `signInWithPassword` y luego hace `updateUser({ password })`.
    - Sin contraseña: `createPasswordSchema` (nueva + confirmar) y `updateUser({ password })`.
    - Contraseña actual incorrecta muestra "La contraseña actual no es correcta".
12. **Programar el borrado.**
    - `delete-account-dialog.tsx`: `AlertDialog` destructivo. El botón se habilita solo cuando el texto es igual al email.
    - Action `requestAccountDeletion`:
      - revalida en el servidor que el texto coincide con `user.email`;
      - borra la carpeta `avatars/<user_id>/` y deja `avatar_url` en `null`;
      - llama a `request_account_deletion()` y a `signOut`;
      - redirige a `/sign-in?notice=account-deletion-scheduled`.
    - `/sign-in` muestra el aviso "Tu cuenta se borrará el <fecha>. Inicia sesión antes para restaurarla."
13. **Periodo de gracia.**
    - `proxy.ts`:
      - usuario marcado en `/dashboard/*` → `/account-deleted`;
      - usuario sin marca en `/account-deleted` → `/dashboard`;
      - sin sesión en `/account-deleted` → `/sign-in`.
    - `app/account-deleted/page.tsx`: fecha de borrado, "Restaurar cuenta" (`cancel_account_deletion()` → `/dashboard`) y "Cerrar sesión".
14. **Docs.**
    - `docs/producto.md`: cuenta, moneda (solo formato), borrado con gracia y confirmación de email activable.
    - `README.md`:
      - copiar las 3 plantillas al dashboard remoto;
      - `minimum_password_length = 8` y la URL `/auth/confirm` en remoto;
      - cómo encender la confirmación de email y por qué conviene SMTP propio antes.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).
    - `CLAUDE.md`: mencionar `pg_cron`, el bucket `avatars` y `supabase/templates/`.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y no hay dependencias nuevas.
- [ ] `supabase db reset` aplica las migraciones sin errores.
- [ ] "Cuenta" en el menú de usuario abre `/dashboard/account`. El aside sigue visible y ningún ítem queda activo.
- [ ] Cambiar el nombre a "Ana María" lo actualiza en la página y en el menú de usuario sin recargar a mano.
- [ ] Un nombre de 1 o de 81 caracteres muestra un error de validación y no guarda.
- [ ] Subir un PNG de 3000×2000 guarda un WebP de 256×256 en `avatars/<user_id>/` y lo muestra en el menú de usuario.
- [ ] Subir un segundo avatar deja un solo archivo en la carpeta del usuario.
- [ ] Un archivo de 6 MB o un PDF muestra un error y no sube nada.
- [ ] "Quitar foto" vacía la carpeta, deja `avatar_url` en `null` y el menú muestra las iniciales.
- [ ] Con la clave publicable y la sesión de A, subir o borrar en `avatars/<id de B>/` falla.
- [ ] Cambiar la moneda a USD muestra los montos de Resumen como `US$ 50.000,00` sin cambiar el número guardado. Con CLP se muestran sin decimales.
- [ ] Enviar una moneda fuera de la lista a la action devuelve error y no guarda.
- [ ] "Cambiar email" a un correo nuevo envía un correo a cada dirección (visible en Mailpit) y la página muestra "Cambio pendiente a <nuevo>".
- [ ] Tras abrir los dos enlaces, el email del menú de usuario es el nuevo e iniciar sesión con él funciona.
- [ ] Cambiar la contraseña con la actual incorrecta muestra "La contraseña actual no es correcta" y no la cambia.
- [ ] Cambiar la contraseña con la actual correcta permite iniciar sesión con la nueva y no con la vieja.
- [ ] Un usuario que entró solo con Google o GitHub ve "Crear contraseña" en vez de "Cambiar contraseña". Después de crearla, inicia sesión con email + contraseña.
- [ ] `/forgot-password` con un email registrado y con uno no registrado muestra el mismo mensaje. Solo el registrado recibe correo.
- [ ] El enlace del correo de recuperación (en español, con la marca Tesoro) abre `/reset-password`. Guardar la nueva contraseña lleva a `/dashboard`.
- [ ] Abrir el mismo enlace de recuperación una segunda vez lleva a `/sign-in` con "El enlace expiró o ya se usó".
- [ ] `/reset-password` sin sesión redirige a `/forgot-password?error=expired`.
- [ ] Con `enable_confirmations = false`, registrarse sigue entrando directo a `/dashboard/personal`.
- [ ] Con `enable_confirmations = true` (solo en local), registrarse lleva a `/check-email`, llega el correo en español y su enlace entra a `/dashboard`. Iniciar sesión antes de confirmar muestra el error en español con el enlace para reenviar.
- [ ] En el diálogo de eliminar, el botón queda deshabilitado hasta escribir el email exacto.
- [ ] Confirmar el borrado vacía la carpeta del avatar, cierra la sesión y lleva a `/sign-in` con la fecha de borrado (hoy + 30 días).
- [ ] Tras programar el borrado, `auth.users.raw_app_meta_data` tiene `deletion_requested_at` y todos los datos del usuario siguen en la BD.
- [ ] Iniciar sesión con una cuenta marcada lleva a `/account-deleted`. Entrar a `/dashboard/personal/transactions` también redirige ahí.
- [ ] "Restaurar cuenta" quita la marca y lleva a `/dashboard/personal` con todos los datos intactos.
- [ ] Con `deletion_requested_at` puesto a hace 31 días, `select public.purge_deleted_accounts()` devuelve 1 y no quedan filas del usuario en `profiles`, `workspaces`, `transactions`, `categories`, `accounts`, `transfers` ni en ninguna otra tabla del espacio.
- [ ] Con la marca a hace 29 días, `purge_deleted_accounts()` devuelve 0.
- [ ] Un usuario `authenticated` no puede ejecutar `purge_deleted_accounts()` y un usuario `anon` no puede ejecutar ninguna de las 4 funciones.
- [ ] Borrar desde la app una categoría o una cuenta en uso sigue fallando con el mismo mensaje que antes de este spec.
- [ ] Ningún archivo del proyecto usa la `service_role` ni la clave secreta.

## Decisiones

- **Sí:** un solo spec para cuenta, contraseña, email y borrado. Comparten página y flujos de auth. Partirlo dejaría `/dashboard/account` a medias.
- **Sí:** confirmación de email lista pero apagada. Encenderla sin SMTP propio choca con el límite de correos de Supabase.
- **No:** encenderla ya. Cambiaría el flujo del SPEC 01 sin un SMTP que la sostenga.
- **No:** SMTP propio en este spec. Es configuración de infraestructura, no de producto.
- **Sí:** enlaces con `token_hash` a `/auth/confirm`. Funcionan aunque el correo se abra en otro navegador. El `code` PKCE de `/auth/callback` exige el mismo navegador.
- **Sí:** plantillas de `confirmation`, `recovery` y `email_change`. Al principio eran solo las dos primeras. `email_change` entró porque cambiar el email entró al alcance.
- **No:** las plantillas de `invite`, `magic_link` y `reauthentication`. Hoy no se usan.
- **Sí:** cambiar el email con doble confirmación (`double_confirm_changes = true`, ya activo). Evita que una sesión robada se quede con la cuenta.
- **Sí:** la moneda solo cambia el formato. Convertir montos necesita tasas y toca todas las tablas.
- **No:** convertir montos. Si llega, va en su propio spec.
- **Sí:** validar la moneda solo con Zod contra `SITE.currencies`. Agregar una moneda no exige migración.
- **No:** un `check` con la lista en la BD.
- **Sí:** periodo de gracia de 30 días. Protege contra borrados por error o desde una sesión robada.
- **No:** borrado inmediato. Fue la recomendación inicial, pero el usuario eligió la gracia.
- **Sí:** la marca en `raw_app_meta_data`. El proxy la lee del `getUser()` que ya hace, y el usuario no la puede editar (a diferencia de `user_metadata`).
- **No:** columna en `profiles`. Obligaría al proxy a consultar la BD en cada request.
- **Sí:** durante la gracia el login funciona y lleva a `/account-deleted`. Restaurar no depende del email.
- **No:** bloquear el login. Restaurar exigiría un enlace por correo.
- **Sí:** confirmar escribiendo el email. Funciona igual para usuarios con y sin contraseña.
- **Sí:** cerrar la sesión al programar el borrado.
- **Sí:** RPC `security definer` + `pg_cron` para la purga. No hace falta la `service_role` ni un deploy aparte.
- **No:** Admin API con `service_role` ni Edge Function programada.
- **Sí:** borrar el avatar al programar el borrado, con la sesión del usuario. Postgres no puede borrar archivos de Storage, así que la purga no podría hacerlo. Si restaura, vuelve sin foto.
- **No:** dejar los archivos huérfanos. Serían datos personales sin dueño.
- **Sí:** bucket público con escritura por carpeta propia y nombres `<uuid>.webp`. Un `<img>` simple y cacheable, y la URL no se adivina.
- **No:** bucket privado con URLs firmadas. Habría que regenerarlas en cada render.
- **Sí:** recorte cuadrado y WebP de 256 px en el cliente con `<canvas>`. Sin dependencias, y el bucket limita a 1 MB y `image/webp`.
- **No:** editor de recorte (`react-easy-crop`). Dependencia extra para un caso menor.
- **Sí:** pedir la contraseña actual para cambiarla, y dejar a los usuarios de solo OAuth crear una sin pedirla.
- **Sí:** `has_password()` en SQL. `user.identities` no dice de forma confiable si el usuario tiene contraseña.
- **Sí:** respuesta igual en `/forgot-password` exista o no el email. Evita enumerar cuentas.
- **Sí:** `/dashboard/account` dentro del layout del dashboard, sin ítem activo y con entrada desde el menú de usuario.
- **No:** pestañas internas en la página de cuenta. Cuatro secciones caben apiladas.
- **Sí:** cambiar a `no action` las FK `restrict`. Fuera de la cascada bloquean igual, y dentro de ella dejan que el borrado termine.

## Riesgos

| Riesgo                                                                                                   | Mitigación                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las FK `on delete restrict` se revisan al instante y pueden romper la cascada al borrar un espacio       | El paso 1 las cambia a `no action`, que se revisa al final de la sentencia. Un criterio de aceptación prueba la purga con datos en todas las tablas      |
| Sin SMTP propio, Supabase manda muy pocos correos por hora (recuperación, cambio de email, confirmación) | El README lo documenta. `requestPasswordReset` traduce el error de límite. La confirmación de registro sigue apagada                                     |
| Las plantillas y `minimum_password_length` de `config.toml` no se aplican al proyecto remoto             | El README lista los pasos manuales en el dashboard de Supabase                                                                                           |
| `pg_cron` no está activo en el proyecto remoto                                                           | La migración hace `create extension if not exists pg_cron`. Tras `db push` se verifica `select * from cron.job` en remoto                                |
| Con `double_confirm_changes`, el primer enlace de cambio de email no cambia nada todavía                 | El aviso tras `/auth/confirm` dice "Enlace confirmado. Si aún no ves el cambio, confirma también el otro correo". Se prueba el flujo completo en Mailpit |
| `setAvatar` recibe una ruta manipulada                                                                   | La action exige que empiece con `<user_id>/` y las políticas de Storage bloquean otras carpetas                                                          |
| Verificar la contraseña actual con `signInWithPassword` crea una sesión nueva                            | Es la misma cuenta y el mismo navegador. La sesión nueva reemplaza la anterior en las cookies sin efecto visible                                         |
| Un usuario marcado usa la API directo con su sesión durante la gracia                                    | Sus datos se purgan igual al día 30. El proxy solo cubre la UI, y no hace falta más                                                                      |
| Durante la gracia el email sigue ocupado y no se puede volver a registrar                                | `/sign-up` muestra el error de email ya registrado. Iniciar sesión lleva a `/account-deleted`, donde puede restaurar                                     |

## Lo que **no** entra en este spec

- 2FA.
- Vincular o desvincular proveedores OAuth.
- Exportar los datos personales.
- Convertir montos al cambiar la moneda.
- SMTP propio y encender la confirmación de email en producción.
- Correos que avisen del borrado de la cuenta.
- Cerrar las demás sesiones al cambiar la contraseña.
- Editor de recorte del avatar.
- Ajustes del espacio Empresa.

Cada uno de esos puntos, si llega, va en su propio spec.
