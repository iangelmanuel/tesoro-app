# SPEC 03 — Resumen y reportes con gráficas

> **Estado:** Implementado
> **Depende de:** SPEC 02
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario vea en Resumen y en Reportes del espacio Personal gráficas e indicadores claros de sus ingresos, gastos, balance y categorías, calculados en Postgres a partir de sus movimientos.

## Por qué existe este spec

Los movimientos del SPEC 02 ya se registran, pero todavía no se ven como panorama. Este spec convierte esos datos en tarjetas, gráficas y tablas.
También deja las funciones de agregación (`monthly_totals`, `category_totals`, `workspace_balance`) y los colores de gráfica por categoría, que reutilizan presupuestos (04), score (07) y Empresa (11).

## Alcance

**Entra:**

- Funciones RPC `security invoker` en Postgres: `monthly_totals`, `category_totals` y `workspace_balance`. Ningún total se suma en el cliente.
- Página `/dashboard/personal` (Resumen), siempre sobre el mes calendario actual en `America/Bogota`:
  - tarjetas de ingresos, gastos y balance del mes, con variación contra el mes anterior completo;
  - tarjetas de tasa de ahorro, gasto promedio diario, proyección de gasto a fin de mes, categoría de mayor gasto, balance acumulado histórico y número de movimientos del mes;
  - gráfica de barras agrupadas de ingresos vs. gastos de los últimos 6 meses (incluido el actual);
  - dona de gastos por categoría del mes (top 6 + "Otras");
  - últimos 5 movimientos con enlace a Movimientos.
- Página `/dashboard/personal/reports`:
  - selector de periodo: mes, trimestre, año o rango, en la URL;
  - toggle Gastos/Ingresos para las vistas por categoría;
  - tendencia mensual: barras de ingresos y gastos más línea de balance;
  - dona de distribución por categoría (top 6 + "Otras");
  - barras horizontales con las top 5 categorías;
  - tabla resumen por categoría con enlace a Movimientos filtrados.
- Componente `chart` de shadcn/ui (Recharts) con tema claro/oscuro y accesibilidad.
- Constante `CATEGORY_CHART_COLORS` y variables CSS por tema para los colores de categoría, ingreso y gasto.
- Estados vacíos y skeletons en las dos páginas.

**Fuera de alcance (para specs futuros):**

- Score financiero (SPEC 07).
- Exportar reportes en PDF o CSV.
- Comparativas con presupuesto (SPEC 04).
- Inicio de mes personalizado (día de pago). Todo usa mes calendario.
- Granularidad diaria o trimestral en la tendencia. Siempre agrupa por mes.
- Variación contra el periodo anterior en la tabla de Reportes.
- Resumen y Reportes del espacio Empresa.
- Multimoneda.

## Modelo de datos

Sin tablas nuevas. Migración `supabase/migrations/<timestamp>_create_report_functions.sql`:

```sql
-- Totales por mes, con meses sin movimientos en cero
create function public.monthly_totals(
  p_workspace_id uuid,
  p_from date,   -- primer día de un mes
  p_to date      -- cualquier día del último mes, inclusive
)
returns table (month date, income numeric, expense numeric, tx_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.month::date,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0),
    count(t.id)
  from generate_series(
    date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month'
  ) as m (month)
  left join public.transactions t
    on t.workspace_id = p_workspace_id
    and t.occurred_on >= m.month
    and t.occurred_on < m.month + interval '1 month'
  group by m.month
  order by m.month;
$$;

-- Totales por categoría en un rango de fechas inclusivo
create function public.category_totals(
  p_workspace_id uuid,
  p_from date,
  p_to date,
  p_type public.transaction_type
)
returns table (
  category_id uuid,
  name text,
  icon text,
  color text,
  archived boolean,
  total numeric,
  tx_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.icon, c.color, c.archived_at is not null,
         sum(t.amount), count(t.id)
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace_id
    and t.type = p_type
    and t.occurred_on between p_from and p_to
  group by c.id
  order by sum(t.amount) desc;
$$;

-- Balance acumulado histórico (todos los ingresos − todos los gastos)
create function public.workspace_balance(p_workspace_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(case when type = 'income' then amount else -amount end), 0)
  from public.transactions
  where workspace_id = p_workspace_id;
$$;
```

- Las tres funciones son `security invoker`: RLS de `transactions` y `categories` filtra las filas. Con un `workspace_id` ajeno devuelven ceros o vacío, nunca datos de otro usuario.
- `grant execute` solo a `authenticated`; `revoke` de `public` y `anon`.
- El índice `transactions_workspace_date` del SPEC 02 cubre los filtros por fecha. No se agregan índices.
- Los movimientos con fecha futura cuentan en el mes de su fecha, igual que en Movimientos.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Colores de gráfica:

