# Rendimiento

Cómo se mide el rendimiento de Tesoro, qué dio cada medición y qué se
aplicó para mejorarlo. Nace de la serie SPEC 56:
[56a](../specs/56a-performance-baseline-database-and-server.md) (línea base,
base de datos y servidor),
[56b](../specs/56b-performance-client-bundle-and-dashboard.md) (bundle del
cliente y dashboard) y
[56c](../specs/56c-performance-landing-public-pages-and-field-metrics.md)
(landing y páginas públicas). Sigue en
[SPEC 57](../specs/57-performance-dashboard-render-and-hydration.md)
(render e hidratación del dashboard).

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

### Después

Build local de la rama `spec-56b` (2026-11-26). JS por ruta y analyzer se
miden igual que en "Antes"; `master` reconstruido con el mismo script da
exactamente las cifras de 56a, así que la comparación es directa.
Lighthouse, Profiler y clic a skeleton se miden en el Preview de la rama.

**JS por ruta** (`next build`, chunks del HTML prerenderado)

| Ruta                               | Chunks  | JS               | gzip         | Diferencia |
| ---------------------------------- | ------- | ---------------- | ------------ | ---------- |
| `/`                                | 18      | 967 kB (960)     | 315 kB (311) | +1 %       |
| `/sign-in`                         | 16 (14) | 771 kB (765)     | 249 kB (245) | +1 %       |
| `/mcp`                             | 17      | 836 kB (829)     | 270 kB (267) | +1 %       |
| `/dashboard/personal`              | 28 (32) | 1.314 kB (2.003) | 429 kB (635) | −34 %      |
| `/dashboard/personal/transactions` | 32 (30) | 1.460 kB (1.658) | 485 kB (533) | −12 %      |
| `/dashboard/personal/reports`      | 26 (31) | 1.253 kB (1.986) | 406 kB (629) | −37 %      |
| `/dashboard/personal/budgets`      | 29 (30) | 1.355 kB (1.621) | 445 kB (522) | −16 %      |
| `/dashboard/personal/debts`        | 33 (32) | 1.646 kB (1.705) | 545 kB (550) | −3 %       |
| `/dashboard/personal/accounts`     | 30      | 1.373 kB (1.626) | 452 kB (524) | −16 %      |
| `/dashboard/business`              | 23 (29) | 1.081 kB (1.572) | 353 kB (506) | −31 %      |

Entre paréntesis, "Antes". `/dashboard/personal` cumple la meta (1.602 kB
o menos). Las páginas públicas suben ~1 % por el React Compiler: su
memoización agrega código a cada componente y ahí no hubo nada que
diferir. En el dashboard el compilador también suma (en
`/dashboard/personal/transactions`, ~120 kB antes de diferir nada), pero
la carga diferida lo compensa de sobra. Deudas casi no baja: su Sheet de
detalle sigue entrando completo (ver "Pendiente").

**Analyzer: los 10 paquetes más pesados del JS inicial**

`/dashboard/personal` (28 chunks, 1.210 kB, 501 kB comprimido; antes
1.895 kB):

| Paquete          | Tamaño   | Comprimido |
| ---------------- | -------- | ---------- |
| `next`           | 444,8 kB | 168,0 kB   |
| `@base-ui/react` | 263,1 kB | 128,8 kB   |
| `zod`            | 106,0 kB | 33,7 kB    |
| `sonner`         | 34,3 kB  | 9,2 kB     |
| `lucide-react`   | 27,1 kB  | 17,5 kB    |
| `tailwind-merge` | 26,7 kB  | 8,2 kB     |
| `tutorials.ts`   | 15,7 kB  | 4,8 kB     |
| `@base-ui/utils` | 15,1 kB  | 8,4 kB     |
| `@floating-ui`   | 10,6 kB  | 4,0 kB     |
| `help.ts`        | 10,5 kB  | 3,9 kB     |

