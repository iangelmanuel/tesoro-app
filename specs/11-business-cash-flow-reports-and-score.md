# SPEC 11 — Empresa: flujo de caja, reportes, score y recomendaciones

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 07, SPEC 08c, SPEC 10
> **Fecha:** 2026-10-31
> **Objetivo:** Que el usuario vea en cada empresa su flujo de caja mensual, utilidad y margen, reportes por periodo y categoría, y un score de salud de 0 a 100 con recomendaciones basadas en reglas propias de un negocio.

## Por qué existe este spec

El SPEC 10 deja registrar ventas y costos en una empresa, pero Flujo de caja, Reportes y Recomendaciones muestran "Próximamente" y el Resumen no tiene gráficas.
Las funciones de agregación del SPEC 03 (`monthly_totals`, `category_totals`) ya reciben `p_workspace_id`, así que sirven a Empresa sin cambios. Lo que cambia son los textos (ventas, costos) y los indicadores.
El score de Empresa **se calcula al vuelo**, igual que el del SPEC 07. El ROADMAP hablaba de `score_snapshots`, pero el SPEC 07 ya descartó los snapshots: todo dato tiene fecha y el histórico se reconstruye. Este spec corrige el ROADMAP.
El flujo de caja se arma solo con lo registrado: movimientos y saldos de cuentas (SPEC 08c). No hay cuentas por cobrar ni por pagar en Empresa.

## Alcance

**Entra:**

- Resumen de Empresa (`/dashboard/business/[id]`), sobre el mes actual en `America/Bogota`:
  - tarjeta "Salud del negocio" arriba, con score, banda, variación y las 3 recomendaciones principales;
  - tarjetas Ventas, Costos y gastos y Utilidad con variación vs. el mes anterior, más Margen y Saldo en cuentas;
  - gráfica de barras ventas vs. costos de los últimos 6 meses;
  - dona de costos y gastos por categoría del mes (top 6 + "Otras");
  - últimos 5 movimientos (ya existe).
- Página Flujo de caja (`/dashboard/business/[id]/cash-flow`), que reemplaza "Próximamente":
  - selector de periodo del SPEC 03 (mes, trimestre, año, rango), por defecto el año actual;
  - gráfica de barras de entradas y salidas por mes con línea de saldo en cuentas al cierre;
  - tabla mes a mes: entradas, salidas, neto y saldo en cuentas al cierre;
  - saldo a hoy de cada cuenta activa y el total;
  - aviso "N movimientos del periodo no tienen cuenta y no mueven el saldo" cuando aplica.
- Página Reportes (`/dashboard/business/[id]/reports`), que reemplaza "Próximamente":
  - la misma página del SPEC 03 (periodo, toggle, tendencia, dona, top 5 y tabla por categoría) con textos de Empresa ("Ventas" y "Costos y gastos");
  - por defecto el toggle muestra costos y gastos.
- Score de Empresa de 0 a 100 con 6 factores ponderados, misma mecánica que el SPEC 07 (exclusión y reescalado, bandas, histórico de 12 meses, "Sin datos suficientes").
- Motor de 10 reglas de recomendación de Empresa, con "Ocultar este mes" y "Mostrar de nuevo" sobre `dismissed_recommendations`.
- Página Recomendaciones (`/dashboard/business/[id]/recommendations`), que reemplaza "Próximamente", con la misma estructura que la de Personal: score, desglose, histórico, recomendaciones y ocultas.
- RPC nuevas `account_monthly_balances` y `counterparty_totals`.
- Sección "Empresa: flujo de caja, reportes y score" en `docs/producto.md`.

**Fuera de alcance (para specs futuros):**

