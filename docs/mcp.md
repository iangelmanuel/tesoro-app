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
  fila, se crea una con `read`. Con `read`, las tools de grupo `write`,
  `manage` y `undo` se registran deshabilitadas (fuera de `tools/list`) y la
  ruta responde el error de solo lectura si se llaman.
- **Escrituras.** Usan los servicios que comparten las Server Actions
  (`transactions/service.ts`, con sus mensajes en
  `transactions/transaction-errors.ts`, `accounts/transfer-service.ts`,
  `debts/entry-payment-service.ts` (pagos y abonos), `debts/entry-service.ts`
  (editar, borrar y mover movimientos), `debts/receivable-service.ts`,
  `goals/contribution-service.ts`,
  `categories/service.ts` y los de crear y editar entidades de SPEC 44) y
  los mismos prellenados del diálogo de movimiento
  (`recurring-expenses/payment.ts`, `recurring-incomes/receipt.ts`), nunca tablas o RPC directo. Todo o nada:
  se valida todo antes de escribir. La excepción es `import_statement`, que
  inserta las filas ya validadas en bloque (un insert por tabla).
- **Datos faltantes.** Si falta un dato obligatorio o es ambiguo, la tool no
  escribe y responde `status: "needs_input"` (ver abajo).
- **Log y revertir.** `operations.ts` guarda cada escritura en
  `mcp_operations` y `mcp_operation_rows` (snapshot antes y después). La RPC
  `undo_mcp_operation` restaura en una transacción y aborta si una fila
  cambió después. Si una escritura falla a mitad, se guarda como `failed` y se
  compensa con la misma RPC.

## Extractos, pagos y datos faltantes

[SPEC 43](../specs/43-mcp-statements-payments-and-analysis.md) suma estas
tools:

| Tool                       | Qué hace                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `import_statement`         | Pone al día una cuenta con hasta 400 filas de un extracto      |
| `record_debt_payment`      | Pago o abono extra a una tarjeta o un préstamo                 |
| `collect_receivable`       | Cobro de Me deben, único o mensual (reparto de SPEC 39)        |
| `update_debt_entry`        | Edita un movimiento de una deuda (reglas de SPEC 42)           |
| `delete_debt_entry`        | Borra un movimiento de una deuda                               |
| `pay_recurring_expense`    | Paga la ocurrencia más antigua sin pagar de un gasto fijo      |
| `receive_recurring_income` | Recibe un ingreso fijo (reparto de SPEC 38)                    |
| `record_goal_contribution` | Aporte (`in`) o retiro (`out`) de una meta                     |
| `get_account_balance`      | Saldo de una cuenta a una fecha y diferencia para conciliar    |
| `get_spending_breakdown`   | Totales por categoría y contraparte contra el periodo anterior |
| `list_upcoming_payments`   | Lo que vence en los próximos N días y lo vencido, aparte       |
| `get_recommendations`      | Recomendaciones activas y desglose del score por factor        |

Las de pagos, fijos y metas son solo de Personal. Todas las escrituras
dejan su log y se revierten con `undo_operation`.

### `needs_input`

Lo devuelven las tools de escritura (y `get_account_balance`) cuando falta
un dato obligatorio o es ambiguo: no se guarda nada y cada campo trae la
pregunta para el usuario y sus opciones.

```json
{
  "status": "needs_input",
  "missing": [
    {
      "field": "account_id",
      "row": 0,
      "question": "¿Cuál es la cuenta?",
      "options": [
        { "id": "…", "label": "Efectivo" },
        { "id": "…", "label": "Nequi" }
      ]
    }
  ]
}
```

- Cuenta y categoría van por id o por nombre (`account`, `category`). Un
  nombre que coincide con varias, o con ninguna, se pregunta.
- Sin cuenta: con una sola cuenta activa se usa esa; con varias se pregunta.
  En pagos y fijos primero se usa la cuenta por defecto (SPEC 41).
- Las piezas viven en `tools/shared.ts` (`needsInput`, `NEEDS_INPUT_HINT`) y
  `tools/write/references.ts` (`resolveAccount`, `resolveCategory`).

### Extracto bancario

El agente lee el extracto (PDF, imagen o CSV) y envía filas: monto negativo
sale de la cuenta, positivo entra; `transfer_account_id` lo vuelve traspaso
con otra cuenta propia.

1. Vista previa (`dry_run` es `true` por defecto):

   ```json
   {
     "workspace_id": "…",
     "account": "Bancolombia",
     "statement_balance": 1250000,
     "statement_end_date": "2026-11-30",
     "rows": [
       { "date": "2026-11-11", "description": "UBER *TRIP", "amount": -45000 },
       { "date": "2026-11-15", "description": "Nómina", "amount": 3200000 }
     ]
   }
   ```

   Responde `ready`, `duplicates` (misma cuenta, tipo y monto a ±2 días,
   contra lo registrado o contra otra fila anterior del extracto),
   `needsInput`, `suggestions` (categoría del último movimiento con la misma
   descripción en 180 días) y `reconciliation` (saldo antes y después contra
   el extracto).

