# SPEC 07 — Score financiero y recomendaciones

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 04, SPEC 05, SPEC 06
> **Fecha:** 2026-10-30
> **Objetivo:** Que el usuario vea en su espacio Personal un score de salud financiera de 0 a 100 con su desglose y evolución, y recomendaciones basadas en reglas que dicen en qué dato se apoyan y enlazan a donde se resuelven.

## Por qué existe este spec

Los SPEC 02 a 06 registran lo que entra, sale, se planea, se ahorra y se debe. Este spec los resume en un número y en acciones concretas.
El score **se calcula al vuelo** y no se guarda. Todo dato del usuario tiene fecha, así que el histórico se reconstruye mes a mes. Editar un movimiento viejo corrige también el histórico, sin snapshots desfasados.
Las recomendaciones son **reglas fijas, sin IA**. Cada una muestra el dato que la dispara y un enlace a la sección donde se actúa. Solo se pueden ocultar por el mes en curso.
Reutiliza `monthly_totals`, `category_totals`, `budget_progress`, `recurring_occurrences` (SPEC 03 y 04), `goal_progress` (SPEC 05) y `debt_overview` (SPEC 06), además de los cálculos de estado de metas y deudas.

## Alcance

**Entra:**

- Score de 0 a 100 con 7 factores ponderados. Un factor sin datos se excluye y los pesos de los demás se reescalan.
- Estado "Sin datos suficientes" con el motivo.
- Histórico de 12 meses (incluido el actual), recalculado al vuelo.
- RPC `score_monthly_inputs`, `score_weekly_activity` y `score_balances` con los insumos por mes.
- Motor de 10 reglas de recomendación, ordenadas por severidad y monto.
- Tabla `dismissed_recommendations` para ocultar una recomendación durante el mes en curso.
- Página `/dashboard/personal/recommendations`, que reemplaza el placeholder:
  - tarjeta del score con número, banda, variación vs. el mes anterior y fecha de cálculo;
  - desglose por factor con peso, dato, puntaje y motivo de exclusión;
  - gráfica de línea del histórico de 12 meses;
  - lista de recomendaciones con severidad, dato, enlace "Ir a …" y "Ocultar este mes";
  - sección plegable "Ocultas este mes" con "Mostrar de nuevo".
- En Resumen (`/dashboard/personal`), la tarjeta "Salud financiera" arriba de las tarjetas del SPEC 03, con el score y las 3 recomendaciones principales.
- Sección "Score y recomendaciones" en `docs/producto.md` con factores, pesos, curvas, reglas y aproximaciones.

**Fuera de alcance (para specs futuros):**

- Recomendaciones con IA o LLM.
- Alertas o notificaciones por email o push.
- Score y recomendaciones de Empresa (SPEC 11).
- Guardar snapshots del score (`score_snapshots`) o calcularlo con cron.
- Descartar recomendaciones para siempre.
- Pesos o umbrales configurables por el usuario.
- Fecha de archivado (`archived_at`) en metas y deudas para un histórico exacto.
- Comparar el score con otros usuarios.
- Explicación del score en la landing (SPEC 12).

## Modelo de datos

Migración `supabase/migrations/<timestamp>_create_score.sql`:

```sql
create table public.dismissed_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  rule text not null check (rule in (
    'deficit', 'category_growth', 'budget_exceeded', 'goal_at_risk',
    'high_utilization', 'highest_rate_first', 'overdue_payment',
    'low_cushion', 'unbudgeted_spending', 'irregular_records'
  )),
  entity_key text not null check (char_length(entity_key) between 1 and 100),
  month date not null check (extract(day from month) = 1), -- mes en que se ocultó
  created_at timestamptz not null default now(),
  unique (workspace_id, rule, entity_key, month)
);
```