- Cuentas por cobrar y por pagar.
- Proyecciones de flujo de caja o de ventas.
- Estados financieros formales (balance general, estado de resultados contable).
- Integraciones contables y exportar a software contable.
- IVA, retenciones e impuestos en los reportes.
- Exportar reportes en PDF o CSV.
- Presupuestos de Empresa y factores que dependan de ellos.
- Snapshots del score (`score_snapshots`) o cron.
- Pesos o umbrales configurables.
- Comparar el score entre empresas o con otros usuarios.
- Recomendaciones con IA o alertas por email o push.
- Fecha de archivado de cuentas para un histórico exacto de saldos.

## Modelo de datos

Migración `supabase/migrations/<timestamp>_business_reports_and_score.sql`. Sin tablas nuevas.

```sql
-- Nuevas claves de regla de Empresa (irregular_records se comparte)
alter table public.dismissed_recommendations
  drop constraint dismissed_recommendations_rule_check,
  add constraint dismissed_recommendations_rule_check check (rule in (
    -- Personal (SPEC 07)
    'deficit', 'category_growth', 'budget_exceeded', 'goal_at_risk',
    'high_utilization', 'highest_rate_first', 'overdue_payment',
    'low_cushion', 'unbudgeted_spending', 'irregular_records',
    -- Empresa (SPEC 11)
    'loss_month', 'negative_account', 'low_liquidity', 'sales_drop',
    'low_margin', 'cost_growth', 'client_concentration',
    'cost_concentration', 'missing_accounts'
  ));
```

- El nombre real del `check` se confirma en la BD antes de escribir el `drop`.
- **RLS de `dismissed_recommendations`:** `insert` y `delete` pasan de `is_workspace_owner` a `is_workspace_writable`. `select` no cambia.
- **RPC nuevas** (`security invoker`, `stable`, `search_path = ''`, `grant execute` solo a `authenticated`, `revoke` de `public` y `anon`):
  - `account_monthly_balances(p_workspace_id uuid, p_from date, p_to date)` devuelve `month date, balance numeric`:
    - una fila por mes entre `p_from` y `p_to` (primeros días de mes, inclusivos), con `generate_series`;
    - `balance`: Σ de las cuentas **activas hoy** al fin del mes;
    - por cuenta: `opening_balance` si su `created_at` en Bogotá es ≤ fin de mes, más ingresos − gastos con cuenta, ± traspasos y + ajustes con `occurred_on` ≤ fin de mes;
    - mismas reglas de deltas que `account_balances` (SPEC 08c).
  - `counterparty_totals(p_workspace_id uuid, p_from date, p_to date, p_type public.transaction_type)` devuelve `counterparty text, total numeric, tx_count bigint`:
    - agrupa por `lower(btrim(counterparty))` y devuelve como nombre el primer valor original (`min`);
    - excluye `counterparty is null`;
    - orden por total descendente.
- **RPC reutilizadas sin cambios:** `monthly_totals`, `category_totals`, `workspace_balance` (SPEC 03), `score_weekly_activity` (SPEC 07), `account_balances` y `transaction_totals` (SPEC 08c y 10).
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos (en `src/features/business-score/types.ts`):

```ts
type BusinessFactorKey =
  | "net_margin"
  | "liquidity"
  | "sales_growth"
  | "profitable_months"
  | "cost_concentration"
  | "regularity"

type BusinessRuleKey =
  | "loss_month"
  | "negative_account"
  | "low_liquidity"
  | "sales_drop"
  | "low_margin"
  | "cost_growth"
  | "client_concentration"
  | "cost_concentration"
  | "missing_accounts"
  | "irregular_records"

// FactorResult, ScoreResult, Band y Recommendation se reutilizan del SPEC 07,
// generalizados con un parámetro de tipo para la clave
```

### Periodo de un mes `M`

Mismas definiciones que el SPEC 07 (ventana, meses de ventana, meses cerrados, semanas de ventana, referencia), con "ingresos" = ventas y "gastos" = costos y gastos. Se agregan:

