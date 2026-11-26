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

- **App:** Preview de Vercel de la rama que se mide, contra la Supabase
  remota (producción). En local no existe la latencia de red entre la
  función y la base de datos, que es justo la que se quiere bajar.
- **Cuenta de pruebas:** una cuenta creada solo para medir. Sus
  credenciales viven en `.env.local` (`PERF_EMAIL`, `PERF_PASSWORD`), nunca
  en el repo.
- **Datos:** `node scripts/generate-perf-csv.mjs` genera
  `tmp/perf-movimientos.csv` (git-ignorado): unos 1.950 movimientos en 12
  meses, con categorías, métodos y montos genéricos y semilla fija. Se carga
  con el asistente de Importar en el espacio Personal de la cuenta de
  pruebas.

### Qué se mide

| Medida              | Herramienta                                                                         | Rutas                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Lighthouse móvil    | DevTools, sesión iniciada: Performance, LCP, TBT, CLS y TTFB                        | `/`, `/dashboard/personal`, `/dashboard/personal/transactions`, `/dashboard/personal/reports` |
| Duración de función | Observabilidad de Vercel (runtime logs): mediana de 5 cargas, sin contar la primera | Las mismas tres del dashboard                                                                 |
| JS por ruta         | Salida de `next build`                                                              | Todas                                                                                         |
| Planes de consulta  | `EXPLAIN (ANALYZE, BUFFERS)` con RLS activo (ver abajo)                             | Las consultas más pesadas                                                                     |
| Exportar            | Tiempo de respuesta de `/api/export/[workspaceId]`, mes actual                      | PDF y XLSX                                                                                    |

La primera carga de cada ruta se descarta porque incluye el arranque en
frío de la función. Las dos fotos ("Antes" y "Después") usan la misma cuenta
y los mismos datos.

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

Medido sobre `master` (v0.3.1).

### Lighthouse móvil

| Ruta                               | Performance | LCP | TBT | CLS | TTFB |
| ---------------------------------- | ----------- | --- | --- | --- | ---- |
| `/`                                |             |     |     |     |      |
| `/dashboard/personal`              |             |     |     |     |      |
| `/dashboard/personal/transactions` |             |     |     |     |      |
| `/dashboard/personal/reports`      |             |     |     |     |      |

### Duración de función (mediana de 5)

| Ruta                               | Duración |
| ---------------------------------- | -------- |
| `/dashboard/personal`              |          |
| `/dashboard/personal/transactions` |          |
| `/dashboard/personal/reports`      |          |

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

_Pendiente._

### Exportar (mes actual)

| Formato | Tiempo |
| ------- | ------ |
| PDF     |        |
| XLSX    |        |

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