- **RLS** activo: `select`, `insert` y `delete` con `is_workspace_owner(workspace_id)`. Sin `update`.
- **RPC** (`security invoker`, `stable`, `search_path = ''`, `grant execute` solo a `authenticated`). `p_from` y `p_to` son primeros días de mes, inclusivos:
  - `score_monthly_inputs(p_workspace_id uuid, p_from date, p_to date)` devuelve `month date, income numeric, expense numeric, closing_balance numeric, budgeted_count int, within_budget_count int`:
    - una fila por mes, con ceros en los meses sin datos;
    - `income` y `expense` como `monthly_totals` (fechas futuras cuentan en su mes);
    - `closing_balance`: ingresos − gastos de toda la historia hasta el fin del mes;
    - `budgeted_count`: categorías con presupuesto en el mes; `within_budget_count`: de ellas, las que tienen gastado ≤ presupuesto.
  - `score_weekly_activity(p_workspace_id uuid, p_from date, p_to date)` devuelve `week_start date, tx_count bigint`:
    - semanas ISO (lunes) con al menos un movimiento con `occurred_on` en el rango y ≤ hoy en `America/Bogota`.
  - `score_balances(p_workspace_id uuid, p_from date, p_to date)` devuelve `kind text, entity_id uuid, month date, balance numeric`:
    - `kind = 'debt'`: saldo de cada tarjeta y préstamo al fin del mes (entradas con `occurred_on` ≤ fin de mes), solo meses con `created_at` ≤ fin de mes;
    - `kind = 'goal'`: ahorrado de cada meta al fin del mes (aportes con `occurred_on` ≤ fin de mes);
    - cuentas por cobrar excluidas.
- Primer movimiento: `min(occurred_on)` de `transactions` del espacio, consultado en `queries.ts`.
- Tras la migración se regenera `src/types/database.ts` y se le pasa Prettier.

Tipos (en `src/features/score/types.ts`):

```ts
type FactorKey =
  | "savings_rate"
  | "debt_to_income"
  | "emergency_cushion"
  | "budgets"
  | "card_utilization"
  | "goals"
  | "regularity"

type FactorResult =
  | { key: FactorKey; weight: number; value: number; points: number } // points 0–100
  | { key: FactorKey; weight: number; excluded: string } // motivo

type ScoreResult =
  | { month: string; score: number; band: Band; factors: FactorResult[] }
  | { month: string; insufficient: string[] } // motivos

type Recommendation = {
  rule: RuleKey
  entityKey: string
  severity: "high" | "medium" | "low"
  title: string
  evidence: string // el dato en que se basa
  amount: number // para desempatar; 0 si no aplica
  href: Route
  linkLabel: string
}
```

### Periodo de un mes `M`

Fechas en `America/Bogota`. "Referencia" es hoy si `M` es el mes actual, o el último día de `M` si es pasado.

| Concepto            | Definición                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Ventana             | De `max(primer día de M − 2 meses, mes del primer movimiento)` a `M`, inclusive                                             |
| Meses de ventana    | Número de meses de la ventana (1 a 3)                                                                                       |
| Ingreso mensual     | `Σ ingresos de la ventana / meses de ventana`                                                                               |
| Meses cerrados      | Los 3 meses anteriores a `M`, desde el mes del primer movimiento                                                            |
| Gasto promedio      | `Σ gastos de los meses cerrados / número de meses cerrados`                                                                 |
| Saldos              | Al fin de `M` (`score_balances`, `closing_balance`)                                                                         |
| Semanas de ventana  | Semanas ISO que tocan `[max(inicio de ventana, primer movimiento), referencia]`                                             |
| Deudas consideradas | Tarjetas y préstamos con `created_at` ≤ fin de `M`, sin archivar hoy, y no pagadas antes del fin de `M` (`closed_at`)       |
| Metas consideradas  | Metas con fecha objetivo, `created_at` ≤ fin de `M`, sin archivar hoy, y no cumplidas antes del fin de `M` (`completed_at`) |

- Cupo, cuota, pago mínimo, tasa, fecha objetivo y estado archivado se toman con su **valor actual**. Es una aproximación documentada: archivar una deuda o cambiar un cupo cambia meses pasados.

### Datos suficientes

Un mes tiene score si se cumplen las dos condiciones. Si no, muestra "Sin datos suficientes" con cada motivo que falte:

| Condición                                | Motivo si falla                                    |
| ---------------------------------------- | -------------------------------------------------- |
| `Σ ingresos de la ventana > 0`           | "Registra tus ingresos"                            |
| Primer movimiento ≤ referencia − 30 días | "Necesitamos 30 días de registros (faltan N días)" |

### Factores

Cada factor da de 0 a 100 puntos por interpolación lineal entre los puntos de la tabla (con tope en los extremos).