| Concepto               | Definición                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| Costo promedio         | `Σ costos de los meses cerrados (hasta 3) / número de meses cerrados`       |
| Saldo en cuentas       | `account_monthly_balances` al fin de `M`                                    |
| Trimestre reciente     | Los 3 meses cerrados anteriores a `M`                                       |
| Trimestre previo       | Los 3 meses cerrados anteriores al trimestre reciente                       |
| Meses cerrados del año | Hasta 6 meses cerrados anteriores a `M`, desde el mes del primer movimiento |

- El estado archivado de las cuentas se toma con su **valor actual**. Archivar una cuenta cambia el saldo de meses pasados. Es una aproximación documentada, como en el SPEC 07.

### Datos suficientes

Igual que el SPEC 07: `Σ ventas de la ventana > 0` y primer movimiento ≤ referencia − 30 días. Los motivos son "Registra tus ventas" y "Necesitamos 30 días de registros (faltan N días)".

### Factores

Interpolación lineal entre los puntos de la tabla, con tope en los extremos.

| Factor (`key`)                                 | Peso | Dato                                                           | Curva                               | Excluido si                                       |
| ---------------------------------------------- | ---- | -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| Margen neto (`net_margin`)                     | 30   | `(ventas − costos) / ventas` de la ventana                     | ≤ 0 % → 0; ≥ 20 % → 100             | nunca                                             |
| Liquidez (`liquidity`)                         | 25   | `max(saldo en cuentas, 0) / costo promedio`, en meses          | 0 → 0; ≥ 3 → 100                    | sin meses cerrados o costo promedio 0             |
| Crecimiento de ventas (`sales_growth`)         | 15   | `(ventas del trimestre reciente − previo) / ventas del previo` | ≤ −20 % → 0; 0 % → 50; ≥ 20 % → 100 | menos de 6 meses cerrados o ventas del previo = 0 |
| Meses con utilidad (`profitable_months`)       | 15   | % de meses cerrados del año con ventas > costos                | 0 % → 0; 100 % → 100                | sin meses cerrados                                |
| Concentración de costos (`cost_concentration`) | 10   | % de los costos de la ventana en la categoría de mayor costo   | ≤ 30 % → 100; ≥ 70 % → 0            | costos de la ventana = 0                          |
| Regularidad (`regularity`)                     | 5    | semanas de ventana con ≥ 1 movimiento / semanas de ventana     | 0 % → 0; 100 % → 100                | nunca                                             |

- **Score:** `round(Σ (peso × puntos) / Σ pesos incluidos)`. Bandas, variación e histórico iguales al SPEC 07.

### Ejemplo de score

Hoy 31 de octubre de 2026. Primer movimiento el 1 de abril. Ventas de 9.000.000 en abril, mayo y junio, y de 10.000.000 de julio a octubre. Costos de 8.500.000 cada mes: "Costo de ventas" 5.100.000 (60 %), "Sueldos y honorarios" 2.000.000 y "Arriendo" 1.400.000. Saldo en cuentas al 31 de octubre: 12.750.000. Al menos un movimiento cada semana.

| Factor             | Dato                                              | Puntos | Peso |
| ------------------ | ------------------------------------------------- | ------ | ---- |
| Margen             | 4.500.000 / 30.000.000 = 15 %                     | 75     | 30   |
| Liquidez           | 12.750.000 / 8.500.000 = 1,5 meses                | 50     | 25   |
| Crecimiento        | (30.000.000 − 27.000.000) / 27.000.000 = +11,11 % | 77,78  | 15   |
| Meses con utilidad | 6 de 6                                            | 100    | 15   |
| Concentración      | 60 %                                              | 25     | 10   |
| Regularidad        | 100 %                                             | 100    | 5    |

Score = `(30 × 75 + 25 × 50 + 15 × 77,78 + 15 × 100 + 10 × 25 + 5 × 100) / 100` = 69,17 → **69, Bueno**.

### Reglas de recomendación

En `src/features/business-score/recommendations.ts`. Se evalúan sobre hoy y el mes actual, aunque el score esté "Sin datos suficientes". Orden, ocultar y mostrar de nuevo como en el SPEC 07. Los enlaces usan `workspaceBasePath` y `workspaceTransactionsPath` de la empresa.

