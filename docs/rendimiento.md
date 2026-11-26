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

Medido el 2026-11-26 en el Preview de la rama `spec-56a` (`iad1`), con las
tres migraciones ya en producción. Al Preview se entra con un enlace
compartido de Vercel (`_vercel_share`, 23 h) en vez del secreto de bypass.

### Duración de función

La primera corrida en el Preview (6 cargas) salió con mucha variación entre
rutas, así que se repitió con 11 cargas por ruta (mediana de las últimas
10), dos veces, alternando con producción. Como control se midió también
producción en ese momento: código de `master` sobre la base ya migrada,
lo que aísla el efecto del código de la rama.

| Ruta                               | Antes (master) | Control (master + base nueva) | Después (rama) | Diferencia |
| ---------------------------------- | -------------- | ----------------------------- | -------------- | ---------- |
| `/`                                | 266 ms         | 255 ms                        | 210 ms         | −21 %      |
| `/dashboard/personal`              | 739 ms         | 573 ms                        | 517 ms         | −30 %      |
| `/dashboard/personal/transactions` | 514 ms         | 522 ms                        | 456 ms         | −11 %      |
| `/dashboard/personal/reports`      | 486 ms         | 471 ms                        | 425 ms         | −13 %      |

"Documento" (HTML completo con el streaming). Control y Después son el
promedio de las dos corridas de 11 cargas. La primera corrida del Preview
(6 cargas) dio 261, 661, 591 y 473 ms: la variación entre corridas es de
±60 ms, del orden de la mejora en `/transactions`.

El TTFB (shell de Partial Prerendering) no cambia: 87–94 ms en todas las
rutas, antes y después.

### Lighthouse móvil

| Ruta                               | Performance | LCP   | TBT      | CLS   | TTFB  |
| ---------------------------------- | ----------- | ----- | -------- | ----- | ----- |
| `/`                                | 66 (67)     | 3,4 s | 1.601 ms | 0,000 | 89 ms |
| `/dashboard/personal`              | 50 (53)     | 5,3 s | 1.774 ms | 0,000 | 89 ms |
| `/dashboard/personal/transactions` | 56 (63)     | 4,6 s | 1.390 ms | 0,000 | 87 ms |
| `/dashboard/personal/reports`      | 50 (52)     | 5,1 s | 1.414 ms | 0,002 | 87 ms |

Entre paréntesis, el Performance de "Antes". 56a no toca el cliente: el
puntaje lo dominan el TBT y el LCP del JS (56b), que en el perfil móvil
simulado de Lighthouse varían varios cientos de ms entre corridas. El TTFB
no cambia.

### JS por ruta

Idéntico a "Antes" en las 10 rutas medidas (mismo número de chunks y mismos
kB): 56a no cambia el código del cliente. `pnpm build` de la rama termina sin
errores.

### Planes de consulta

Mismas consultas y misma cuenta que en "Antes". En las tres, el conjunto de
espacios es un `InitPlan` que entra en la condición del índice:

```text
Index Scan using transactions_workspace_date on transactions t
  Index Cond: ((workspace_id = '<espacio>') AND (workspace_id = ANY ((InitPlan 1).col1)))
InitPlan 1
  ->  ProjectSet (rows=1)
```

| Consulta                                   | Antes                    | Después               |
| ------------------------------------------ | ------------------------ | --------------------- |
| Total de la lista (`count`)                | 39,97 ms · 4.107 buffers | 5,60 ms · 210 buffers |
| Movimientos de 12 meses (reportes)         | 37,55 ms · 4.053 buffers | 1,85 ms · 347 buffers |
| Página de 50 de la lista (EXPLAIN en frío) | 2,55 ms · 314 buffers    | 6,78 ms · 224 buffers |
| Página de 50 de la lista (20 corridas)     | —                        | mediana 0,65 ms       |

Los buffers son la medida estable: el tiempo de un EXPLAIN suelto en la base
compartida varía mucho (una corrida dio 51 ms, 128 ms de ellos planeando).
La página de 50 lee pocas filas, así que gana poco; el ahorro está en las
lecturas que recorren todo el espacio (totales, reportes, score), que dejan
de hacer una subconsulta a `workspaces` por fila.

### Exportar

Sigue respondiendo 500 en el Preview y en producción (`jsdom`,
`ERR_REQUIRE_ESM`, ver "Antes"): no hay tiempos que comparar.

### Advisors de Supabase

- **Performance:** sin `unindexed_foreign_keys` (antes 18) ni
  `auth_rls_initplan`. Quedan 19 `unused_index`: los índices nuevos, todavía
  sin estadísticas de uso.
- **Security:** los mismos tres avisos de la línea base, sin avisos nuevos.

## Lo aplicado

- **Sesión:** `getSessionUser` (`src/features/account/session.ts`) es la
  única lectura de sesión del camino de lectura del dashboard; el proxy usa
  `getClaims()` (JWKS) en vez de `getUser()`.