| Factor (`key`)                      | Peso | Dato                                                       | Curva                                                   | Excluido si                  |
| ----------------------------------- | ---- | ---------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| Tasa de ahorro (`savings_rate`)     | 25   | `(ingresos − gastos) / ingresos` de la ventana             | ≤ 0 % → 0; ≥ 20 % → 100                                 | nunca                        |
| Deuda / ingresos (`debt_to_income`) | 20   | `Σ pago requerido / ingreso mensual`                       | ≤ 15 % → 100; ≥ 50 % → 0. Sin deudas consideradas → 100 | nunca                        |
| Colchón (`emergency_cushion`)       | 15   | `max(closing_balance, 0) / gasto promedio`, en meses       | 0 → 0; ≥ 6 → 100                                        | sin meses cerrados o gasto 0 |
| Presupuestos (`budgets`)            | 15   | `within_budget_count / budgeted_count` del mes `M`         | 0 % → 0; 100 % → 100                                    | sin presupuestos en `M`      |
| Utilización (`card_utilization`)    | 10   | `Σ saldos / Σ cupos` de tarjetas consideradas              | ≤ 10 % → 100; 30 % → 75; 70 % → 25; ≥ 100 % → 0         | sin tarjetas consideradas    |
| Metas (`goals`)                     | 10   | % de metas consideradas "En camino" a la referencia        | 0 % → 0; 100 % → 100                                    | sin metas consideradas       |
| Regularidad (`regularity`)          | 5    | semanas de ventana con ≥ 1 movimiento / semanas de ventana | 0 % → 0; 100 % → 100                                    | nunca                        |

- **Pago requerido** por deuda: `min(cuota o pago mínimo, saldo al fin de M)`, como en el SPEC 06. Una tarjeta sin pago mínimo suma 0.
- **"En camino"** usa la regla del SPEC 05 con hoy = referencia y el ahorrado al fin de `M`.
- **Score:** `round(Σ (peso × puntos) / Σ pesos incluidos)`, de 0 a 100.
- Ejemplo de utilización: 50 % → 50 puntos.

### Bandas

| Score    | Banda     | Color |
| -------- | --------- | ----- |
| 0 – 39   | Débil     | rojo  |
| 40 – 59  | Regular   | ámbar |
| 60 – 79  | Bueno     | sky   |
| 80 – 100 | Excelente | verde |

- **Variación:** score de `M` − score de `M − 1`, en puntos. "—" si el anterior no tiene score.
- **Histórico:** los 12 meses hasta el actual. Un mes sin datos suficientes queda como hueco en la línea.

### Ejemplo de score

Hoy 30 de octubre de 2026. Primer movimiento el 1 de agosto. Ingresos de 4.000.000 y gastos de 3.400.000 en agosto, septiembre y octubre, con al menos un movimiento cada semana. Un préstamo activo con cuota 600.000 y saldo mayor. Sin presupuestos, tarjetas ni metas.

| Factor                           | Dato                               | Puntos | Peso |
| -------------------------------- | ---------------------------------- | ------ | ---- |
| Ahorro                           | 1.800.000 / 12.000.000 = 15 %      | 75     | 25   |
| Deuda                            | 600.000 / 4.000.000 = 15 %         | 100    | 20   |
| Colchón                          | 1.800.000 / 3.400.000 = 0,53 meses | 8,82   | 15   |
| Regularidad                      | 100 %                              | 100    | 5    |
| Presupuestos, utilización, metas | excluidos                          | —      | —    |

Score = `(25 × 75 + 20 × 100 + 15 × 8,82 + 5 × 100) / 65` = 69,34 → **69, Bueno**.

### Reglas de recomendación

En `src/features/score/recommendations.ts`. Todas se evalúan sobre hoy y el mes actual, aunque el score esté "Sin datos suficientes". Cada regla tiene su condición de datos.