| #   | Regla (`rule`)         | Condición                                                                                                                                                                   | Dato (ejemplo)                                                            | Monto                      | Severidad | Enlace                                        | `entity_key`                                  |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------- | --------- | --------------------------------------------- | --------------------------------------------- |
| 1   | `loss_month`           | Último mes cerrado con costos > ventas                                                                                                                                      | "En septiembre tus costos superaron tus ventas en $ 700.000"              | pérdida                    | alta      | Reportes de ese mes                           | `YYYY-MM`                                     |
| 2   | `negative_account`     | Cuenta activa con saldo a hoy < 0                                                                                                                                           | "Bancolombia tiene saldo de −$ 250.000"                                   | valor absoluto del saldo   | alta      | Cuentas                                       | `account_id`                                  |
| 3   | `low_liquidity`        | Factor liquidez incluido en el mes actual y < 1 mes                                                                                                                         | "Tu saldo en cuentas cubre 0,6 meses de costos"                           | costo promedio − saldo     | alta      | Flujo de caja                                 | `workspace`                                   |
| 4   | `sales_drop`           | Hay 3 meses cerrados antes del último cerrado. Ventas del último cerrado ≤ 80 % del promedio de esos 3 (> 0)                                                                | "Vendiste $ 7.000.000 en septiembre vs. $ 10.000.000 de promedio (−30 %)" | promedio − ventas          | media     | Reportes de ese mes con `type=income`         | `YYYY-MM`                                     |
| 5   | `low_margin`           | Ventas de la ventana > 0 y margen neto de la ventana < 10 %                                                                                                                 | "Tu margen de los últimos 3 meses es 6 %"                                 | 10 % de ventas − utilidad  | media     | Reportes                                      | `workspace`                                   |
| 6   | `cost_growth`          | Hay 3 meses completos antes del último cerrado. Costo de una categoría en el último cerrado ≥ 130 % de su promedio de esos 3 (> 0) y la diferencia ≥ 5 % del costo promedio | "Arriendo: $ 1.950.000 en septiembre vs. $ 1.500.000 de promedio (+30 %)" | diferencia                 | media     | Movimientos de esa categoría y mes            | `category_id`                                 |
| 7   | `client_concentration` | Un cliente (`counterparty_totals` de ventas de la ventana) suma ≥ 50 % de las ventas de la ventana                                                                          | "Café Sol es el 62 % de tus ventas de los últimos 3 meses"                | ventas de ese cliente      | media     | Movimientos con `q=<cliente>` y `type=income` | `lower(btrim(cliente))`, hasta 100 caracteres |
| 8   | `cost_concentration`   | Una categoría suma ≥ 50 % de los costos de la ventana                                                                                                                       | "Costo de ventas es el 60 % de tus costos de los últimos 3 meses"         | costo de esa categoría     | baja      | Reportes con `type=expense`                   | `category_id`                                 |
| 9   | `missing_accounts`     | Mes actual con movimientos y `(ventas + costos sin cuenta) / (ventas + costos)` ≥ 30 % (`transaction_totals` con `p_without_account`)                                       | "El 45 % de lo que registraste este mes no tiene cuenta"                  | ventas + costos sin cuenta | baja      | Movimientos con `account=none`                | `workspace`                                   |
| 10  | `irregular_records`    | Regularidad del mes actual < 50 % (solo con datos suficientes)                                                                                                              | "Registraste movimientos en 5 de 13 semanas"                              | 0                          | baja      | Movimientos                                   | `workspace`                                   |

- El "Ejemplo de score" genera `cost_concentration` y ninguna otra regla.

### Flujo de caja