```ts
// src/features/categories/constants.ts
export const CATEGORY_CHART_COLORS = {
  emerald: "var(--category-emerald)",
  teal: "var(--category-teal)"
  // una entrada por cada clave de CATEGORY_COLORS
} as const satisfies Record<CategoryColorKey, string>
```

- `src/styles/globals.css` define `--category-<clave>` en `:root` (tono 500) y en `.dark` (tono 400) para las 12 claves.
- También define `--income` (emerald), `--expense` (rose) y `--balance` (sky) por tema.
- "Otras" usa `--muted-foreground`.

Parámetros de URL de `/dashboard/personal/reports`:

| Parámetro | Valores                                     | Por defecto              |
| --------- | ------------------------------------------- | ------------------------ |
| `period`  | `month`, `quarter`, `year`, `range`         | `month`                  |
| `value`   | `YYYY-MM`, `YYYY-Qn` o `YYYY` según periodo | periodo actual en Bogotá |
| `from`    | `YYYY-MM-DD` (solo `range`)                 | —                        |
| `to`      | `YYYY-MM-DD` (solo `range`)                 | —                        |
| `type`    | `expense`, `income`                         | `expense`                |

- Un rango con `from > to`, más de 24 meses o fechas inválidas muestra un aviso y cae al mes actual.
- Cualquier valor inválido cae a su valor por defecto.

Métricas del Resumen (mes actual en Bogotá; "anterior" = mes anterior completo):

| Tarjeta                  | Cálculo                                                | Sin datos                     |
| ------------------------ | ------------------------------------------------------ | ----------------------------- |
| Ingresos / Gastos        | `monthly_totals` del mes; variación % vs. anterior     | variación "—" si anterior = 0 |
| Balance                  | ingresos − gastos; variación como diferencia en dinero | diferencia contra 0           |
| Tasa de ahorro           | balance / ingresos × 100, puede ser negativa           | "—" si ingresos = 0           |
| Gasto promedio diario    | gastos del mes / días transcurridos (hoy incluido)     | `$ 0`                         |
| Proyección de gasto      | promedio diario × días del mes                         | `$ 0`                         |
| Categoría de mayor gasto | primera fila de `category_totals` de gastos del mes    | "—"                           |
| Balance acumulado        | `workspace_balance`                                    | `$ 0`                         |
| Movimientos del mes      | `tx_count` del mes                                     | `0`                           |

- La variación de gastos usa color invertido: subir es rojo y bajar es verde.

## Plan de implementación

1. **Componente de gráficas.**
   - Agregar `chart` de shadcn (instala `recharts` con versión exacta).
   - Verificar: `pnpm check`, `pnpm eslint`, `pnpm build` pasan y el lockfile queda sincronizado.
2. **Migración.**
   - Crear la migración del modelo de datos con las tres funciones y sus `grant`.
   - Aplicarla con `supabase db push` (o `supabase db reset` en local) y regenerar `src/types/database.ts`.
   - Verificar: `monthly_totals` de 6 meses devuelve 6 filas aunque haya meses sin movimientos.
3. **Colores.**
   - Variables `--category-*`, `--income`, `--expense` y `--balance` en `globals.css` para claro y oscuro.
   - `CATEGORY_CHART_COLORS` en `src/features/categories/constants.ts`.
4. **Periodos y métricas.**
   - `src/features/reports/period.ts`: parsea y valida los parámetros de URL y devuelve `{ period, value, from, to, label, type, warning? }` con fechas en Bogotá. Etiquetas en español (`octubre 2026`, `T4 2026`, `2026`, `1 ago – 15 oct 2026`).
   - `src/features/reports/metrics.ts`: funciones puras para variación %, diferencia de balance, tasa de ahorro, promedio diario, proyección y agrupación top N + "Otras".
5. **Consultas.**
   - `src/features/reports/queries.ts`: `getMonthlyTotals`, `getCategoryTotals`, `getWorkspaceBalance` (RPC) y `getRecentTransactions(workspaceId, 5)`.
   - Todas reciben el workspace de `getPersonalWorkspace()`.
6. **Gráficas compartidas.**
   - `src/features/reports/components/`:
     - `income-expense-chart.tsx` (client): barras agrupadas por mes, con línea de balance opcional;
     - `category-donut-chart.tsx` (client): dona con leyenda y total al centro;
     - `top-categories-chart.tsx` (client): barras horizontales;
     - `chart-data-table.tsx`: tabla `sr-only` con los mismos datos de cada gráfica.
   - Todas usan `ChartContainer` con `accessibilityLayer`, `aria-label` descriptivo, tooltip con `formatCurrency` y meses con `date-fns` locale `es`.