| #   | Regla (`rule`)        | Condición                                                                                                                                                                                 | Dato (ejemplo)                                                                  | Monto                        | Severidad | Enlace                                   | `entity_key`                                |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------- | --------- | ---------------------------------------- | ------------------------------------------- |
| 1   | `deficit`             | Último mes cerrado con gastos > ingresos                                                                                                                                                  | "En septiembre gastaste $ 400.000 más de lo que ingresaste"                     | déficit                      | alta      | Reportes de ese mes                      | `YYYY-MM`                                   |
| 2   | `category_growth`     | Hay 3 meses completos antes del último cerrado. Gasto de una categoría en el último cerrado ≥ 130 % de su promedio de esos 3 meses (> 0) y la diferencia ≥ 5 % del gasto mensual promedio | "Comida: $ 1.300.000 en septiembre vs. $ 1.000.000 de promedio (+30 %)"         | diferencia                   | media     | Movimientos de esa categoría y mes       | `category_id`                               |
| 3   | `budget_exceeded`     | Presupuesto del mes actual con gastado ≥ 100 %                                                                                                                                            | "Ocio: gastaste $ 600.000 de $ 500.000 (120 %)"                                 | exceso                       | alta      | Presupuestos                             | `category_id`                               |
| 4   | `goal_at_risk`        | Meta activa "En riesgo" (SPEC 05)                                                                                                                                                         | "Viaje: llevas $ 400.000; a hoy deberías llevar $ 500.000"                      | esperado − ahorrado          | media     | Metas                                    | `goal_id`                                   |
| 5   | `high_utilization`    | Tarjeta activa con utilización ≥ 70 %                                                                                                                                                     | "Visa: usas 82 % de $ 5.000.000"                                                | saldo − 30 % del cupo        | media     | Deudas                                   | `debt_id`                                   |
| 6   | `highest_rate_first`  | ≥ 2 tarjetas o préstamos activos con saldo > 0 y tasa > 0. Señala la de mayor tasa mensual `r`                                                                                            | "Crédito libre tiene la tasa más alta (2,3 % mensual). Abona extra ahí primero" | interés del mes de esa deuda | baja      | Deudas                                   | `debt_id`                                   |
| 7   | `overdue_payment`     | Deuda con estado "Vencido" (SPEC 06) u ocurrencia de gasto fijo vencida en "Próximos pagos" (SPEC 04)                                                                                     | "Arriendo venció el 5 de octubre ($ 1.200.000)"                                 | pago requerido o monto       | alta      | Deudas o Presupuestos (`?tab=recurring`) | `debt:<id>` o `recurring:<id>:<YYYY-MM-DD>` |
| 8   | `low_cushion`         | Factor colchón incluido y < 3 meses                                                                                                                                                       | "Tu balance cubre 0,5 meses de gastos"                                          | 3 × gasto promedio − balance | media     | Metas                                    | `workspace`                                 |
| 9   | `unbudgeted_spending` | ≥ 2 categorías con gastos en el mes actual y sin presupuesto                                                                                                                              | "4 categorías con gastos este mes no tienen presupuesto: Comida, Ocio…"         | Σ gasto de esas categorías   | baja      | Presupuestos                             | `workspace`                                 |
| 10  | `irregular_records`   | Regularidad del mes actual < 50 % (solo con datos suficientes)                                                                                                                            | "Registraste movimientos en 5 de 13 semanas"                                    | 0                            | baja      | Movimientos                              | `workspace`                                 |

- **Orden:** severidad (alta, media, baja) y luego monto descendente. Las 3 primeras no ocultas van al Resumen.
- **Ocultar este mes:** inserta `(rule, entity_key, month = mes actual)`. La recomendación pasa a "Ocultas este mes". El mes siguiente vuelve si la condición sigue.
- **Mostrar de nuevo:** borra la fila.
- Una fila oculta cuya condición ya no se cumple no se muestra en ningún lado.

## Plan de implementación

1. **Migración.**
   - Crear la migración con la tabla, RLS y las tres RPC.
   - Aplicarla con `supabase db push` y regenerar `src/types/database.ts`.
   - Verificar en la BD: `score_monthly_inputs` rellena meses vacíos con ceros; `score_balances` no devuelve una deuda en meses anteriores a su creación; con un espacio ajeno las tres devuelven vacío.
2. **Cálculos del score.**
   - `src/features/score/types.ts` y `src/features/score/constants.ts` (pesos, puntos de las curvas, bandas, umbrales de reglas).
   - `src/features/score/calculations.ts`: interpolación, ventana, datos suficientes, cada factor, score, banda y variación. Funciones puras que reciben los insumos ya consultados.
3. **Consultas.**
   - `src/features/score/queries.ts`: `getScoreInputs(workspaceId, from, to)` (las tres RPC, `debt_overview`, `goal_progress` y el primer movimiento, con `Number()` en los `numeric`), `getScoreHistory(workspaceId)` (12 meses) y `getDismissedRecommendations(workspaceId, month)`.