2. Con `dry_run: false` crea todo en una sola operación. Los duplicados se
   omiten salvo los índices de `include_rows`; una fila sin categoría usa la
   sugerida.

El análisis vive en `tools/write/statement.ts`.

### Pagar una deuda

```json
{ "workspace_id": "…", "debt_id": "…", "amount": 350000 }
```

Fecha de hoy, cuenta por defecto de la deuda y descripción "Pago {deuda} ·
{mes}". Las tools de deuda guardan en el log la deuda, el abono, sus
movimientos y sus asignaciones (`tools/write/debt-snapshots.ts`), en el
orden que necesita `undo_mcp_operation`. Las asignaciones de cobros mensuales
e ingresos fijos se restauran al final, por abono o por movimiento
(migración `mcp_more_operation_tables`).

## Crear y editar entidades

[SPEC 44](../specs/44-mcp-create-and-edit-entities.md) suma una tool por
entidad y acción (grupo `manage`, "Crear y editar" en `/mcp`):

| Tool                                                    | Entidad                                | Espacio            |
| ------------------------------------------------------- | -------------------------------------- | ------------------ |
| `create_account` / `update_account`                     | Cuentas                                | Personal y Empresa |
| `create_debt` / `update_debt`                           | Tarjetas y préstamos                   | Personal           |
| `create_receivable` / `update_receivable`               | Me deben (único o mensual)             | Personal           |
| `create_recurring_expense` / `update_recurring_expense` | Gastos fijos                           | Personal           |
| `create_recurring_income` / `update_recurring_income`   | Ingresos fijos (SPEC 38)               | Personal           |
| `create_goal` / `update_goal`                           | Metas de ahorro                        | Personal           |
| `set_budget`                                            | Presupuesto de una categoría en un mes | Personal           |

- **Mismas reglas que la UI.** Cada tool valida con el esquema Zod de su
  feature y escribe con el servicio que usa la action:
  `accounts/service.ts`, `debts/service.ts`,
  `recurring-expenses/service.ts`, `recurring-incomes/service.ts`,
  `goals/service.ts` y `budgets/service.ts`. Cada servicio devuelve `before`
  y `after` para el log.
- **Editar** solo cambia los campos enviados: la tool mezcla lo guardado con
  lo enviado y valida la entidad completa. El tipo de una deuda y el tipo de
  cobro de Me deben no cambian.
- **`needs_input`** cuando falta un dato obligatorio, cuando un campo no
  aplica al tipo (`closing_day` en un préstamo) o cuando un nombre de cuenta,
  categoría o entidad es ambiguo. Cada frecuencia de un ingreso fijo pide sus
  días.
- **Duplicados.** Crear con el nombre (sin mayúsculas ni tildes) de otra
  entidad activa del mismo tipo responde `needs_input` en
  `confirm_duplicate`. Con `confirm_duplicate: true` se crea igual. En
  cuentas el índice único `accounts_unique_name` no lo permite.
- **Empresa.** Solo cuentas. Las demás entidades existen solo en Personal y
  responden `PERSONAL_ONLY`.
- **Revertir.** Cada create y update deja su fila en el log. Revertir un
  create borra la entidad solo si nada la referencia. Si ya tiene
  movimientos, traspasos, abonos, aportes, ajustes o fijos que la usan como
  cuenta por defecto, `undo_mcp_operation` falla con el motivo y no borra nada
  (`mcp_row_references` revisa las llaves foráneas). La operación sigue
  `applied` y se puede revertir después. Revertir un update restaura solo los
  campos de la entidad: los pagos no se tocan.

Piezas comunes en `tools/write/entities.ts`: `parsePatch`, `resolveEntity`,
`duplicateName`, `habitualAccount`, `entityCategory` y `commitEntity`.

### Crear un gasto fijo

```json
{
  "workspace_id": "…",
  "name": "Netflix",
  "amount": 44900,
  "category": "Suscripciones",
  "day_of_month": 5
}
```

Mensual por defecto, desde hoy. Si ya hay un "netflix" activo:

```json
{
  "status": "needs_input",
  "missing": [
    {
      "field": "confirm_duplicate",
      "question": "Ya existe un gasto fijo activo con ese nombre: \"Netflix\". ¿Es otro distinto? …",
      "options": [{ "id": "…", "label": "Netflix" }]
    }
  ]
}
```

### Editar una meta

```json
{ "workspace_id": "…", "goal": "Viaje", "target_amount": 6000000 }
```

Cambia el objetivo; el nombre y la fecha quedan igual.

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
   - si falta un dato obligatorio o es ambiguo, responde `needsInput` y
     agrega `NEEDS_INPUT_HINT` a la descripción;
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
