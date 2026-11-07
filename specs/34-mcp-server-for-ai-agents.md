# SPEC 34 — Servidor MCP para agentes de IA

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 08c, SPEC 09, SPEC 10, SPEC 12, SPEC 26, SPEC 32
> **Fecha:** 2026-11-06
> **Objetivo:** Que el usuario conecte Claude, ChatGPT u otro agente a Tesoro con una URL MCP y un login OAuth, y que el agente lea todos sus datos y cree, edite en lote, borre y revierta movimientos y traspasos de sus espacios Personal y Empresa.

## Por qué existe este spec

Hoy todo registro pasa por la UI. Quien ya usa un agente de IA para organizar su vida quiere decirle "registra el almuerzo de hoy, 32.000 en Nequi" o "¿cuánto gasté en comida este mes comparado con octubre?" y que el agente lo haga contra sus datos reales.

MCP (Model Context Protocol) es el estándar que Claude, ChatGPT, Claude Code y Cursor usan para conectar herramientas remotas. Los conectores remotos de Claude.ai y ChatGPT exigen **OAuth 2.1** con PKCE y registro dinámico de clientes. Supabase Auth ya ofrece un servidor OAuth 2.1 (beta), así que Tesoro solo pone la pantalla de consentimiento y el endpoint MCP.

La idea original abarca todas las entidades. Se parte en dos:

- **SPEC 34 (este):** OAuth, endpoint MCP, lectura de todo, escritura de movimientos y traspasos (crear, editar en lote, borrar, revertir), gestión de agentes en la cuenta, sección en la landing y página `/mcp`.
- **SPEC 35 (futuro):** escritura del resto de entidades: cuentas, gastos e ingresos fijos, presupuestos, metas, deudas y tarjetas, me deben, ventas de Empresa con campos propios.

`SPEC 33` sigue reservado para los reportes PDF que anunció SPEC 32.

## Alcance

**Entra:**

- **Autorización con el servidor OAuth 2.1 de Supabase:**
  - se activa en el proyecto (dashboard → Authentication → OAuth Server) y en `supabase/config.toml` (`[auth.oauth_server] enabled = true`, `authorization_url_path = "/oauth/consent"`, `allow_dynamic_registration = true`);
  - las claves de firma JWT del proyecto son asimétricas (RS256 / ES256), requisito para validar tokens con JWKS;
  - los clientes (Claude, ChatGPT…) se registran solos con registro dinámico. Tesoro no registra clientes a mano.
- **Pantalla de consentimiento** `app/oauth/consent/page.tsx`:
  - recibe `authorization_id` en la query;
  - sin sesión, redirige a `/sign-in?next=/oauth/consent?authorization_id=...` y vuelve al terminar el login;
  - con cuenta marcada para borrar, redirige a `/account-deleted` (igual que el dashboard);
  - lee `supabase.auth.oauth.getAuthorizationDetails(authorization_id)` y muestra: logo de Tesoro, "**<Cliente>** quiere acceder a tu cuenta de Tesoro", el correo de la sesión y qué podrá hacer;
  - selector **Acceso**: tabs **Leer y escribir** (por defecto) | **Solo lectura**, con una línea que explica cada uno;
  - botones **Autorizar** (`approveAuthorization`) y **Cancelar** (`denyAuthorization`). Ambos redirigen a la URL que devuelve Supabase;
  - `authorization_id` inválido o vencido: `EmptyState` "Esta solicitud ya no es válida. Vuelve a conectar desde tu agente.";
  - al autorizar, hace upsert en `mcp_connections` con el `client_id`, el nombre del cliente y el acceso elegido.
- **Descubrimiento OAuth** (Route Handlers, JSON, `Cache-Control: public, max-age=3600`):
  - `app/.well-known/oauth-protected-resource/route.ts` y `app/.well-known/oauth-protected-resource/api/mcp/route.ts` (RFC 9728): `resource` = `<SITE_URL>/api/mcp`, `authorization_servers` = `[<SUPABASE_URL>/auth/v1]`, `bearer_methods_supported: ["header"]`;
  - `app/.well-known/oauth-authorization-server/route.ts`: reenvía el JSON de `<SUPABASE_URL>/.well-known/oauth-authorization-server/auth/v1`, para clientes que lo buscan en el origen del recurso.