`/dashboard/personal/transactions` (32 chunks, 1.356 kB, 571 kB
comprimido; antes 1.549 kB) y `/dashboard/personal/reports` (30 chunks,
1.283 kB, 535 kB comprimido; antes 1.904 kB): los mismos paquetes, con
`@base-ui/react` en 273,5 kB y 269,0 kB, y `date-fns` (25,8 kB) en
Reportes.

Los cuatro paquetes diferidos ya no están en el chunk inicial de ninguna
de las tres rutas:

| Paquete            | `/personal` | `/transactions` | `/reports` |
| ------------------ | ----------- | --------------- | ---------- |
| `recharts`         | —           | —               | —          |
| `@dnd-kit/*`       | —           | —               | —          |
| `react-day-picker` | —           | —               | —          |
| `cmdk`             | —           | —               | —          |

**Lighthouse móvil** (2026-11-26, mediana de 3)

Preview de la rama (commit `0a9d8a9`, `iad1`, enlace compartido de Vercel)
y, como control, producción (`master`) en la misma ventana de tiempo,
corrida a corrida intercaladas. La CPU de la máquina que corre Lighthouse
estaba más lenta que en 56a (`benchmarkIndex` ~900 en las dos primeras
rutas y ~1.400 en Reportes, contra ~1.600 en un build local): por eso el
control importa más que las cifras sueltas.

| Ruta                               | Performance | LCP   | TBT      | CLS   | Control (`master`)        |
| ---------------------------------- | ----------- | ----- | -------- | ----- | ------------------------- |
| `/dashboard/personal`              | 45          | 4,5 s | 3.535 ms | 0,000 | 43 · 5,0 s · 6.408 ms TBT |
| `/dashboard/personal/transactions` | 46          | 4,7 s | 3.844 ms | 0,000 | 47 · 4,4 s · 5.909 ms TBT |
| `/dashboard/personal/reports`      | 49          | 5,1 s | 1.276 ms | 0,002 | 55 · 4,7 s · 1.202 ms TBT |

Con la misma CPU, el TBT baja 45 % en `/dashboard/personal` y 35 % en
Movimientos; en Reportes queda igual. El Performance no se mueve: lo
dominan el TBT que queda y el LCP, que es una cifra del Resumen que llega
en streaming. En el reporte, ~2,7 s del script son de `react-dom`
(render e hidratación del árbol del dashboard con la CPU 4× simulada), no
de descargar JS. **No se cumple** la meta de 56b (Performance ≥ 90,
LCP ≤ 2,5 s, TBT ≤ 200 ms); el CLS sí (≤ 0,002). La cuenta de pruebas
abre además el diálogo de bienvenida del tutorial al entrar.

**Profiler**

| Interacción                    | Commit más largo | Componentes |
| ------------------------------ | ---------------- | ----------- |
| Buscar en Movimientos          | _por medir_      | _por medir_ |
| Cambiar de mes en Reportes     | _por medir_      | _por medir_ |
| Abrir el diálogo de movimiento | _por medir_      | _por medir_ |

**Clic a skeleton** (mediana de 5): 66 ms (50, 61, 66, 71 y 115 ms),
desde el aside de Personal a Movimientos, Reportes, Presupuestos, Metas y
Deudas, con el prefetch ya hecho. Medido con Playwright sobre el build de
producción local: del `click` al frame que pinta el `loading.tsx`.

**Funcionales** (mismo build): ⌘K / Ctrl+K abre la paleta en la primera
pulsación, sin pasar por el botón (~400 ms con la descarga del chunk); el
asa de Movimientos se habilita en idle y dnd-kit la engancha
(`aria-roledescription="draggable"`).

**Tabla de Movimientos con 2.000 filas.** La tabla pagina de 50 en 50
(`getTransactions`), así que nunca pinta las 2.000 filas: escribir en el
buscador solo re-renderiza la barra de filtros y la tabla cambia una vez,
al llegar la página nueva. No se pagina ni se virtualiza más, salvo que el
Profiler muestre commits de más de 200 ms.