7. **Página Resumen.**
   - `app/dashboard/personal/page.tsx` reemplaza el placeholder. Usa `buildMetadata` con `noindex` y lee datos dentro de `Suspense` con skeletons.
   - `summary-cards.tsx`: las 9 tarjetas de la tabla de métricas.
   - Gráfica de 6 meses, dona del mes y `recent-transactions.tsx` (fecha, descripción, `CategoryBadge`, monto con signo y color) con enlace "Ver todos" a Movimientos.
8. **Página Reportes.**
   - `app/dashboard/personal/reports/page.tsx` reemplaza el placeholder, con `buildMetadata` `noindex` y `Suspense`.
   - `report-period-picker.tsx` (client): `select` de tipo de periodo y control de valor (mes, trimestre, año, o dos fechas con Calendar + Popover). Escribe en la URL.
   - Toggle Gastos/Ingresos con `toggle-group` en `?type`.
   - Tendencia mensual del periodo, dona, top 5 y `category-summary-table.tsx`:
     - columnas categoría (badge, "(archivada)" si aplica), total, % del total del tipo, número de movimientos y promedio por movimiento;
     - orden por total descendente;
     - cada fila enlaza a Movimientos con `category` y `type`, y con `month` si el periodo es `month` (si no, `month=all`).
9. **Estados vacíos.**
   - Sin ningún movimiento en el espacio: Resumen y Reportes muestran "Registra tu primer movimiento" con el botón que abre `TransactionDialog`.
   - Periodo sin movimientos: gráficas reemplazadas por "No hay movimientos en este periodo".
   - Toggle sin datos del tipo: "No hay ingresos/gastos en este periodo".
10. **Docs.**
    - `docs/producto.md`: métricas del Resumen, periodos de Reportes y reglas de agregación.
    - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 03.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y `recharts` tiene versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `monthly_totals`, `category_totals` y `workspace_balance`.
- [ ] Con un ingreso de 3.000.000 y gastos de 1.200.000 en el mes actual, Resumen muestra Ingresos `$ 3.000.000`, Gastos `$ 1.200.000`, Balance `$ 1.800.000` y Tasa de ahorro `60 %`.
- [ ] Con gastos de 1.000.000 el mes anterior y 1.200.000 este mes, la variación de gastos muestra `+20 %` en rojo.
- [ ] Sin movimientos el mes anterior, las variaciones de ingresos y gastos muestran "—".
- [ ] Sin ingresos en el mes, la tasa de ahorro muestra "—".
- [ ] El día 10 de un mes de 31 días con 500.000 en gastos, el promedio diario es `$ 50.000` y la proyección `$ 1.550.000`.
- [ ] La categoría de mayor gasto coincide con la primera fila de la tabla de Reportes para el mes actual.
- [ ] El balance acumulado incluye movimientos de todos los meses, no solo del actual.
- [ ] La gráfica de 6 meses muestra 6 grupos de barras aunque haya meses sin movimientos.
- [ ] Con 8 categorías de gasto en el mes, la dona muestra 6 más "Otras", y "Otras" suma las 2 restantes.
- [ ] Resumen lista los 5 movimientos más recientes (`occurred_on desc, created_at desc`) y "Ver todos" abre Movimientos.
- [ ] Un movimiento con fecha futura dentro del mes actual suma en las tarjetas del Resumen.
- [ ] Reportes sin parámetros muestra el mes actual y gastos.
- [ ] `?period=quarter&value=2026-Q3` muestra julio, agosto y septiembre en la tendencia.
- [ ] `?period=year&value=2026` muestra 12 meses en la tendencia.
- [ ] `?period=range&from=2026-08-15&to=2026-10-10` filtra las categorías por esas fechas exactas y la tendencia muestra agosto, septiembre y octubre.
- [ ] Un rango de más de 24 meses o con `from > to` muestra un aviso y cae al mes actual.
- [ ] `?type=income` cambia dona, top 5 y tabla a ingresos. La tendencia no cambia.
- [ ] La tabla muestra total, % (los % suman 100), número de movimientos y promedio, ordenada por total descendente.
- [ ] Una categoría archivada con movimientos en el periodo aparece en la tabla como "(archivada)".
- [ ] Clic en una fila de la tabla con `period=month` abre Movimientos filtrado por esa categoría, tipo y mes, con el mismo total.
- [ ] Recargar Reportes conserva periodo y tipo.
- [ ] Las gráficas se ven legibles en tema claro y oscuro, y la dona usa el mismo color que el badge de cada categoría.
- [ ] Cada gráfica tiene `aria-label` y una tabla `sr-only` con sus datos. El tooltip se puede recorrer con teclado.
- [ ] Sin movimientos en el espacio, Resumen y Reportes muestran la invitación a registrar el primero.
- [ ] Un periodo sin movimientos muestra "No hay movimientos en este periodo" en lugar de gráficas vacías.
- [ ] Un usuario A que llama `monthly_totals`, `category_totals` o `workspace_balance` con el workspace de B recibe ceros o vacío (probado con el cliente o SQL).
- [ ] Un cliente `anon` no puede ejecutar las funciones.