| Columna                    | Cálculo                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| Entradas                   | ventas del mes (`monthly_totals.income`), con o sin cuenta           |
| Salidas                    | costos y gastos del mes (`monthly_totals.expense`), con o sin cuenta |
| Neto                       | entradas − salidas                                                   |
| Saldo en cuentas al cierre | `account_monthly_balances` del mes                                   |

- Traspasos y ajustes no son entradas ni salidas. Sí mueven el saldo.
- El neto y la variación del saldo no cuadran cuando hay movimientos sin cuenta o ajustes. El aviso de movimientos sin cuenta lo explica.
- El periodo usa `src/features/reports/period.ts`. Por defecto `period=year` con el año actual. Rango máximo de 24 meses, como en el SPEC 03.

### Resumen de Empresa

| Tarjeta          | Cálculo                                                   | Sin datos                     |
| ---------------- | --------------------------------------------------------- | ----------------------------- |
| Ventas / Costos  | `monthly_totals` del mes; variación % vs. el mes anterior | variación "—" si anterior = 0 |
| Utilidad         | ventas − costos; variación como diferencia en dinero      | diferencia contra 0           |
| Margen           | utilidad / ventas × 100, puede ser negativo               | "—" si ventas = 0             |
| Saldo en cuentas | Σ `account_balances.balance` de las cuentas activas       | `$ 0`                         |

- La variación de costos usa color invertido, como en el SPEC 03.

## Plan de implementación

1. **Migración.**
   - `check` de reglas, políticas de `dismissed_recommendations` y las RPC `account_monthly_balances` y `counterparty_totals`.
   - Aplicarla y regenerar `src/types/database.ts`.
   - Verificar en la BD: `account_monthly_balances` devuelve una fila por mes y su último mes coincide con la suma de `account_balances` activas cuando no hay movimientos futuros. `counterparty_totals` agrupa "Café Sol" y "café sol ". Con un espacio ajeno, las dos devuelven ceros o vacío.
2. **Generalizar Reportes por espacio.**
   - `src/features/reports/components/reports-view.tsx`: el contenido de la página de Reportes del SPEC 03, que recibe el `workspace`.
   - Textos según `workspace.type` ("Ingresos/Gastos" o "Ventas/Costos y gastos") en el toggle, la tendencia, la dona y la tabla. Los enlaces de la tabla usan `workspaceTransactionsPath`.
   - `app/dashboard/personal/reports/page.tsx` usa `reports-view.tsx`. Verificar: Personal se ve igual que antes.
3. **Reportes de Empresa.**
   - `app/dashboard/business/[id]/reports/page.tsx` reemplaza "Próximamente" con `reports-view.tsx`, `buildMetadata` `noindex` y `Suspense`.
4. **Resumen de Empresa con gráficas.**
   - `business-summary-cards.tsx` agrega variación, Margen y Saldo en cuentas.
   - La gráfica de 6 meses y la dona de costos del mes reutilizan `income-expense-chart.tsx` y `category-donut-chart.tsx` con etiquetas de Empresa.
5. **Flujo de caja.**
   - `src/features/cash-flow/queries.ts`: `getCashFlow(workspaceId, from, to)` (`monthly_totals`, `account_monthly_balances` y el conteo de movimientos sin cuenta del periodo) con `Number()` en los `numeric`.
   - `src/features/cash-flow/components/cash-flow-chart.tsx` (barras de entradas y salidas + línea de saldo, con `aria-label` y tabla `sr-only`), `cash-flow-table.tsx` y `account-balances-list.tsx`.
   - `app/dashboard/business/[id]/cash-flow/page.tsx` reemplaza "Próximamente", con el selector de periodo y `Suspense`.
6. **Cálculos del score de Empresa.**
   - Mover a `src/features/score/curves.ts` la interpolación, las bandas y la ventana del SPEC 07, sin cambiar su comportamiento.
   - `src/features/business-score/types.ts`, `constants.ts` (pesos, curvas y umbrales de reglas) y `calculations.ts` (datos suficientes, cada factor y score). Funciones puras.