- **Endpoint MCP** `app/api/mcp/route.ts`:
  - transporte **Streamable HTTP** sin estado, con `@modelcontextprotocol/sdk` (`WebStandardStreamableHTTPServerTransport`). `POST` atiende JSON-RPC; `GET` y `DELETE` responden 405;
  - URL pública: `<SITE_URL>/api/mcp` (`SITE.mcp.path`);
  - sin `Authorization: Bearer` o con token inválido: 401 con `WWW-Authenticate: Bearer resource_metadata="<SITE_URL>/.well-known/oauth-protected-resource/api/mcp"`;
  - valida el token con `supabase.auth.getClaims(token)` (firma por JWKS, expiración). Exige el claim `client_id`: un token de sesión normal del navegador no sirve;
  - con el token crea un cliente de Supabase con la clave publicable y `global.headers.Authorization`. Todas las lecturas y escrituras pasan por RLS como el usuario. Nunca `service_role`;
  - cuenta marcada para borrar: 403 `{ error: "Tu cuenta está en proceso de borrado." }`;
  - rate limit de **120 llamadas por minuto por usuario**; al pasarlo, 429 con `Retry-After`;
  - actualiza `mcp_connections.last_used_at` como máximo una vez por minuto por conexión;
  - `Cache-Control: no-store` en toda respuesta.
- **`proxy.ts`:** `/oauth/consent` exige sesión como el dashboard. `/api/mcp` y `/.well-known/*` no pasan por `updateSession` (no usan cookies).
- **`robots.ts`:** bloquea `/oauth/`. `/api/` ya está bloqueado.
- **Permisos por conexión:** `mcp_connections.access` es `read` o `write`. Con `read`, las tools de escritura no se listan en `tools/list` y, si se llaman, responden el error "Esta conexión es de solo lectura. Cámbiala en Tesoro → Cuenta → Agentes IA.". Un token cuyo `client_id` no tiene fila crea una con `access = 'read'`.
- **Convenciones de las tools:**
  - nombres en `snake_case` inglés (convención MCP); descripciones, mensajes y errores en español;
  - entrada validada con Zod (los mismos esquemas exportan el JSON Schema de la tool);
  - toda tool de un espacio recibe `workspace_id`. El espacio se resuelve con `findWorkspace` (lectura) o con el equivalente de `requireWritableWorkspace` (escritura); ajeno o inexistente → error "Espacio no encontrado.";
  - fechas `YYYY-MM-DD`, meses `YYYY-MM`, hora `HH:MM` o `null`, todo en `America/Bogota`;
  - montos como número decimal positivo, más `currency` (moneda del perfil) en cada respuesta;
  - **Ocultar montos** (SPEC 22) no aplica al MCP: el agente recibe los montos reales;
  - cada respuesta trae `structuredContent` (JSON) y un `content` de texto corto que lo resume;
  - anotaciones MCP: lecturas con `readOnlyHint: true`; borrados con `destructiveHint: true`; `undo_operation` con `destructiveHint: true`.