### Lo aplicado

- **React Compiler** (`reactCompiler: true`, `babel-plugin-react-compiler`
  1.0.0). Un barrido con el plugin y un logger dio 10 funciones sin
  compilar; se corrigieron 8 (dependencias de `useMemo`, `useEffectEvent`
  en vez de `eslint-disable` y dos expresiones que el compilador aún no
  baja). Quedan 2 con `try/finally` (`use-export-form.ts`,
  `file-step.tsx`), sin `"use no memo"` porque no rompen reglas.
- **Carga diferida** con `lazyWithPreload` y precarga en
  `pointerenter` / `focus`: gráficas (`…-lazy.tsx`), paleta ⌘K,
  formularios de movimiento, exportar, aporte, pago de deuda y Verificar
  movimientos, cuerpo de Categorías y calendario de `DatePickerField`.
- **`@dnd-kit` en idle** en la tabla de Movimientos, enganchado a las
  filas desde fuera para no remontarlas.
- **Prefetch:** el aside y la barra móvil ya usaban `<Link>` con el
  prefetch por defecto, y las 27 rutas del dashboard tienen shell estático
  (◐) y su `loading.tsx`, sin datos de la URL fuera de `Suspense`. La
  paleta, que navega con `router.push`, precarga sus destinos al abrir.
- **Re-renders:** los valores de contexto ya iban memoizados (o los
  memoiza el compilador) y el texto del buscador vive en la barra de
  filtros, no en la tabla.

### Pendiente

Todo lo de esta sección pasa a
[SPEC 57](../specs/57-performance-dashboard-render-and-hydration.md)
(render e hidratación del dashboard), junto con la meta de Lighthouse ≥ 90
y los dos criterios del Profiler.

- **Sheets de detalle** de Deuda, Meta, Gasto fijo e Ingreso fijo: siguen en
  el JS inicial de sus páginas (por eso `/dashboard/personal/debts` baja
  solo 3 %). Su contenido está acoplado al Sheet (estado de edición, datos
  que se piden al abrir, diálogos hermanos); diferirlo es un refactor
  propio.
- **Coste del React Compiler:** su memoización agrega ~1 % en las páginas
  públicas y ~120 kB en `/dashboard/personal/transactions` antes de
  diferir. Se revisa con las cifras de campo de 56c.

## Render e hidratación (SPEC 57)

### Método

Las medidas de 56b (Lighthouse móvil y Profiler) más dos nuevas. Los
scripts viven en `tmp/perf-57/` (git-ignorado) y usan la cuenta de pruebas
de `.env.local`:

- **Commits de React** (`measure.mjs`). Build con perfilado
  (`pnpm next build --profile` + `pnpm next start`) y un hook mínimo de
  DevTools (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) inyectado antes de los scripts
  de la página. En cada commit anota `actualDuration` de la raíz y cuenta
  los componentes que renderizaron: los que se montan o tienen la marca
  `PerformedWork`. Se saltan los subárboles que React reusó sin tocar, igual
  que el Profiler de DevTools.
  - **Profiler:** las tres interacciones de 56b, a 1440 × 900 y sin
    limitar la CPU. Se anota el commit más largo, cuántos componentes
    renderiza y el total de la interacción. El tutorial que abre la cuenta
    de pruebas se quita del DOM sin marcarlo como completado.
  - **Render en la carga** (hidratación y lo que monta después): todos los
    commits desde que se abre la ruta hasta 3 s sin commits, con la CPU a
    4× (como Lighthouse móvil) y a 412 × 823 y 1440 × 900. `networkidle`
    no sirve como fin: con la CPU a 4×, los `Suspense` siguen hidratando
    más de 8 s después.
  - **Por región:** el tiempo propio de cada componente (su
    `actualDuration` menos el de sus hijos) se suma a la región del DOM
    donde pinta: aside, header, barra inferior, diálogos y hojas, cada
    `data-tour` del `main` o "sin DOM" (proveedores y componentes que solo
    tienen efectos). Turbopack minifica los nombres también con
    `--profile`, así que se agrupa por región y no por componente.
