# Rendimiento

Cómo se mide el rendimiento de Tesoro, qué dio cada medición y qué se
aplicó para mejorarlo. Nace de la serie SPEC 56:
[56a](../specs/56a-performance-baseline-database-and-server.md) (línea base,
base de datos y servidor),
[56b](../specs/56b-performance-client-bundle-and-dashboard.md) (bundle del
cliente y dashboard) y
[56c](../specs/56c-performance-landing-public-pages-and-field-metrics.md)
(landing y páginas públicas).

La arquitectura está en [`arquitectura.md`](arquitectura.md). Los comandos,
en [`CLAUDE.md`](../CLAUDE.md).

## Método

### Entorno

- **App:** Vercel contra la Supabase remota (producción). En local no
  existe la latencia de red entre la función y la base de datos, que es
  justo la que se quiere bajar. "Antes" se mide en el dominio de
  producción, que sirve `master` en la misma región. Los Preview tienen
  Vercel Authentication, así que "Después" se mide en el Preview de la rama
  con el secreto de _Protection Bypass for Automation_
  (`VERCEL_AUTOMATION_BYPASS_SECRET` en `.env.local`).
- **Cuenta de pruebas:** una cuenta con un email ficticio, creada solo para
  medir con el registro normal (`signUp` con la clave publicable, sin
  `service_role`). Sus credenciales viven en `.env.local` (`PERF_EMAIL`,
  `PERF_PASSWORD`, `PERF_USER_ID`, `PERF_WORKSPACE_ID`), nunca en el repo.
- **Datos:** `node scripts/generate-perf-csv.mjs` genera
  `tmp/perf-movimientos.csv` (git-ignorado): 1.956 movimientos en 12
  meses, con categorías, métodos y montos genéricos y semilla fija. Se
  cargan en el espacio Personal de la cuenta de pruebas con la RPC del
  asistente de Importar (`import_transactions`), con la sesión de esa
  cuenta.

### Qué se mide

| Medida              | Herramienta                                                               | Rutas                                                                                         |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Lighthouse móvil    | CLI 12.8.2, sesión iniciada: mediana de 3 corridas (ver abajo)            | `/`, `/dashboard/personal`, `/dashboard/personal/transactions`, `/dashboard/personal/reports` |
| Duración de función | Script de Playwright con sesión iniciada: mediana de 5 cargas (ver abajo) | Las mismas tres del dashboard                                                                 |
| JS por ruta         | Salida de `next build`                                                    | Todas                                                                                         |
| Planes de consulta  | `EXPLAIN (ANALYZE, BUFFERS)` con RLS activo (ver abajo)                   | Las consultas más pesadas                                                                     |
| Exportar            | Tiempo de respuesta de `/api/export/[workspaceId]`, mes actual            | PDF y XLSX                                                                                    |

La primera carga de cada ruta se descarta porque incluye el arranque en
frío de la función. Las dos fotos ("Antes" y "Después") usan la misma cuenta
y los mismos datos.

### Lighthouse

Lighthouse 12.8.2 por CLI (perfil móvil por defecto, `--only-categories=performance`)
con el Chromium de Playwright en modo headless. Un script de Playwright
inicia sesión con la cuenta de pruebas y pasa su cookie de sesión con
`--extra-headers`. Tres corridas por ruta; cada métrica es la mediana. TTFB
es la auditoría `server-response-time`.

### Duración de función

El plan Hobby de Vercel guarda los runtime logs una hora y sin la duración
de cada invocación, así que la duración se mide desde el navegador. Un
script local de Playwright (fuera del repo) inicia sesión con la cuenta de
pruebas, carga cada ruta 6 veces y saca la mediana de las últimas 5 con la
Navigation Timing API:

- **TTFB** (`responseStart − requestStart`): con Partial Prerendering es el
  shell estático, que sale casi sin pasar por la base de datos.
- **Documento** (`responseEnd − requestStart`): el HTML completo, incluido el
  contenido dinámico que la función manda en streaming. Es la medida que se
  usa como "duración de función".

El export se mide igual: tiempo total de la descarga
(`/api/export/[workspaceId]?format=pdf|xlsx`, mes actual), mediana de 5.