- **Tools de lectura** (con `read` o `write`):
  - `list_workspaces`: espacios del usuario (id, tipo `personal`/`business`, nombre, marcado para borrar);
  - `list_accounts`: cuentas con saldo actual (`account_balances`), tipo y archivada;
  - `list_categories`: categorías del espacio por tipo (ingreso/gasto), del sistema y propias;
  - `get_month_summary`: un mes (`YYYY-MM`). Personal: ingresos, gastos, balance, tasa de ahorro, saldo al inicio y al cierre, top 5 categorías de gasto. Empresa: ventas, costos y gastos, utilidad, margen, saldos;
  - `get_period_report`: rango `from`/`to` en meses (hasta 36). Serie mes a mes con los mismos totales y `category_totals` del periodo. Reusa `src/features/reports/` y las consultas de SPEC 32;
  - `list_transactions`: filtros `from`, `to`, `type`, `category_id`, `account_id`, `search` (descripción y nota), `verified`, `linked` (`any`/`none`/`debt`/`recurring_expense`/`recurring_income`/`receivable`); paginado con `limit` (1–200, por defecto 50) y `cursor` opaco. Cada fila trae su vínculo si lo tiene;
  - `get_transaction`: un movimiento por id, con vínculo y cuenta;
  - `list_transfers`: traspasos con filtros `from`, `to`, `account_id`; mismo paginado;
  - `list_budgets`: presupuestos con progreso del mes (`budget_progress`);
  - `list_goals`: metas con progreso (`goal_progress`);
  - `list_debts`: deudas y tarjetas con saldo (`debt_overview`);
  - `list_recurring`: gastos e ingresos fijos del mes con estado (Pagado/Recibido, Pendiente, De hoy, Atrasado), mismo cálculo que las páginas;
  - `list_receivables`: "Me deben" del mes con esperado, cobrado y pendiente;
  - `get_score`: score de salud (Personal SPEC 07, Empresa SPEC 11) con factores y recomendaciones activas;
  - `get_cash_flow`: flujo de caja de Empresa por mes (SPEC 11). En Personal responde error "Solo disponible en espacios de Empresa.";
  - `list_operations`: historial de operaciones del MCP (ver "Revertir"), de la conexión actual o de todas (`all_connections: true`).
- **Tools de escritura** (solo con `write`). Todas aceptan `dry_run` (por defecto `false`):
  - `create_transactions`: 1–200 movimientos `{ type, amount, category_id, account_id, occurred_on, time?, description, note? }`;
  - `update_transactions`: 1–200 parches `{ id, ...campos }`. Campos editables: `type`, `amount`, `category_id`, `account_id`, `occurred_on`, `time`, `description`, `note`, `verified`;
  - `delete_transactions`: 1–200 ids;
  - `create_transfers`, `update_transfers`, `delete_transfers`: mismo contrato con `{ from_account_id, to_account_id, amount, occurred_on, time?, note? }`;
  - `create_category`: crea una categoría del espacio (`name`, `type`). Necesaria para que el agente registre movimientos en una categoría que no existe;
  - `undo_operation`: revierte una operación por id.
- **Reglas de escritura:**
  - misma validación que la UI (Zod de `src/features/transactions/schemas.ts` y de traspasos): categoría del tipo correcto, cuenta activa, monto > 0, descripción 1–120, nota ≤ 500;
  - **movimientos vinculados** siguen las reglas de la UI (SPEC 26): editar monto, fecha o cuenta propaga al vínculo (pago de deuda o tarjeta, gasto fijo, ingreso fijo, cobro de "me deben"); borrar borra el vínculo. El log guarda las dos filas;
  - `day_position` se asigna igual que al crear desde la UI;
  - **todo o nada:** primero se validan todas las filas; si una falla, no se escribe ninguna y la respuesta lista cada error con su índice. Si falla una escritura a mitad de camino, las filas ya aplicadas se revierten con el log y la operación queda `failed`;
  - **`dry_run: true`** valida y devuelve el antes y el después de cada fila sin guardar ni crear operación;
  - respuesta de una escritura real: `operation_id`, cantidad de filas, resumen ("3 movimientos creados en Personal") e ids afectados.
- **Revertir:**
  - toda escritura real del MCP crea una fila en `mcp_operations` y una por fila tocada en `mcp_operation_rows`, con el snapshot antes y después;
  - `undo_operation(operation_id)` llama a la RPC `undo_mcp_operation`, que en una transacción restaura los snapshots `before` (borra lo creado, recrea lo borrado, devuelve lo editado);
  - si alguna fila cambió después de la operación (`updated_at` distinto al del snapshot `after`, o ya no existe cuando debería), no revierte nada y responde "No se puede revertir: N filas cambiaron después. Revisa los movimientos en Tesoro.";
  - una operación se revierte una sola vez. Revertir no crea una operación nueva (no hay "rehacer");
  - ventana de **30 días**. Un job de `pg_cron` diario `purge-mcp-operations` borra las operaciones más viejas.