4. **Reglas.**
   - `src/features/score/recommendations.ts`: las 10 reglas, el orden y el filtro de ocultas. Usa `category_totals`, `budget_progress` y `recurring_occurrences` para el mes actual, y los cálculos de estado de `src/features/goals` y `src/features/debts`.
5. **Acciones.**
   - `src/features/score/actions.ts` (`"use server"`): `dismissRecommendation(rule, entityKey)` y `restoreRecommendation(rule, entityKey)`, validadas con Zod contra las claves de regla y el workspace Personal del usuario, con `revalidatePersonalPages()`.
6. **Página de Recomendaciones.**
   - `app/dashboard/personal/recommendations/page.tsx` reemplaza el placeholder, con `buildMetadata` `noindex` y `Suspense`.
   - `src/features/score/components/`:
     - `score-overview.tsx`: número, banda, variación y "Calculado con tus datos hasta hoy";
     - `score-factors.tsx`: cada factor con peso, dato, barra de puntos y, si está excluido, su motivo;
     - `score-history-chart.tsx` (Recharts): línea de 12 meses con huecos, `aria-label` y tabla `sr-only` como las gráficas del SPEC 03;
     - `recommendation-list.tsx` y `recommendation-item.tsx`: badge de severidad, título, dato, botón "Ir a …" y "Ocultar este mes";
     - `hidden-recommendations.tsx`: sección plegable "Ocultas este mes" con "Mostrar de nuevo";
     - `score-insufficient.tsx`: "Sin datos suficientes" con los motivos.
7. **Tarjeta del Resumen.**
   - `src/features/score/components/score-summary-card.tsx`: "Salud financiera" con score, banda, variación, las 3 recomendaciones principales y "Ver todas".
   - Se monta en `app/dashboard/personal/page.tsx` dentro de `Suspense`, antes de `SummaryCards`, solo cuando hay movimientos.
8. **Estados vacíos.**
   - Sin recomendaciones activas: "Todo en orden por ahora" en la página y en la tarjeta del Resumen.
   - Score sin datos: los motivos, en la página y en la tarjeta del Resumen.
   - Histórico sin ningún mes con score: "Aún no hay histórico".