7. **Consultas del score de Empresa.**
   - `src/features/business-score/queries.ts`: `getBusinessScoreInputs(workspaceId, from, to)` (`monthly_totals`, `account_monthly_balances`, `category_totals` por mes de la ventana, `score_weekly_activity` y el primer movimiento) y `getBusinessScoreHistory(workspaceId)`.
8. **Reglas de Empresa.**
   - `src/features/business-score/recommendations.ts`: las 10 reglas, el orden y el filtro de ocultas. Usa `account_balances`, `counterparty_totals` y `transaction_totals`.
9. **Acciones por espacio.**
   - `dismissRecommendation(workspaceId, rule, entityKey)` y `restoreRecommendation(workspaceId, rule, entityKey)` en `src/features/score/actions.ts`:
     - resuelven el espacio con `requireWritableWorkspace(workspaceId)`;
     - validan con Zod la regla contra las claves del tipo de espacio;
     - revalidan las rutas del espacio.
   - Personal pasa su `id`. Verificar: ocultar y mostrar de nuevo en Personal funciona igual.
10. **Página de Recomendaciones de Empresa.**
    - Los componentes de `src/features/score/components/` reciben las etiquetas de factores y el `workspace` en lugar de asumir Personal.
    - `app/dashboard/business/[id]/recommendations/page.tsx` reemplaza "Próximamente", con `buildMetadata` `noindex` y `Suspense`.
    - Tarjeta "Salud del negocio" en el Resumen de Empresa, solo cuando hay movimientos.
11. **Estados vacíos.**
    - Sin movimientos en la empresa: Resumen, Flujo de caja, Reportes y Recomendaciones muestran "Registra tu primera venta" con el botón que abre `TransactionDialog`.
    - Periodo sin movimientos: "No hay movimientos en este periodo".
    - Sin recomendaciones activas: "Todo en orden por ahora".
    - Score sin datos: los motivos.
12. **Docs.**
    - `docs/producto.md`: sección "Empresa: flujo de caja, reportes y score" con flujo de caja, factores, pesos, curvas, bandas, reglas y aproximaciones.
    - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 11 y corrección de `score_snapshots`.
    - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y no hay dependencias nuevas.