- **Cuenta → Agentes IA** (`app/dashboard/account/agents/page.tsx`, ícono `Bot`, nueva línea en `SITE.account.sections`):
  - **Tu URL de MCP**: `<SITE_URL>/api/mcp` en un campo de solo lectura con botón **Copiar** (toast "URL copiada") y enlace "Cómo conectarla" a `/mcp`;
  - **Agentes conectados**: lista con `surface.ts` (nombre del cliente, autorizado el, último uso). Por fila: `Select` **Leer y escribir** / **Solo lectura** y botón **Revocar** con confirmación. Revocar llama a `supabase.auth.oauth.revokeGrant` y borra la fila de `mcp_connections`. Lee los grants con `getUserGrants()`;
  - vacío: `EmptyState` "Aún no has conectado ningún agente." con enlace a `/mcp`;
  - **Historial**: las últimas 50 operaciones (fecha, agente, espacio, resumen, estado `Aplicada` / `Revertida` / `Fallida`) con botón **Revertir** en las aplicadas y fallidas de menos de 30 días. Usa la misma RPC que `undo_operation`;
  - en móvil, listas como tarjetas (`DataRows`) y controles de 44 px.
- **Landing:**
  - sección `src/features/landing/components/agents-section.tsx` en `app/(public)/page.tsx`, entre `ScoreSection` y `WorkspacesSection`;
  - contenido: título, una frase de valor, tres ejemplos de pedidos al agente (registrar, preguntar, corregir en lote), logos en texto de Claude, ChatGPT, Claude Code y Cursor (sin marcas gráficas de terceros), URL copiable y CTA **Ver cómo conectarlo** → `/mcp`;
  - textos en `SITE.landing.agents`. Animación con `Reveal`, igual que las otras secciones.
- **Página pública `/mcp`** (`app/(public)/mcp/page.tsx`, `buildMetadata`, `buildBreadcrumbSchema`, en `STATIC_ROUTES` de `sitemap.ts`):
  - qué es y qué puede hacer el agente;
  - URL copiable;
  - pasos por cliente: **Claude** (conector personalizado con la URL), **ChatGPT** (conector con la URL), **Claude Code** (`claude mcp add --transport http tesoro <URL>`), **Cursor** (bloque `mcp.json`);
  - catálogo de tools agrupado (Lectura, Escritura, Revertir) generado desde `src/features/mcp/catalog.ts`;
  - seguridad: login con tu cuenta, solo lectura opcional, revertir 30 días, revocar desde Cuenta → Agentes IA, el agente ve los montos reales;
  - ejemplos de pedidos.
- **Documentación:** `docs/mcp.md` (arquitectura, cómo probar con MCP Inspector, cómo agregar una tool), `docs/producto.md` y `CLAUDE.md` (sección MCP y el tercer job de `pg_cron`), `CHANGELOG.md` en `[Unreleased]`, `.env.example` sin variables nuevas (usa las de Supabase y `NEXT_PUBLIC_SITE_URL`).

**Fuera de alcance (para specs futuros):**

- Escritura de cuentas, gastos e ingresos fijos, presupuestos, metas, deudas y tarjetas, me deben y pagos de deuda desde el MCP (SPEC 35).
- Campos propios de Empresa en ventas y costos (contraparte, factura) al escribir. En SPEC 34 se leen; se escriben en SPEC 35.
- Tokens API personales (sin OAuth) para scripts, n8n o Zapier.
- Importar archivos Excel o CSV desde el agente.
- Exportar `.xlsx` o `.csv` desde el agente.
- Prompts y resources MCP (solo tools en esta versión).
- Notificaciones o sesiones con estado (SSE, `GET /api/mcp`).
- "Rehacer" una operación revertida.
- Revertir cambios hechos desde la UI.
- App de ChatGPT con UI propia (Apps SDK) o widgets.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_mcp.sql`.

```sql
create type public.mcp_access as enum ('read', 'write');
create type public.mcp_operation_status as enum ('applied', 'undone', 'failed');

-- Una fila por agente autorizado (client_id de Supabase OAuth)
create table public.mcp_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text not null,
  client_name text not null check (char_length(client_name) between 1 and 120),
  access public.mcp_access not null default 'read',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (user_id, client_id)
);