- **Payload RSC** (`measure.mjs` y `rsc-rows.mjs`). Las cadenas de
  `self.__next_f.push([1, …])` del HTML de cada ruta, unidas: es lo que
  React serializa para hidratar (props de componentes cliente y el árbol de
  servidor). Se mide en bytes y se separa por fila del protocolo Flight.
  `self.__next_f` no sirve leído en la página, porque Next lo vacía al
  procesarlo.
- **Lighthouse** (`lighthouse.mjs`). El método de 56a/56b: base A y control
  B intercalados corrida a corrida, mediana de 3 y `benchmarkIndex` de cada
  corrida. Contra un Preview usa `VERCEL_AUTOMATION_BYPASS_SECRET`.

### Antes

Medido el 2026-11-26 sobre `master` (`de555fb`, con SPEC 56b fusionado), en
el build de producción local contra la Supabase remota. El Lighthouse del
Preview con control de producción se mide en el Paso 9, con la rama
desplegada y en la misma ventana.

**Lighthouse móvil local** (`next start` sin perfilado, mediana de 3)

| Ruta                               | Performance | LCP   | TBT      | CLS   | `benchmarkIndex`  |
| ---------------------------------- | ----------- | ----- | -------- | ----- | ----------------- |
| `/dashboard/personal`              | 44          | 5,1 s | 3.270 ms | 0,000 | 1.054, 873, 930   |
| `/dashboard/personal/transactions` | 47          | 5,1 s | 3.120 ms | 0,000 | 834, 750, 905     |
| `/dashboard/personal/reports`      | 42          | 6,5 s | 4.245 ms | 0,002 | 669, 1.431, 1.009 |

La CPU de la máquina estuvo por debajo del mínimo del criterio (1.200) en
8 de 9 corridas, y el servidor corre en la misma máquina. Sirve como
referencia del orden de magnitud, no para cerrar el criterio. El LCP de
Reportes es el `dd` del balance del periodo. El 93 % de su tiempo es
"Render Delay" (6,1 s, con 490 ms de TTFB): el HTML ya llegó y el hilo
principal está ocupado. En el hilo principal de esa corrida hay 6,3 s de
evaluación de script y **2,8 s de estilo y layout**. Lo segundo no se había
medido en 56b: los selectores `:has()` del tema por espacio
(`globals.css`) y de la barra inferior
(`[body:has([role='dialog'])_&]:hidden`) son candidatos, porque invalidan
estilos en cada cambio del DOM durante el streaming.

**Profiler** (sin limitar la CPU)

| Interacción                    | Commit más largo | Componentes en ese commit | Commits | Componentes en total |
| ------------------------------ | ---------------- | ------------------------- | ------- | -------------------- |
| Buscar en Movimientos          | 94 ms            | 1.466                     | 10      | 1.590                |
| Cambiar de mes en Reportes     | 24 ms            | 268                       | 27      | 3.370                |
| Abrir el diálogo de movimiento | 63 ms            | 225                       | 8       | 298                  |

Entre corridas, el commit más largo varía: 89–119 ms al buscar, 24–37 ms al
cambiar de mes y 18–63 ms al abrir el diálogo. Ninguno pasa de 200 ms sin
limitar la CPU. Al buscar, el commit más largo repinta la tabla entera
(526 componentes) y las acciones de fila (444). Lo dispara la página nueva
que llega del servidor, no cada tecla. Cambiar de mes repinta sobre todo la
gráfica de tendencia (189 componentes).

**Render en la carga** (CPU 4×)