- [ ] `supabase db reset` aplica las migraciones y `src/types/database.ts` incluye `account_monthly_balances` y `counterparty_totals`.
- [ ] Flujo de caja, Reportes y Recomendaciones de Empresa ya no muestran "Próximamente".
- [ ] Con ventas de 10.000.000 y costos de 8.500.000 en el mes actual, el Resumen de Empresa muestra Utilidad `$ 1.500.000` y Margen `15 %`.
- [ ] Sin ventas en el mes, Margen muestra "—".
- [ ] La gráfica de 6 meses del Resumen muestra 6 grupos de barras aunque haya meses sin movimientos.
- [ ] Flujo de caja sin parámetros muestra los 12 meses del año actual con entradas, salidas, neto y saldo al cierre.
- [ ] Un traspaso entre dos cuentas de la empresa no cambia entradas, salidas ni el saldo total al cierre.
- [ ] Un ajuste de saldo de +200.000 sube el saldo al cierre de su mes en 200.000 y no cambia entradas ni salidas.
- [ ] Una venta sin cuenta suma en entradas, no mueve el saldo y hace aparecer el aviso de movimientos sin cuenta.
- [ ] Una cuenta creada en septiembre con saldo inicial 1.000.000 no suma ese saldo al cierre de agosto.
- [ ] El saldo al cierre del mes actual coincide con "Saldo en cuentas" de la página Cuentas cuando no hay movimientos futuros.
- [ ] Reportes de Empresa muestra "Ventas" y "Costos y gastos" en el toggle y la tabla. Clic en una fila abre Movimientos de la empresa, no de Personal.
- [ ] Reportes de Personal se ve y funciona igual que antes de este spec.
- [ ] Con los datos del "Ejemplo de score", Recomendaciones de Empresa muestra 69, "Bueno", y los factores con 75, 50, 77,78 (o 78 en la UI), 100, 25 y 100 puntos.
- [ ] Con los datos del ejemplo, la única recomendación es `cost_concentration` con "Costo de ventas es el 60 % de tus costos de los últimos 3 meses".
- [ ] Una empresa con 4 meses cerrados excluye "Crecimiento de ventas" con su motivo y reescala los pesos.
- [ ] Una empresa cuyo primer movimiento es de hace 10 días muestra "Sin datos suficientes" con "Necesitamos 30 días de registros (faltan 20 días)".
- [ ] Una empresa con 60 días de solo costos muestra "Sin datos suficientes" con "Registra tus ventas".
- [ ] Un saldo en cuentas negativo da 0 puntos en liquidez.
- [ ] Un mes cerrado con costos > ventas genera `loss_month` con enlace a Reportes de ese mes.
- [ ] Una cuenta activa con saldo negativo genera `negative_account` con enlace a Cuentas.
- [ ] Liquidez de 0,6 meses genera `low_liquidity`; de 1,2 meses no.
- [ ] Ventas del último mes cerrado al 70 % del promedio de los 3 anteriores generan `sales_drop`; al 85 % no.
- [ ] Margen de la ventana de 6 % genera `low_margin`; de 12 % no.
- [ ] Una categoría de costo con 1.500.000 de promedio y 1.950.000 en el último mes cerrado, con costo promedio de 8.500.000, genera `cost_growth` con "+30 %".
- [ ] Ventas a "Café Sol" y "café sol " que suman el 62 % de la ventana generan una sola `client_concentration` con 62 %.
- [ ] El 45 % del monto del mes sin cuenta genera `missing_accounts` con enlace a Movimientos `account=none`; el 20 % no.
- [ ] "Ocultar este mes" en una recomendación de Empresa la mueve a "Ocultas este mes" y la saca del Resumen de Empresa. "Mostrar de nuevo" la devuelve.
- [ ] Ocultar una recomendación en Empresa no oculta nada en Personal, y viceversa.
- [ ] `dismissRecommendation` con una regla de Personal sobre una empresa (por ejemplo `budget_exceeded`) devuelve un error de validación y no escribe.
- [ ] Con la empresa marcada para borrar, insertar en `dismissed_recommendations` con su `id` desde SQL con la sesión del usuario falla.
- [ ] Registrar una venta desde el registro rápido actualiza el Resumen, el Flujo de caja y el score de la empresa sin recargar a mano.
- [ ] Un usuario A que llama `account_monthly_balances` o `counterparty_totals` con una empresa de B recibe ceros o vacío. Un cliente `anon` no puede ejecutarlas.
- [ ] El score, las recomendaciones y los reportes de Personal funcionan igual que antes de este spec.

## Decisiones