-- Una fila por escritura real del MCP
create table public.mcp_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id text not null,
  tool text not null,              -- 'create_transactions', 'update_transfers'…
  summary text not null,           -- '3 movimientos creados en Personal'
  row_count int not null check (row_count between 1 and 400),
  status public.mcp_operation_status not null default 'applied',
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  check ((status = 'undone') = (undone_at is not null))
);

-- Snapshot por fila tocada. before null = se creó; after null = se borró
create table public.mcp_operation_rows (
  operation_id uuid not null references public.mcp_operations (id) on delete cascade,
  position int not null,
  table_name text not null check (table_name in (
    'transactions', 'transfers', 'categories', 'debt_entries',
    'goal_contributions', 'receivable_installment_history'
  )),
  row_id uuid not null,
  before jsonb,
  after jsonb,
  check (before is not null or after is not null),
  primary key (operation_id, position)
);

-- Ventana fija de 1 minuto por usuario
create table public.mcp_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, window_start)
);
```

RLS y funciones:

- `mcp_connections`, `mcp_operations`, `mcp_operation_rows`: `select`, `insert`, `update`, `delete` solo de filas con `user_id = auth.uid()` (para `mcp_operation_rows`, por el `user_id` de su operación).
- `mcp_rate_limits`: RLS sin políticas; solo se toca desde `mcp_hit_rate_limit()`.
- `mcp_hit_rate_limit() returns table (allowed boolean, retry_after int)`: `security definer`, usa `auth.uid()`, hace upsert del contador de la ventana actual y borra ventanas de más de una hora del mismo usuario. `grant execute` solo a `authenticated`.
- `undo_mcp_operation(p_operation_id uuid) returns void`: `security invoker` (RLS de cada tabla aplica), en una transacción:
  - falla si la operación no es del usuario, no está `applied` o `failed`, o tiene más de 30 días;
  - recorre las filas en orden inverso a `position`, verifica conflictos (`updated_at` y existencia) y restaura con `jsonb_populate_record` solo en las tablas de la lista;
  - en una `failed`, las filas que la compensación ya dejó como en `before` (o ya borró, si se crearon) se saltan en vez de contar como conflicto;
  - marca la operación `undone`.
- `pg_cron` `purge-mcp-operations`: diario, borra `mcp_operations` con `created_at < now() - interval '30 days'`.
- Índices: `mcp_operations (user_id, created_at desc)`.

Tipos en TypeScript (`src/features/mcp/types.ts`):

```ts
type McpContext = {
  supabase: SupabaseClient<Database> // con el Bearer del agente
  userId: string
  clientId: string
  access: "read" | "write"
}

type McpToolDefinition = {
  name: string // 'create_transactions'
  group: "read" | "write" | "undo"
  title: string // 'Crear movimientos'
  description: string
  input: ZodType
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean }
}
```

`SITE.mcp`:

```ts
mcp: {
  path: "/api/mcp",
  docsPath: "/mcp",
  bulkLimit: 200,
  rateLimitPerMinute: 120,
  undoWindowDays: 30
}
```

Los límites de verdad viven en el servidor (`bulkLimit` en Zod, rate limit y ventana en SQL). `SITE.mcp` los refleja en la UI y la página `/mcp`.

## Estructura de archivos

```text
app/
  .well-known/oauth-authorization-server/route.ts
  .well-known/oauth-protected-resource/route.ts
  .well-known/oauth-protected-resource/api/mcp/route.ts
  api/mcp/route.ts
  oauth/consent/page.tsx
  (public)/mcp/page.tsx
  dashboard/account/agents/page.tsx