## Decisiones

- **Sí:** agregaciones en funciones RPC `security invoker`. Respetan RLS y no traen filas al cliente.
- **No:** vistas. No reciben parámetros de fecha y obligarían a filtrar en el cliente.
- **No:** sumar en el cliente. Sería lento con muchos movimientos y duplicaría lógica.
- **Sí:** `monthly_totals` rellena meses vacíos con `generate_series`. Las gráficas no saltan meses.
- **Sí:** `monthly_totals` devuelve `tx_count`. Evita otra RPC para "Movimientos del mes".
- **Sí:** mes calendario en `America/Bogota`. Consistente con el filtro de Movimientos del SPEC 02.
- **No:** inicio de mes por día de pago. Toca perfil, Movimientos y presupuestos; queda para un spec futuro.
- **Sí:** variación contra el mes anterior completo. Simple y se lee como "cómo voy".
- **No:** comparar el mismo tramo de días. Más justo pero más difícil de explicar.
- **Sí:** variación del balance como diferencia en dinero. Un % sobre un balance negativo o cercano a cero confunde.
- **Sí:** tasa de ahorro, promedio diario, proyección, categoría top, balance acumulado y número de movimientos en el Resumen. El usuario los pidió.
- **Sí:** los movimientos futuros cuentan por su fecha. Mismos totales que Movimientos.
- **Sí:** periodo en la URL con `period` + `value` (o `from`/`to`). Enlaces compartibles y el preset se conserva al recargar.
- **No:** solo `from`/`to`. Se pierde el tipo de periodo.
- **Sí:** tendencia siempre mensual y rango máximo de 24 meses. Una sola RPC y gráficas legibles.
- **No:** granularidad automática por día o trimestre. Más RPC y casos.
- **Sí:** barras agrupadas para ingresos vs. gastos, dona para distribución y barras horizontales para top. Cada forma responde una pregunta distinta.
- **Sí:** dona con top 6 + "Otras". Más porciones no se distinguen.
- **Sí:** toggle Gastos/Ingresos en Reportes, por defecto Gastos. Los gastos son lo que más se analiza.
- **Sí:** colores de categoría vía `CATEGORY_CHART_COLORS` y variables CSS por tema. Gráfica y badge coinciden.
- **No:** paleta `--chart-1..5`. Hoy es gris y no coincide con las categorías.
- **Sí:** tabla con total, %, número y promedio, con enlace a Movimientos. Del resumen se baja al detalle.
- **No:** variación por categoría contra el periodo anterior. Otra RPC; puede llegar después.
- **Sí:** el enlace de la tabla usa `month` solo si el periodo es un mes, y `month=all` si no. Movimientos solo filtra por mes.
- **No:** exportar PDF/CSV ahora. Queda fuera, como dice el roadmap.
- **Sí:** tabla `sr-only` por gráfica además de `accessibilityLayer`. Los lectores de pantalla leen los números.

## Riesgos

| Riesgo                                                                           | Mitigación                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Recharts usa APIs del navegador y no corre en Server Components                  | Las gráficas son client components que reciben datos ya agregados desde el servidor                                                          |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas               | Las páginas leen sesión y `searchParams` dentro de `Suspense` con skeletons. Antes de implementar se consulta `node_modules/next/dist/docs/` |
| La versión de `chart` de shadcn no coincide con la versión de Recharts instalada | Se instala la versión que fija el CLI de shadcn y se verifica con `pnpm build`                                                               |
| `numeric` llega como `number` o `string` según el cliente                        | Las consultas convierten con `Number()` antes de pasar datos a las gráficas                                                                  |
| El "mes actual" cambia según la zona horaria del servidor                        | Hoy, mes actual y días transcurridos se calculan siempre en `America/Bogota`                                                                 |
| Los colores de categoría tienen bajo contraste en oscuro                         | Tono 400 en `.dark` y verificación visual en los dos temas                                                                                   |
| Los datos no se refrescan tras crear un movimiento desde el header               | Las acciones del SPEC 02 revalidan también `/dashboard/personal` y `/dashboard/personal/reports`                                             |

## Lo que **no** entra en este spec

- Score financiero.
- Exportar PDF o CSV.
- Comparativas con presupuesto.
- Inicio de mes personalizado.
- Granularidad diaria o trimestral en la tendencia.
- Variación por categoría contra el periodo anterior.
- Resumen y Reportes de Empresa.
- Multimoneda.

Cada uno de esos puntos, si llega, va en su propio spec.