- **Sí:** flujo de caja con movimientos registrados y saldo en cuentas al cierre. Es lo que el usuario ya registra y le dice cuánta plata tiene.
- **No:** cuentas por cobrar y por pagar. Abren un dominio nuevo (vencimientos, clientes, proveedores); van en su propio spec.
- **No:** flujo de caja con solo movimientos. Sería casi igual a la utilidad.
- **Sí:** entradas y salidas incluyen movimientos sin cuenta; el saldo solo cuenta movimientos con cuenta. Las entradas cuadran con las ventas y el saldo con la página Cuentas. El aviso y la regla `missing_accounts` explican la diferencia.
- **Sí:** saldo histórico con las cuentas activas hoy. Coincide con "Saldo en cuentas" del SPEC 08c.
- **No:** `archived_at` histórico en cuentas. Precisión que casi no se nota; aproximación documentada.
- **Sí:** score calculado al vuelo, como el SPEC 07.
- **No:** `score_snapshots`. El SPEC 07 ya lo descartó: congela errores y agrega infraestructura. El ROADMAP se corrige.
- **Sí:** 6 factores con pesos 30 / 25 / 15 / 15 / 10 / 5. Margen y liquidez son lo que más dice de la salud de un negocio pequeño.
- **No:** 4 factores. Pierde la estabilidad (meses con utilidad) y la regularidad del registro.
- **No:** reutilizar los 7 factores de Personal. Presupuestos, metas y tarjetas no existen en Empresa.
- **Sí:** liquidez con saldo en cuentas, no con balance acumulado. Incluye saldos iniciales y ajustes, que son la plata real.
- **Sí:** crecimiento con trimestres cerrados. El mes en curso parcial haría caer el crecimiento todos los inicios de mes.
- **Sí:** datos suficientes iguales al SPEC 07. Mismo criterio en los dos espacios y factores sin datos se excluyen.
- **Sí:** 10 reglas, incluida `client_concentration` con `counterparty`. Aprovecha el dato que agregó el SPEC 10.
- **No:** 5 reglas básicas. Deja fuera cuentas negativas y calidad del registro.
- **Sí:** `irregular_records` comparte clave con Personal. Misma regla y mismo texto.
- **Sí:** reutilizar `dismissed_recommendations` ampliando el `check`. Ya es por `workspace_id`.
- **Sí:** políticas de escritura de `dismissed_recommendations` con `is_workspace_writable`, como el resto de tablas de un espacio.
- **Sí:** Resumen, Reportes y Recomendaciones con la misma estructura que Personal. El usuario ya conoce esas pantallas.
- **Sí:** generalizar componentes de Reportes y Score por espacio en lugar de copiarlos. Un cambio de gráfica llega a los dos espacios.
- **Sí:** módulo propio `src/features/business-score/` para factores y reglas, y `src/features/score/curves.ts` compartido. Los factores no se mezclan y la mecánica no se duplica.
- **Sí:** Flujo de caja por defecto en el año actual. Muestra tendencia sin elegir nada.

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Generalizar Reportes, Score y sus acciones rompe Personal                   | Los pasos 2 y 9 se verifican en Personal antes de seguir. Dos criterios de aceptación lo repiten                                       |
| Neto del mes y variación del saldo no cuadran                               | Aviso de movimientos sin cuenta en la página y regla `missing_accounts`. Documentado en `docs/producto.md`                             |
| En comercio, "Costo de ventas" domina los costos y castiga la concentración | Pesa 10 y la regla es de severidad baja. Documentado; los umbrales se pueden revisar con datos reales                                  |
| `counterparty` es texto libre y un mismo cliente aparece escrito distinto   | Se agrupa por `lower(btrim())`. Variantes con otra ortografía quedan separadas; clientes como entidad van en otro spec                 |
| Archivar una cuenta cambia el saldo de meses pasados                        | Aproximación documentada, como la del SPEC 07                                                                                          |
| Calcular 12 meses al vuelo hace lenta la página                             | Cada RPC devuelve todos los meses en una llamada. Página y tarjeta en `Suspense`                                                       |
| El nombre del `check` de `dismissed_recommendations` no es el esperado      | Se consulta en `pg_constraint` antes de escribir el `drop`                                                                             |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas          | Páginas y tarjetas leen `params`, sesión y fecha dentro de `Suspense`. Antes de implementar se consulta `node_modules/next/dist/docs/` |
| `numeric` llega como `number` o `string`                                    | Las consultas convierten con `Number()`                                                                                                |

## Lo que **no** entra en este spec

- Cuentas por cobrar y por pagar.
- Proyecciones de flujo de caja o de ventas.
- Balance general y estados financieros formales.
- Integraciones contables.
- Impuestos en reportes.
- Exportar PDF o CSV.
- Presupuestos de Empresa.
- Snapshots del score o cron.
- Pesos o umbrales configurables.
- Comparar empresas entre sí o con otros usuarios.
- IA y alertas.

Cada uno de esos puntos, si llega, va en su propio spec.