src/features/mcp/
  auth.ts            # Bearer → claims → McpContext
  server.ts          # crea el McpServer y registra las tools según access
  catalog.ts         # McpToolDefinition[]: fuente de tools y de la página /mcp
  rate-limit.ts
  operations.ts      # registrar snapshots, compensar fallas, undo
  tools/read/*.ts
  tools/write/*.ts
  actions.ts         # consentimiento, cambiar acceso, revocar, revertir desde la UI
  components/        # consent-form, mcp-url-field, connections-list, operations-list
src/features/transactions/service.ts   # lógica extraída de actions.ts
src/features/accounts/transfer-service.ts
src/features/landing/components/agents-section.tsx
docs/mcp.md
```

## Plan de implementación

1. **Servicios de movimientos.** Extraer de `src/features/transactions/actions.ts` la lógica de crear, editar y borrar (incluye `record_transaction`, vínculos de SPEC 26 y `day_position`) a `service.ts`. Las funciones reciben `SupabaseClient` y datos tipados, y devuelven las filas tocadas antes y después. Las actions pasan a ser envoltorios (FormData → Zod → servicio → revalidate). Prueba: crear, editar y borrar un movimiento vinculado desde la UI funciona igual.
2. **Servicios de traspasos.** Mismo paso para `createTransfer`, `updateTransfer` y `deleteTransfer` en `src/features/accounts/transfer-service.ts`.
3. **Migración MCP.** Tablas, tipos, RLS, `mcp_hit_rate_limit`, `undo_mcp_operation`, job `purge-mcp-operations`. `supabase db push` y regenerar `src/types/database.ts`.
4. **OAuth en Supabase.** Activar el servidor OAuth y el registro dinámico en el proyecto remoto y en `config.toml`; verificar claves asimétricas. Prueba: `GET <SUPABASE_URL>/.well-known/oauth-authorization-server/auth/v1` responde.
5. **Pantalla de consentimiento.** `app/oauth/consent/page.tsx`, `consent-form`, action `approveMcpAuthorization` (aprueba y hace upsert en `mcp_connections`) y `denyMcpAuthorization`. Ajustar `proxy.ts` y `robots.ts`.
6. **Descubrimiento.** Las tres rutas `/.well-known/*` y `SITE.mcp`.
7. **Endpoint mínimo.** `app/api/mcp/route.ts` + `auth.ts` + `rate-limit.ts` + `server.ts` con solo `list_workspaces`. Excluir `/api/mcp` y `/.well-known/*` de `updateSession`. Prueba: MCP Inspector completa el login OAuth y lista los espacios.
8. **Catálogo y lecturas básicas.** `catalog.ts`, `list_accounts`, `list_categories`, `list_transactions`, `get_transaction`, `list_transfers`.
9. **Lecturas de reportes.** `get_month_summary`, `get_period_report`, `get_cash_flow`, `get_score`.
10. **Lecturas de planeación.** `list_budgets`, `list_goals`, `list_debts`, `list_recurring`, `list_receivables`.
11. **Log de operaciones.** `operations.ts` (registrar snapshots, compensar fallas a mitad de camino) y `list_operations`, `undo_operation`.
12. **Escrituras de movimientos.** `create_transactions`, `update_transactions`, `delete_transactions` con `dry_run`, todo o nada y log.
13. **Escrituras de traspasos y categorías.** `create_transfers`, `update_transfers`, `delete_transfers`, `create_category`.
14. **Permisos por conexión.** Ocultar y bloquear escrituras con `access = 'read'`; `last_used_at`.
15. **Cuenta → Agentes IA.** Página, URL copiable, agentes conectados (cambiar acceso, revocar) e historial con Revertir.
16. **Página `/mcp`.** Guía por cliente, catálogo desde `catalog.ts`, seguridad, sitemap.
17. **Sección de la landing.** `agents-section.tsx` y `SITE.landing.agents`.
18. **Documentación.** `docs/mcp.md`, `docs/producto.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] Agregar `<SITE_URL>/api/mcp` como conector personalizado en Claude.ai abre `/oauth/consent`, y tras **Autorizar** Claude lista las tools de Tesoro.
- [ ] El mismo flujo funciona en ChatGPT (conector con la URL) y en Claude Code (`claude mcp add --transport http`).
- [ ] Abrir `/oauth/consent?authorization_id=...` sin sesión lleva a `/sign-in` y, tras iniciar sesión, vuelve a la pantalla de consentimiento.
- [ ] **Cancelar** en el consentimiento deja al agente sin acceso y no crea fila en `mcp_connections`.
- [ ] `POST /api/mcp` sin `Authorization` responde 401 con `WWW-Authenticate` que apunta a `/.well-known/oauth-protected-resource/api/mcp`.
- [ ] Un token de sesión del navegador (sin claim `client_id`) recibe 401.
- [ ] La llamada 121 de un usuario dentro del mismo minuto responde 429 con `Retry-After`.
- [ ] `list_workspaces` devuelve solo los espacios del usuario del token.
- [ ] Cualquier tool con un `workspace_id` de otro usuario responde "Espacio no encontrado.".
- [ ] `get_month_summary` de un mes da los mismos ingresos, gastos y balance que la página de Resumen para ese mes.
- [ ] `list_transactions` con `limit: 200` y `cursor` recorre todos los movimientos de un periodo sin repetir ni saltar filas.
- [ ] `create_transactions` con 3 movimientos válidos los crea, aparecen en `/dashboard/personal/transactions` y la respuesta trae un `operation_id`.
- [ ] `create_transactions` con 201 movimientos se rechaza sin escribir nada.
- [ ] `create_transactions` con 5 filas donde la 4 tiene una categoría de ingreso en un gasto no crea ninguna y el error señala el índice 3.
- [ ] `update_transactions` con `dry_run: true` devuelve antes y después y no cambia ninguna fila ni crea operación.
- [ ] `update_transactions` que cambia el monto de un pago de tarjeta actualiza también el `debt_entries` vinculado, como en la UI.
- [ ] `delete_transactions` de 10 movimientos y luego `undo_operation` deja los 10 de vuelta con sus mismos ids y vínculos.
- [ ] `undo_operation` falla con el mensaje de conflicto si uno de los movimientos se editó desde la UI después, y no revierte ninguno.
- [ ] `undo_operation` sobre una operación ya revertida responde error y no cambia nada.
- [ ] Una operación de hace más de 30 días no se puede revertir y el job `purge-mcp-operations` la borra.
- [ ] Una escritura en una empresa marcada para borrar responde error; la lectura funciona.
- [ ] Con acceso **Solo lectura**, `tools/list` no incluye tools de escritura y llamar a `create_transactions` responde el error de solo lectura.
- [ ] Cambiar el acceso en Cuenta → Agentes IA se aplica en la siguiente llamada del agente.
- [ ] **Revocar** en Cuenta → Agentes IA hace que la siguiente llamada del agente responda 401.
- [ ] El historial de Cuenta → Agentes IA muestra la operación de un agente y **Revertir** la deja en estado `Revertida`.
- [ ] La home muestra la sección de agentes entre Score y Espacios, y su CTA lleva a `/mcp`.
- [ ] `/mcp` aparece en `sitemap.xml`, tiene canonical y breadcrumb, y su catálogo coincide con las tools que registra el servidor.
- [ ] `/oauth/` aparece bloqueado en `robots.txt`.
- [ ] Los pares texto/fondo nuevos (consentimiento, Agentes IA, sección y página `/mcp`) dan AA en claro y oscuro.
- [ ] Ningún archivo del MCP importa la clave `service_role`.

## Decisiones

- **Sí:** servidor OAuth 2.1 de Supabase. Claude.ai y ChatGPT exigen OAuth con PKCE y registro dinámico; Supabase lo da y el token sirve para RLS.
- **No:** OAuth propio en Route Handlers. Mucho código sensible (códigos, refresh, rotación) que Supabase ya resuelve.
- **No (por ahora):** tokens API personales. Útiles para scripts, pero los agentes principales usan OAuth. Pueden llegar en otro spec.
- **Sí:** Personal y Empresa desde el inicio. Las mismas tablas y reglas sirven para ambos; `workspace_id` en cada tool.
- **Sí:** dividir en dos specs. Escribir todas las entidades en uno solo superaba cuatro dominios.
- **Sí:** número 34. SPEC 32 reservó el 33 para PDF.
- **Sí:** extraer servicios de las server actions. El MCP y la UI comparten reglas (vínculos, `day_position`, validación) y no divergen.
- **No:** tools que hablan con tablas o RPC directo. Duplicarían las reglas de SPEC 26.
- **Sí:** log de operaciones con snapshots antes y después, y revertir en una RPC transaccional. Revertir es atómico y detecta conflictos con `updated_at`.
- **No:** soft delete con `deleted_at`. Tocaría todas las consultas existentes.
- **No:** deshacer solo lo último. El agente suele encadenar varias operaciones y el usuario necesita elegir cuál revertir.
- **Sí:** "todo o nada" con validación previa y compensación con el log. Los servicios usan supabase-js, que no abre transacciones de varias sentencias; validar todo antes deja la compensación para fallas raras (red, carrera).
- **No:** una RPC SQL por tool en lote. Obligaría a reescribir en plpgsql la lógica de vínculos que vive en TypeScript.
- **Sí:** 200 filas por llamada y `dry_run`. Suficiente para corregir un mes completo; `dry_run` deja al agente mostrar el cambio antes de aplicarlo.
- **No:** `confirm_token` obligatorio para borrar. Los clientes MCP ya piden confirmación con `destructiveHint`, y todo se puede revertir 30 días.
- **Sí:** acceso por conexión (`read` / `write`) en tabla propia. Supabase OAuth no soporta scopes propios.
- **Sí:** **Leer y escribir** por defecto en el consentimiento. El usuario conecta un agente para manejar sus finanzas; puede bajarlo a solo lectura ahí mismo o después.
- **Sí:** conexiones sin fila caen en `read`. Si el upsert del consentimiento falla, el agente no queda con escritura por accidente.
- **Sí:** rate limit en Postgres, 120 por minuto. Sin servicios externos; cubre agentes en bucle.
- **Sí:** Streamable HTTP sin estado con el SDK oficial. Corre en un Route Handler y en Vercel sin Redis ni sesiones.
- **No:** `mcp-handler` u otros adaptadores. Agregan una dependencia y soporte SSE que no se usa.
- **Sí:** solo tools, sin prompts ni resources. Son lo que todos los clientes soportan igual.
- **Sí:** el agente ve montos reales aunque **Ocultar montos** esté activo. Ocultar es una preferencia visual de la UI (SPEC 22), igual que en la exportación de SPEC 32.
- **Sí:** nombres de tools en inglés y textos en español. Los nombres siguen la convención MCP; lo que lee el usuario va en su idioma.
- **Sí:** catálogo único en `catalog.ts`. La página `/mcp` y el servidor no se desincronizan.
- **Sí:** nombres de clientes en texto, sin logos de Claude, ChatGPT o Cursor. Evita usar marcas de terceros.

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                                           |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| El servidor OAuth de Supabase está en beta y puede cambiar                      | Todo el uso queda en `auth.ts`, `consent` y `actions.ts`. `docs/mcp.md` documenta qué cambiar si la API se mueve.    |
| Los clientes buscan los metadatos OAuth en lugares distintos                    | Se publican las dos rutas de RFC 9728 y el reenvío de `oauth-authorization-server`. Se prueba con los tres clientes. |
| Un agente en bucle borra o edita mucho                                          | Rate limit, 200 por llamada, `destructiveHint`, historial visible y revertir 30 días.                                |
| La extracción de servicios rompe flujos de la UI                                | Pasos 1 y 2 van primero y se prueban solos en la UI antes de tocar el MCP.                                           |
| Compensación a mitad de camino falla (p. ej. la red cae)                        | La operación queda `failed` con sus snapshots y se puede revertir desde Agentes IA.                                  |
| Un snapshot restaurado choca con un trigger (`check_*`) por datos que cambiaron | `undo_mcp_operation` aborta toda la transacción y responde el error; no queda nada a medias.                         |
| Los pasos de conexión en Claude o ChatGPT cambian de nombre                     | La página `/mcp` describe los pasos en general y la URL es lo único fijo.                                            |
| Prompt injection: una descripción maliciosa en un movimiento instruye al agente | El agente solo actúa sobre datos del propio usuario; las escrituras son reversibles. Se advierte en `/mcp`.          |

## Qué **no** entra en este spec

- Escritura de cuentas, fijos, presupuestos, metas, deudas, tarjetas y me deben (SPEC 35).
- Tokens API personales.
- Importar o exportar archivos desde el agente.
- Prompts, resources, SSE o sesiones con estado.
- Rehacer operaciones o revertir cambios hechos desde la UI.
- Apps de ChatGPT con UI propia.

Cada uno, si llega, va en su propio spec.