| Ruta                               | Pantalla  | Render total | Commits | Commit más largo | Componentes |
| ---------------------------------- | --------- | ------------ | ------- | ---------------- | ----------- |
| `/dashboard/personal`              | 412 × 823 | 3.943 ms     | 42      | 887 ms           | 1.199       |
| `/dashboard/personal`              | 1440×900  | 3.877 ms     | 38      | 745 ms           | 1.477       |
| `/dashboard/personal/transactions` | 412 × 823 | 3.696 ms     | 33      | 1.673 ms         | 2.307       |
| `/dashboard/personal/transactions` | 1440×900  | 3.550 ms     | 27      | 1.712 ms         | 2.182       |
| `/dashboard/personal/reports`      | 412 × 823 | 4.058 ms     | 40      | 1.193 ms         | 1.667       |
| `/dashboard/personal/reports`      | 1440×900  | 4.771 ms     | 52      | 786 ms           | 2.363       |

Por región (tiempo propio, ms · componentes), 412 × 823 salvo que se
indique:

| Región                                  | `/personal`          | `/transactions`      | `/reports`           |
| --------------------------------------- | -------------------- | -------------------- | -------------------- |
| Gráfica de tendencia (`*-trend`)        | 1.481 · 624          | —                    | 1.707 · 669          |
| Tabla de Movimientos                    | —                    | 766 · 857            | —                    |
| Acciones de fila de la tabla            | —                    | 226 · 460            | —                    |
| Sin DOM (proveedores y efectos)         | 572 · 202            | 482 · 551            | 632 · 299            |
| Header (accesos rápidos, título, ayuda) | 299 · 44             | 310 · 44             | 161 · 49             |
| Aside (oculto en el teléfono)           | 164 · 52             | 169 · 52             | 40 · 52              |
| Barra inferior (oculta en escritorio)   | 57 · 22 (escritorio) | 63 · 22 (escritorio) | 65 · 22 (escritorio) |
| Hoja de acciones rápidas (autoabierta)  | 69 · 63              | 60 · 63              | 39 · 63              |

Lo que se ve:

- El shell hidrata en las dos pantallas lo que solo se ve en una: en el
  teléfono, los 52 componentes del aside de escritorio, y en escritorio,
  los 22 de la barra inferior. En el teléfono, además, la hoja de accesos
  rápidos se abre sola al entrar (SPEC 15) y monta sus 63 componentes.
- La gráfica de tendencia es lo más caro del Resumen y de Reportes
  (~1,5 s con la CPU a 4×), aunque su chunk ya era diferido (56b). Se
  difiere la descarga, pero el montaje de Recharts sigue ocurriendo en la
  carga.
- En Movimientos, la tabla y sus acciones de fila suman ~1 s y forman el
  commit más largo de la carga (1,7 s): las 50 filas hidratan de una vez.

**Payload RSC**

| Ruta                               | RSC      | HTML     | `className` en el RSC | Fila más pesada                           |
| ---------------------------------- | -------- | -------- | --------------------- | ----------------------------------------- |
| `/dashboard/personal`              | 204,3 kB | 400,9 kB | 85,3 kB (42 %)        | Contexto de los accesos rápidos: 7,1 kB   |
| `/dashboard/personal/transactions` | 146,4 kB | 491,8 kB | 49,5 kB (34 %)        | Filtros con categorías y cuentas: 14,5 kB |
| `/dashboard/personal/reports`      | 166,8 kB | 352,7 kB | 63,1 kB (38 %)        | Contexto de los accesos rápidos: 7,1 kB   |

El contexto de los accesos rápidos viaja en cada ruta de Personal. En la
cuenta de pruebas lleva 19 categorías (5,6 kB) y 3 cuentas (1,2 kB), sin
metas, deudas, cobros, pagos pendientes ni ingresos fijos activos. En una
cuenta con esos datos, cada lista se suma a todas las rutas. El peso que
más se repite son las clases de Tailwind de los componentes de servidor
(34–42 %). Ninguna fila sola domina: el payload se reparte en ~300 filas.