9. **Docs.**
   - `docs/producto.md`: sección "Score y recomendaciones" con periodo, datos suficientes, factores, pesos, curvas, bandas, reglas y la aproximación del histórico. Agrega `dismissed_recommendations` a la tabla del modelo de datos.
   - `ROADMAP.md`: respuestas a las preguntas abiertas del SPEC 07.
   - `CHANGELOG.md` `[Unreleased]` (en inglés).

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm install --frozen-lockfile` funciona y las dependencias nuevas tienen versión exacta.
- [ ] La migración se aplica sin errores y `src/types/database.ts` incluye `dismissed_recommendations`, `score_monthly_inputs`, `score_weekly_activity` y `score_balances`.
- [ ] Con los datos del "Ejemplo de score", `/dashboard/personal/recommendations` muestra 69, "Bueno", y los factores con 75, 100, 8,82 (o 9 redondeado en la UI) y 100 puntos. Presupuestos, utilización y metas aparecen como excluidos con su motivo.
- [ ] Agregar a ese ejemplo una tarjeta con cupo 2.000.000 y saldo 1.000.000 (50 %) muestra utilización con 50 puntos y recalcula el score con peso total 75.
- [ ] Un espacio cuyo primer movimiento es de hace 10 días muestra "Sin datos suficientes" con "Necesitamos 30 días de registros (faltan 20 días)".
- [ ] Un espacio con 60 días de movimientos y solo gastos muestra "Sin datos suficientes" con "Registra tus ingresos".
- [ ] Sin deudas, el factor deuda / ingresos da 100. Un pago requerido igual al 50 % del ingreso mensual da 0.
- [ ] Una tasa de ahorro negativa da 0 puntos en ahorro y un colchón con balance acumulado negativo da 0 meses.
- [ ] El histórico muestra 12 meses; los meses sin datos suficientes quedan como hueco.
- [ ] Editar el monto de un movimiento de hace 2 meses cambia el score de ese mes en el histórico al recargar.
- [ ] La variación muestra la diferencia en puntos con el mes anterior, o "—" si ese mes no tiene score.
- [ ] Cada banda usa su etiqueta y color: 39 "Débil", 40 "Regular", 79 "Bueno", 80 "Excelente".
- [ ] Un mes cerrado con gastos > ingresos genera "deficit" con el dato del monto y enlace a Reportes de ese mes.
- [ ] Una categoría con 1.000.000 de promedio en junio–agosto y 1.300.000 en septiembre, con gasto mensual promedio de 4.000.000, genera "category_growth" con "+30 %". Con 1.250.000 no la genera.
- [ ] Un presupuesto del mes actual con gastado ≥ 100 % genera "budget_exceeded" con enlace a Presupuestos.
- [ ] Una meta "En riesgo" genera "goal_at_risk"; una "En camino" no.
- [ ] Una tarjeta al 82 % genera "high_utilization"; una al 69 % no.
- [ ] Con dos préstamos al 1,5 % y 2,3 % M.V., "highest_rate_first" señala el de 2,3 %. Con una sola deuda con tasa no aparece.
- [ ] Una deuda "Vencida" y una ocurrencia de gasto fijo vencida generan cada una su "overdue_payment" con enlace a Deudas y a `?tab=recurring`.
- [ ] El ejemplo de score genera "low_cushion" con "Tu balance cubre 0,5 meses de gastos".
- [ ] Gastos este mes en 2 categorías sin presupuesto generan "unbudgeted_spending"; en 1 no.
- [ ] Movimientos en menos de la mitad de las semanas de la ventana generan "irregular_records".
- [ ] Las recomendaciones se ordenan por severidad y luego por monto descendente.
- [ ] Cada recomendación muestra el dato en que se basa y su botón "Ir a …" abre la ruta indicada en la tabla de reglas.
- [ ] "Ocultar este mes" mueve la recomendación a "Ocultas este mes", la saca del Resumen y la reemplaza por la siguiente. "Mostrar de nuevo" la devuelve.
- [ ] Una fila de `dismissed_recommendations` de un mes anterior no oculta la recomendación en el mes actual.
- [ ] Resumen muestra "Salud financiera" antes de las tarjetas del SPEC 03, con score, banda, variación, hasta 3 recomendaciones y "Ver todas" hacia `/dashboard/personal/recommendations`.
- [ ] Sin recomendaciones activas, la página y el Resumen muestran "Todo en orden por ahora".
- [ ] Registrar un movimiento, pago, aporte o presupuesto actualiza el score y las recomendaciones sin recargar a mano.
- [ ] Un usuario A, con su sesión y la clave publicable, no puede leer, crear ni borrar filas de `dismissed_recommendations` de B, y las tres RPC con el workspace de B devuelven vacío.
- [ ] Un cliente `anon` no puede ejecutar las tres RPC.
- [ ] `dismissRecommendation` con una regla inexistente devuelve un error de validación y no escribe en la BD (también falla el `check` de la BD).

## Decisiones

- **Sí:** 7 factores con pesos 25 / 20 / 15 / 15 / 10 / 10 / 5. Ahorro y deuda pesan más porque son lo que más mueve la salud financiera; regularidad pesa poco porque mide el registro, no las finanzas.
- **No:** 5 factores o pesos iguales. Dejan fuera datos de SPEC 05 o sobreponderan la regularidad.
- **Sí:** un factor sin datos se excluye y los pesos se reescalan. Un usuario sin tarjetas no es penalizado ni premiado.
- **Sí:** sin deudas, deuda / ingresos da 100 (no se excluye). No deber es un buen dato.
- **Sí:** deuda / ingresos con pagos requeridos mensuales (cuotas y mínimos), no con el saldo total. Es la medida usual de capacidad de pago.
- **Sí:** colchón = balance acumulado / gasto promedio de 3 meses cerrados. No hay cuentas bancarias y los aportes a metas no restan del balance (SPEC 05).
- **No:** colchón por metas o por una meta marcada como fondo. Depende de usar metas o toca el modelo del SPEC 05.
- **Sí:** ventana móvil de 3 meses para ahorro, deuda e ingresos. Suaviza el mes en curso (el salario puede llegar el 30) y registrar hoy igual mueve el score.
- **No:** solo el mes `M` o solo meses cerrados. Uno es ruidoso; el otro no reacciona hasta el mes siguiente.
- **Sí:** cálculo al vuelo, sin `score_snapshots`. Todo dato tiene fecha; el histórico nunca queda desfasado al corregir datos viejos.
- **No:** snapshot de mes cerrado o cron. Congela errores y agrega infraestructura.
- **Sí:** insumos en RPC SQL y cálculo en TS puro. Las sumas se hacen en Postgres, como en el SPEC 03; las curvas y reglas son fáciles de leer y probar en TS.
- **Sí:** histórico aproximado con valores actuales de cupo, tasa, fecha objetivo y archivado, documentado en `docs/producto.md`.
- **No:** `archived_at` en metas y deudas. Toca SPEC 05 y 06 por una precisión que el usuario casi no nota.
- **Sí:** "Sin datos suficientes" con ingresos > 0 en la ventana y 30 días desde el primer movimiento, mostrando qué falta.
- **No:** score desde el primer ingreso o tras un mes cerrado. Sale extremo o tarda demasiado.
- **Sí:** 4 bandas (Débil, Regular, Bueno, Excelente) e histórico de 12 meses. Un año muestra tendencia sin cargar de más.
- **Sí:** umbrales de utilización 30 % y 70 % y de presupuesto 100 %, alineados con SPEC 04 y 06.
- **Sí:** 10 reglas fijas con su dato y su enlace. Explicables y sin costo por consulta.
- **No:** IA o LLM. Fuera del alcance del producto en esta etapa.
- **Sí:** orden por severidad fija y luego monto. Lo vencido y el déficit van primero; el monto desempata con algo concreto.
- **No:** orden por peso del factor. Pondría un pago vencido por debajo de la utilización.
- **Sí:** "Ocultar este mes" con `dismissed_recommendations` por regla, entidad y mes, y "Mostrar de nuevo". Baja el ruido sin esconder problemas que siguen.
- **No:** descartar para siempre. Ocultaría problemas que empeoran.
- **Sí:** las reglas se evalúan aunque el score esté sin datos. Un presupuesto excedido o un pago vencido no necesitan 30 días de historia.
- **Sí:** tarjeta "Salud financiera" arriba del Resumen. Es el resumen del resumen.

## Riesgos

| Riesgo                                                                | Mitigación                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Calcular 12 meses al vuelo hace la página lenta                       | Tres RPC con todos los meses en una sola llamada cada una; el cálculo en TS es lineal. La página y la tarjeta van en `Suspense` |
| Archivar una deuda o cambiar un cupo cambia el score de meses pasados | Aproximación documentada en `docs/producto.md` y en las decisiones                                                              |
| Los movimientos con fecha futura inflan el mes actual                 | Mismo criterio que `monthly_totals` (SPEC 03); la regularidad solo cuenta movimientos ≤ hoy                                     |
| El balance acumulado no es dinero real disponible                     | El factor se llama "Colchón" y su dato dice "Tu balance cubre N meses de gastos"; documentado como estimación                   |
| Una tarjeta sin pago mínimo no suma a deuda / ingresos                | Documentado; la utilización sí la mide                                                                                          |
| Reglas que se disparan con montos pequeños                            | `category_growth` exige una diferencia ≥ 5 % del gasto mensual; el resto usa umbrales de SPEC 04 a 06                           |
| Una entidad borrada deja una fila oculta huérfana                     | Las filas son por mes y no se muestran si la condición no se cumple; no requieren limpieza                                      |
| "Hoy" y los meses cambian según la zona horaria del servidor          | Se calculan siempre en `America/Bogota`, igual que en SPEC 02 a 06                                                              |
| `cacheComponents` exige `Suspense` alrededor de lecturas dinámicas    | Página y tarjeta leen sesión y fecha dentro de `Suspense`. Antes de implementar se consulta `node_modules/next/dist/docs/`      |
| `numeric` llega como `number` o `string`                              | Las consultas convierten con `Number()`                                                                                         |

## Lo que **no** entra en este spec

- Recomendaciones con IA o LLM.
- Alertas por email o push.
- Score de Empresa (SPEC 11).
- Snapshots del score o cron.
- Descartar recomendaciones para siempre.
- Pesos o umbrales configurables.
- `archived_at` en metas y deudas.
- Comparación con otros usuarios.
- Explicación del score en la landing (SPEC 12).

Cada uno de esos puntos, si llega, va en su propio spec.