- **RLS:** funciones de conjunto `owned_workspace_ids()` y
  `writable_workspace_ids()`, y 67 políticas reescritas a
  `workspace_id = any (array(select …))`. El acceso lo fija
  `supabase/tests/rls_workspace_access.test.sql`.
- **Índices:** `workspaces (owner_id, type)` y los 18 de llaves foráneas.
- **Consultas:** columnas explícitas en las lecturas; movimientos de deudas
  y aportes de metas en una sola consulta; pagos próximos, recomendaciones y
  la tarjeta de Salud financiera piden en paralelo lo que no depende entre
  sí.

Queda para 56b: el JS del cliente, que domina el TBT y el LCP del dashboard.
Queda abierto: el score de Empresa llama a `category_totals` una vez por mes
(~18 llamadas); es candidato a una RPC si la medición de Empresa lo pide.

## Cliente (SPEC 56b)

### Método

Además de las medidas de arriba (JS por ruta con el mismo método y
Lighthouse móvil):

- **Bundle Analyzer de Turbopack.** `pnpm next analyze --output --snapshot <nombre>`
  y luego `pnpm next analyze export --snapshot <nombre> --route <ruta>`
  (JSON Lines). Se suman los módulos de los chunks JS del cliente que no
  son `async` (grupos `bootstrap` y `render_dependent`), agrupados por
  paquete de `node_modules` (o por archivo si es código propio). El CSS no
  cuenta. `next` incluye `react` y `react-dom`, que Next trae compilados. En
  Git Bash, `MSYS_NO_PATHCONV=1` evita que `--route /dashboard/...` se
  convierta en una ruta de Windows.
- **React DevTools Profiler.** Build de producción con perfilado
  (`pnpm next build --profile` + `pnpm start`), sesión de la cuenta de
  pruebas. Tres interacciones: escribir "mercado" en el buscador de
  Movimientos, cambiar de mes en Reportes y abrir el diálogo de movimiento
  desde el header. Se anota el commit más largo y cuántos componentes
  renderiza.
- **Clic a skeleton.** Performance panel de Chrome, desde el aside de
  Personal hacia otra ruta: tiempo desde el evento `click` hasta el primer
  frame que pinta el `loading.tsx`. Cinco clics, mediana.

### Antes

Medido el 2026-11-26 sobre `master` (con SPEC 56a fusionado).

**JS por ruta.** El de "Después" de 56a: `/dashboard/personal` 2.003 kB
(635 kB gzip), `/dashboard/personal/transactions` 1.658 kB (533 kB) y
`/dashboard/personal/reports` 1.986 kB (629 kB). La meta de 56b es bajar
el de `/dashboard/personal` al menos un 20 %: 1.602 kB o menos.

**Analyzer: los 10 paquetes más pesados del JS inicial**

`/dashboard/personal` (32 chunks, 1.895 kB, 803 kB comprimido):

| Paquete            | Tamaño   | Comprimido |
| ------------------ | -------- | ---------- |
| `next`             | 444,8 kB | 167,8 kB   |
| `@base-ui/react`   | 274,0 kB | 135,0 kB   |
| `recharts`         | 273,3 kB | 123,2 kB   |
| `zod`              | 105,8 kB | 33,7 kB    |
| `@dnd-kit/dom`     | 70,6 kB  | 25,2 kB    |
| `react-day-picker` | 42,7 kB  | 19,4 kB    |
| `sonner`           | 34,3 kB  | 9,2 kB     |
| `lucide-react`     | 29,3 kB  | 18,4 kB    |
| `date-fns`         | 28,4 kB  | 12,6 kB    |
| `tailwind-merge`   | 26,7 kB  | 8,2 kB     |

`/dashboard/personal/transactions` (30 chunks, 1.549 kB, 646 kB
comprimido): los mismos sin `recharts`. `@base-ui/react` sube a 282,9 kB
y entra `@dnd-kit/abstract` (19,8 kB) en el décimo puesto.

`/dashboard/personal/reports` (32 chunks, 1.904 kB, 807 kB comprimido):
igual que `/dashboard/personal` (`recharts` 273,5 kB).

Los cuatro paquetes que 56b quiere sacar del chunk inicial están en las
tres rutas, también en las que no los usan al entrar:

| Paquete            | `/personal` | `/transactions` | `/reports` |
| ------------------ | ----------- | --------------- | ---------- |
| `recharts`         | 273,3 kB    | —               | 273,5 kB   |
| `@dnd-kit/*`       | 111,2 kB    | 111,2 kB        | 111,2 kB   |
| `react-day-picker` | 42,7 kB     | 42,7 kB         | 42,7 kB    |
| `cmdk`             | 11,4 kB     | 11,4 kB         | 11,4 kB    |

**Profiler**

| Interacción                    | Commit más largo | Componentes |
| ------------------------------ | ---------------- | ----------- |
| Buscar en Movimientos          | _por medir_      | _por medir_ |
| Cambiar de mes en Reportes     | _por medir_      | _por medir_ |
| Abrir el diálogo de movimiento | _por medir_      | _por medir_ |

**Clic a skeleton** (mediana de 5): _por medir_.