### EXPLAIN con RLS en la base remota

Desde el SQL Editor de Supabase (o su MCP), siempre dentro de una
transacción que se deshace, para que la consulta pase por las políticas
como lo haría la app:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<id de la cuenta de pruebas>","role":"authenticated"}';
explain (analyze, buffers)
select ...;
rollback;
```

Los planes se copian aquí sin ids reales.

### Regiones

| Servicio             | Región                               |
| -------------------- | ------------------------------------ |
| Funciones de Vercel  | `iad1` (Washington D. C., us-east-1) |
| Proyecto de Supabase | `us-east-2` (Ohio)                   |

No coinciden: cada consulta cruza de us-east-1 a us-east-2. **Propuesta:**
mover las funciones a `cle1` (Cleveland, la región de Vercel junto a
us-east-2) desde _Project Settings → Functions → Function Region_. El cambio
lo confirma el dueño del proyecto; si se aplica, se mide antes y después
por separado para no mezclar su efecto con el de SPEC 56a.

## Línea base ("Antes")

Medido el 2026-11-26 sobre `master` (v0.3.1), en producción (`iad1`).

### Lighthouse móvil

| Ruta                               | Performance | LCP   | TBT      | CLS   | TTFB  |
| ---------------------------------- | ----------- | ----- | -------- | ----- | ----- |
| `/`                                | 67          | 3,4 s | 1.217 ms | 0,000 | 87 ms |
| `/dashboard/personal`              | 53          | 4,8 s | 1.683 ms | 0,000 | 91 ms |
| `/dashboard/personal/transactions` | 63          | 4,2 s | 915 ms   | 0,000 | 89 ms |
| `/dashboard/personal/reports`      | 52          | 4,8 s | 1.871 ms | 0,000 | 89 ms |

El TTFB es parejo (~90 ms) porque con Partial Prerendering el shell
estático sale de la caché de Vercel; el tiempo de servidor que importa está
en la columna "Documento" de abajo. El TBT alto es del JS del cliente
(56b).

### Duración de función (mediana de 5)

| Ruta                               | TTFB  | Documento |
| ---------------------------------- | ----- | --------- |
| `/`                                | 89 ms | 266 ms    |
| `/dashboard/personal`              | 89 ms | 739 ms    |
| `/dashboard/personal/transactions` | 88 ms | 514 ms    |
| `/dashboard/personal/reports`      | 88 ms | 486 ms    |

### JS por ruta (`next build`)

Next 16 ya no imprime el tamaño por ruta en `next build`. Se mide el JS
inicial: la suma de los chunks `/_next/static/**.js` que referencia el HTML
prerenderado de cada ruta (`.next/server/app/<ruta>.html`), en bruto y
comprimido con gzip.

| Ruta                               | Chunks | JS       | gzip   |
| ---------------------------------- | ------ | -------- | ------ |
| `/`                                | 18     | 960 kB   | 311 kB |
| `/sign-in`                         | 14     | 765 kB   | 245 kB |
| `/mcp`                             | 17     | 829 kB   | 267 kB |
| `/dashboard/personal`              | 32     | 2.003 kB | 635 kB |
| `/dashboard/personal/transactions` | 30     | 1.658 kB | 533 kB |
| `/dashboard/personal/reports`      | 31     | 1.986 kB | 629 kB |
| `/dashboard/personal/budgets`      | 30     | 1.621 kB | 522 kB |
| `/dashboard/personal/debts`        | 32     | 1.705 kB | 550 kB |
| `/dashboard/personal/accounts`     | 30     | 1.626 kB | 524 kB |
| `/dashboard/business`              | 29     | 1.572 kB | 506 kB |

### Planes de consulta

Con RLS activo, como la cuenta de pruebas (1.956 movimientos).

**Lista de movimientos** (`getTransactions`: vista `ledger_entries`, página
de 50, más el `count: "exact"`). Cada rama de la vista filtra con
`is_workspace_owner(workspace_id)` **por fila**:

```text
Limit (actual time=2.061..2.309 rows=50)
  ->  Incremental Sort
        ->  Merge Append
              ->  Index Scan using transactions_workspace_date on transactions t
                    Index Cond: (workspace_id = '<espacio>')
                    Filter: is_workspace_owner(workspace_id)
              ->  Index Scan using transfers_workspace_date on transfers tr
                    Filter: is_workspace_owner(workspace_id)
              ->  Seq Scan on account_adjustments a
                    Filter: ((workspace_id = '<espacio>') AND is_workspace_owner(workspace_id))
              ->  Index Scan using debt_entries_account on debt_entries e
                    Filter: ((workspace_id = '<espacio>') AND is_workspace_owner(workspace_id))
                    ->  Index Scan using debts_id_workspace_id_key on debts d
                          Filter: is_workspace_owner(workspace_id)
              ->  Seq Scan on goal_contributions c
                    Filter: (... AND is_workspace_owner(workspace_id))
                    ->  Index Scan using savings_goals_id_workspace_id_key on savings_goals g
                          Filter: is_workspace_owner(workspace_id)
Execution Time: 2.552 ms
```

**Total de la lista** (`count(*)` de `ledger_entries` del espacio):

```text
Aggregate (actual time=39.666..39.668 rows=1)
  Buffers: shared hit=4107
  ->  Append (rows=1956)
        ->  Index Only Scan using transactions_workspace_date on transactions t
              Filter: is_workspace_owner(workspace_id)
              Buffers: shared hit=4102
        ...
Execution Time: 39.967 ms
```

**Movimientos de 12 meses** (reportes: `type, amount, occurred_on,
category_id` del espacio en el rango):

```text
Index Scan using transactions_workspace_date on transactions
  (actual time=0.260..37.331 rows=1956)
  Index Cond: ((workspace_id = '<espacio>') AND (occurred_on >= ...) AND (occurred_on <= ...))
  Filter: is_workspace_owner(workspace_id)
  Buffers: shared hit=4053
Execution Time: 37.548 ms
```

En las dos lecturas grandes, ~2 buffers por fila salen de la subconsulta a
`workspaces` que hace `is_workspace_owner` en cada fila: unos 38 ms para
1.956 filas.

### Exportar (mes actual)

| Formato | Tiempo    |
| ------- | --------- |
| PDF     | Error 500 |
| XLSX    | Error 500 |

El export está caído en producción antes de 56a, en todos los formatos:
la ruta carga el módulo del PDF al arrancar y `jsdom` falla con
`ERR_REQUIRE_ESM` (`html-encoding-sniffer` hace `require()` de
`@exodus/bytes/encoding-lite.js`, que es ESM). Se corrige aparte; 56a no
puede comparar tiempos de export hasta entonces.

### Advisors de Supabase

**Performance:**

- `unindexed_foreign_keys` (18): `account_adjustments`, `budgets`,
  `debt_entries` (2), `debt_entry_allocations`, `debts`,
  `goal_contributions` (2), `mcp_operations`,
  `receivable_installment_history`, `recurring_expenses` (2),
  `recurring_income_allocations`, `recurring_incomes` (2), `transactions`
  y `transfers` (2).
- `unused_index` (3): `goal_contributions_account`,
  `recurring_expenses_account_id_idx` y `debts_account_id_idx`. Son
  índices simples sobre `account_id`; las llaves foráneas compuestas
  `(account_id, workspace_id)` siguen sin índice que las cubra.
- Sin `auth_rls_initplan`.

**Security:**

- `rls_enabled_no_policy` (1): `mcp_rate_limits`, a propósito: sin grants
  para `anon` ni `authenticated`, solo la toca `mcp_hit_rate_limit`.
- `authenticated_security_definer_function_executable` (11): las RPC de
  importar, deshacer importación, pedir y cancelar borrado (cuenta y
  empresa), `has_password` y `mcp_hit_rate_limit`. Son RPC del producto que
  ya existían; quedan como línea base (56a no agrega ninguna así).
- `auth_leaked_password_protection` (1): protección de contraseñas
  filtradas apagada.

## Después

_Pendiente (paso 11 de SPEC 56a)._

## Lo aplicado

_Pendiente._
