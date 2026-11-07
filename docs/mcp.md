# Servidor MCP

Guía técnica del servidor MCP de Tesoro ([SPEC 34](../specs/34-mcp-server-for-ai-agents.md)):
cómo está armado, cómo probarlo y cómo agregar una tool. El comportamiento de
producto está en [`producto.md`](producto.md#agentes-de-ia-mcp) y la guía para
el usuario, en la página pública `/mcp`.

## Arquitectura

```text
Agente (Claude, ChatGPT…)
  │ 1. POST /api/mcp sin token → 401 + WWW-Authenticate
  │ 2. GET /.well-known/oauth-protected-resource/api/mcp → authorization_servers
  │ 3. Registro dinámico, login y PKCE contra Supabase Auth (OAuth 2.1)
  │    └─ /oauth/consent: el usuario autoriza y elige el acceso
  │ 4. POST /api/mcp con Authorization: Bearer <token>
  ▼
app/api/mcp/route.ts
  ├─ auth.ts          getClaims (firma JWKS, exp, client_id) + getUser (sesión viva)
  ├─ rate-limit.ts    mcp_hit_rate_limit(): 120 llamadas por minuto
  ├─ context.ts       acceso (mcp_connections), moneda, last_used_at
  ├─ server.ts        McpServer sin estado; escrituras ocultas con acceso read
  └─ catalog.ts       las tools (tools/read, tools/write)
```

- **OAuth.** Lo hace el servidor OAuth 2.1 de Supabase (beta). Tesoro solo
  pone la pantalla de consentimiento (`app/oauth/consent/page.tsx`) y los
  metadatos de descubrimiento (`app/.well-known/*`, armados en
  `src/features/mcp/discovery.ts`). Los clientes se registran solos
  (registro dinámico).
- **Transporte.** Streamable HTTP sin estado con
  `WebStandardStreamableHTTPServerTransport` y `enableJsonResponse`. Se crea
  un `McpServer` por request. `GET` y `DELETE` responden 405.
- **Identidad.** `auth.ts` crea un cliente de Supabase con la clave
  publicable y el Bearer del agente: todo pasa por RLS como el usuario. Nunca
  `service_role`.
  - `getClaims` valida la firma (claves ES256 del proyecto) y exige el claim
    `client_id`: un token de sesión del navegador recibe 401.
  - `getUser(token)` confirma que la sesión sigue viva. Revocar un agente
    (`revokeGrant`) borra su sesión y la siguiente llamada recibe 401.
  - Una cuenta marcada para borrar recibe 403.
- **Cliente por contexto.** La ruta corre todo dentro de
  `runWithSupabaseClient(ctx.supabase, …)` (`src/libs/supabase/server.ts`):
  ahí `createClient()` devuelve el cliente del agente en vez de leer cookies.
  Así las tools reusan las consultas de la UI (reportes, score,
  presupuestos…) sin cambiarlas. Dentro **no** sirven las funciones que leen
  la sesión con `auth.getUser()` sin token, como `getPersonalWorkspace`.
- **Acceso.** `mcp_connections.access` (`read` o `write`) por agente. Sin
  fila, se crea una con `read`. Con `read`, las tools de grupo `write` y
  `undo` se registran deshabilitadas (fuera de `tools/list`) y la ruta
  responde el error de solo lectura si se llaman.
- **Escrituras.** Usan los servicios que comparten las Server Actions
  (`transactions/service.ts`, `accounts/transfer-service.ts`,
  `debts/entry-service.ts`, `categories/service.ts`), nunca tablas o RPC
  directo. Todo o nada: se valida todo antes de escribir.
- **Log y revertir.** `operations.ts` guarda cada escritura en
  `mcp_operations` y `mcp_operation_rows` (snapshot antes y después). La RPC
  `undo_mcp_operation` restaura en una transacción y aborta si una fila
  cambió después. Si una escritura falla a mitad, se guarda como `failed` y se
  compensa con la misma RPC.

## Probar en local

1. `pnpm dev`.
2. El servidor OAuth de Supabase arma la URL del consentimiento con el **Site
   URL** del proyecto. Para el login completo, la app de ese Site URL debe
   tener este código: usa un preview desplegado o, solo mientras pruebas, pon
   `http://localhost:3000` como Site URL y `NEXT_PUBLIC_SITE_URL`.
3. Abre [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

   ```bash
   npx @modelcontextprotocol/inspector
   ```

   Transporte **Streamable HTTP**, URL `<SITE_URL>/api/mcp`. El Inspector
   descubre el servidor OAuth, se registra, abre `/oauth/consent` y, tras
   **Autorizar**, lista las tools.

4. Sin login, comprobaciones rápidas:

   ```bash
   # 401 con WWW-Authenticate
   curl -i -X POST <SITE_URL>/api/mcp -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   # Metadatos
   curl <SITE_URL>/.well-known/oauth-protected-resource/api/mcp
   curl <SITE_URL>/.well-known/oauth-authorization-server
   ```

5. Claude Code: `claude mcp add --transport http tesoro <SITE_URL>/api/mcp` y
   luego `/mcp` para iniciar sesión.

## Agregar una tool

1. Crea el archivo en `src/features/mcp/tools/read/` o `tools/write/` con
   `defineTool({ name, group, title, description, input, annotations, run })`:
   - `name` en `snake_case` inglés; título, descripción y errores en español;
   - `input` es un `z.object`: el SDK lo convierte en el JSON Schema de la tool
     y valida la entrada antes de llamar `run`;
   - lecturas con `readOnlyHint: true`; borrados y revertir con
     `destructiveHint: true`;
   - una tool de un espacio recibe `workspace_id` y lo resuelve con
     `resolveWorkspace(ctx, id)` (o `{ writable: true }` para escribir);
   - responde con `toolResult(resumen, datos)` o `toolError(mensaje)`; los
     montos llevan `currency: ctx.currency`.
2. Agrégala a `MCP_TOOLS` en `catalog.ts`. El servidor la registra y la
   página `/mcp` la muestra sin más cambios.
3. Si escribe:
   - usa (o extrae) un servicio que también use la action de la UI;
   - valida todas las filas antes de escribir y responde los errores con
     `batchError` (`tools/write/batch.ts`);
   - acepta `dry_run`;
   - registra cada fila tocada en `changes` y cierra con `commitOperation`; si
     falla a mitad, `compensateOperation`;
   - si toca una tabla nueva, agrégala a `SNAPSHOT_TABLES` y al `check` de
     `mcp_operation_rows.table_name` en una migración.

## Si la API de Supabase OAuth cambia

El servidor OAuth de Supabase está en beta. Todo su uso vive en:

- `app/oauth/consent/page.tsx` y `src/features/mcp/actions.ts`
  (`getAuthorizationDetails`, `approveAuthorization`, `denyAuthorization`,
  `listGrants` en `queries.ts` y `revokeGrant`);
- `src/features/mcp/auth.ts` (claim `client_id`);
- `src/features/mcp/discovery.ts` (ruta del metadato
  `/.well-known/oauth-authorization-server/auth/v1`).

Configuración: dashboard de Supabase → Authentication → OAuth Server (activo,
ruta `/oauth/consent`, registro dinámico) y `[auth.oauth_server]` en
`supabase/config.toml`.
