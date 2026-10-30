# Producto

Visión y alcance de Tesoro. Este documento describe **qué** se construye; el
**cómo** se decide al implementar cada módulo.

## Principios

- **Parte de tus registros**: Tesoro no exige configurar nada desde cero ni
  conectar un banco. Cada gráfica, recomendación y score se calcula a partir de
  los movimientos que el usuario registra.
- **Claridad antes que cantidad**: pocas métricas, bien explicadas y bien
  presentadas.
- **Privacidad por defecto**: cada usuario solo ve sus datos (RLS en Supabase).
- **Código abierto**: licencia MIT, desplegable por cualquiera.

## Mapa de rutas

| Ruta                      | Qué es                                    | Indexable |
| ------------------------- | ----------------------------------------- | --------- |
| `/`                       | Landing                                   | Sí        |
| `/sign-in`                | Inicio de sesión                          | Sí        |
| `/sign-up`                | Registro                                  | Sí        |
| `/auth/callback`          | Callback de OAuth (Google, GitHub)        | No        |
| `/dashboard`              | Redirige a `/dashboard/personal`          | No        |
| `/dashboard/personal/...` | Espacio Personal (requiere sesión)        | No        |
| `/dashboard/business`     | Espacio Empresa (por ahora, estado vacío) | No        |

Las rutas viven en `SITE.routes` y la navegación del espacio Personal en
`SITE.navigation.personal`. `robots.ts` bloquea `/dashboard/`, `/api/` y
`/auth/`, y `proxy.ts` exige sesión en `/dashboard/*`. Los slugs van en inglés
(`/transactions`, `/budgets`, `/goals`, `/debts`, `/reports`,
`/recommendations`); la UI, en español. En el futuro, cada empresa vivirá en
`/dashboard/business/[id]/...`, para que la URL refleje el espacio activo.

## Landing

Presenta el producto y lleva a crear cuenta: propuesta de valor, funciones
(`SITE.features`), explicación del score, sección de código abierto y CTA a
`/sign-up`.

## Autenticación

Supabase Auth con tres métodos:

- **Email y contraseña**: registro con nombre, email y contraseña (mínimo 8
  caracteres). No se pide confirmar el email.
- **Google** y **GitHub** (OAuth), con callback en `/auth/callback`. El nombre
  y el avatar salen del proveedor.

Al registrarse, por cualquier método, el usuario recibe automáticamente su
perfil y su espacio _Personal_. Quien ya tiene sesión y entra a `/sign-in` o
`/sign-up` va directo al dashboard; quien no la tiene y entra al dashboard va a
`/sign-in?next=<ruta>` y vuelve a esa ruta al iniciar sesión.

Quedan para un spec futuro: confirmar el email, recuperar la contraseña y el
magic link.

## Modelo de datos

Las migraciones viven en `supabase/migrations/`. Toda tabla con datos de
usuario tiene RLS.

| Tabla                       | Qué guarda                                                                                           | RLS (cliente)                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `profiles`                  | Un perfil por usuario: `full_name`, `avatar_url`, `currency` (COP por defecto)                       | `select` y `update` del propio perfil  |
| `workspaces`                | Espacios del usuario: `type` (`personal` / `business`) y `name`                                      | `select` de los propios                |
| `categories`                | Categorías de ingreso o gasto: del sistema (`workspace_id` null) o propias                           | `select`, `insert` y `update`          |
| `transactions`              | Movimientos: `type`, `amount`, `occurred_on`, `category_id`, `description`, `note`                   | `select`, `insert`, `update`, `delete` |
| `recurring_expenses`        | Gastos fijos: `name`, `amount`, `category_id`, `frequency`, día y mes de pago, vigencia, `is_active` | `select`, `insert`, `update`, `delete` |
| `budgets`                   | Presupuesto por categoría de gasto y mes (`month` = primer día), único por categoría y mes           | `select`, `insert`, `update`, `delete` |
| `savings_goals`             | Metas de ahorro: `name`, `target_amount`, `target_date` opcional, `icon`, `color`, `status`          | `select`, `insert`, `update`           |
| `goal_contributions`        | Aportes (`amount` > 0) y retiros (`amount` < 0) de una meta, con `occurred_on` y `note`              | `select`, `insert`, `update`, `delete` |
| `dismissed_recommendations` | Recomendaciones ocultas: `rule`, `entity_key` y `month` en que se ocultaron, únicas por los tres     | `select`, `insert`, `delete`           |

- Cada usuario tiene **un solo** espacio Personal (índice único parcial) y, en
  el futuro, Empresas ilimitadas.
- El trigger `on_auth_user_created` (función `handle_new_user`, `security
definer`) crea el perfil y el espacio Personal al insertar en
  `auth.users`. Por eso el cliente no tiene políticas de `insert` ni `delete`.
- Los datos de cada módulo (movimientos, metas, deudas…) cuelgan de
  `workspace_id`. Sus políticas RLS usan la función
  `is_workspace_owner(workspace_id)` (`security invoker`), y el trigger
  reutilizable `set_updated_at()` mantiene `updated_at`.

## Dashboard

Layout con **aside** de navegación. En la parte superior del aside hay un
selector tipo tab para cambiar de espacio:

- **Personal** (por defecto): siempre existe, con su estructura completa.
- **Empresa**: si el usuario no tiene uno, el dashboard muestra un estado vacío
  que lo invita a crear su espacio de empresa.

Los espacios están definidos en `SITE.workspaces`.

### Espacio Personal

- Resumen: balance, ingresos vs. gastos del mes, score
- Movimientos: ingresos y gastos con categorías
- Presupuestos por categoría y gastos fijos
- Metas de ahorro
- Deudas
- Reportes y gráficas
- Recomendaciones

### Espacio Empresa

- Resumen: flujo de caja, utilidad, score
- Ventas e ingresos
- Costos y gastos operativos
- Reportes y gráficas
- Recomendaciones

## Movimientos y categorías

Página `/dashboard/personal/transactions`. Los movimientos son la materia prima
de gráficas, presupuestos, metas, deudas y score.

### Movimientos

- Tipo (`income` / `expense`), monto, fecha, categoría, descripción (1 a 120
  caracteres) y nota opcional (hasta 500).
- Montos en `numeric(14, 2)`, mayores que 0 y hasta 999.999.999.999,99. La UI
  de COP los muestra sin decimales con `Intl.NumberFormat("es-CO")`, y el
  formulario acepta el formato `1.500.000` o `1500000,50`.
- Fechas `date` sin hora. Se permiten fechas futuras. "Hoy" y "mes actual" se
  calculan siempre en `America/Bogota`.
- Se crean y editan en un diálogo, y se eliminan con confirmación. Al editar se
  puede cambiar el tipo; eso limpia la categoría.
- El botón "Nuevo movimiento" del header, visible solo en
  `/dashboard/personal/*`, abre el mismo diálogo desde cualquier página.

### Categorías

- **Del sistema** (fijas, visibles para todos, no editables ni ocultables):
  - Ingresos: Salario, Freelance, Otros ingresos.
  - Gastos: Vivienda, Comida, Transporte, Salud, Educación, Ocio, Servicios,
    Compras, Otros gastos.
- **Propias** por espacio: crear, renombrar, cambiar icono y color, archivar y
  restaurar, desde el Sheet "Categorías" de Movimientos. El tipo no cambia
  después de crearlas.
- No se borran (FK `on delete restrict`, sin política `delete`): los
  movimientos históricos nunca pierden su categoría.
- Nombre único por espacio y tipo, sin distinguir mayúsculas.
- Icono de un set curado (`CATEGORY_ICONS`) y color de una paleta fija
  (`CATEGORY_COLORS`), guardados como claves.
- Una categoría archivada no aparece al crear movimientos. Sus movimientos la
  conservan, se puede guardar un movimiento que ya la tenía, y en el filtro
  aparece al final como "(archivada)".
- El trigger `check_transaction_category` garantiza en la BD que la categoría
  tenga el mismo tipo que el movimiento y sea del sistema o del mismo espacio.

### Tabla, filtros y totales

- Tabla paginada por URL, 20 por página, ordenada por `occurred_on desc,
created_at desc`.
- Totales (ingresos, gastos y balance) de todo el periodo filtrado, calculados
  en Postgres con la RPC `transaction_totals` (`security invoker`).
- Filtros en la URL; cambiar uno vuelve a la página 1:

| Parámetro  | Valores                    | Por defecto                    |
| ---------- | -------------------------- | ------------------------------ |
| `month`    | `YYYY-MM` o `all`          | mes actual en `America/Bogota` |
| `type`     | `income`, `expense`        | sin filtro                     |
| `category` | uuid                       | sin filtro                     |
| `q`        | texto (descripción y nota) | sin filtro                     |
| `page`     | entero ≥ 1                 | `1`                            |

- La búsqueda es `ilike` sobre descripción y nota, sin distinguir mayúsculas y
  escapando `%` y `_`.
- Estados vacíos: sin ningún movimiento, una invitación a registrar el primero;
  con filtros sin resultados, "No hay movimientos con estos filtros" y un
  enlace para limpiarlos (o ver todos los meses, si solo se filtra por mes).

## Resumen y reportes

Páginas `/dashboard/personal` (Resumen) y `/dashboard/personal/reports`
(Reportes). Convierten los movimientos en tarjetas, gráficas y tablas.

### Reglas de agregación

- Todo total se calcula en Postgres con funciones RPC `security invoker`, que
  respetan RLS. Con un espacio ajeno devuelven ceros o vacío, y `anon` no las
  puede ejecutar.
  - `monthly_totals(workspace, from, to)`: ingresos, gastos y número de
    movimientos por mes. Rellena con ceros los meses sin movimientos.
  - `category_totals(workspace, from, to, type)`: total y número de
    movimientos por categoría en un rango de fechas inclusivo, ordenado por
    total descendente. Incluye las categorías archivadas.
  - `workspace_balance(workspace)`: ingresos menos gastos de toda la historia.
- Mes calendario en `America/Bogota`. Los movimientos con fecha futura cuentan
  en el mes de su fecha, igual que en Movimientos.
- Colores: cada categoría usa en las gráficas el mismo color que su badge
  (`CATEGORY_CHART_COLORS`, variables `--category-*` con tono 500 en claro y
  400 en oscuro). Ingresos en emerald, gastos en rose y balance en sky.
  "Otras" usa el gris de texto secundario.
- Cada gráfica tiene `aria-label`, una tabla `sr-only` con sus datos y tooltip
  navegable con teclado.

### Métricas del Resumen

Siempre sobre el mes actual. "Anterior" es el mes anterior completo.

| Tarjeta                  | Cálculo                                                | Sin datos                     |
| ------------------------ | ------------------------------------------------------ | ----------------------------- |
| Ingresos / Gastos        | Total del mes; variación % vs. anterior                | Variación "—" si anterior = 0 |
| Balance                  | Ingresos − gastos; variación como diferencia en dinero | Diferencia contra 0           |
| Tasa de ahorro           | Balance / ingresos × 100, puede ser negativa           | "—" si ingresos = 0           |
| Gasto promedio diario    | Gastos del mes / días transcurridos (hoy incluido)     | `$ 0`                         |
| Proyección de gasto      | Promedio diario × días del mes                         | `$ 0`                         |
| Categoría de mayor gasto | Categoría con más gasto en el mes                      | "—"                           |
| Balance acumulado        | Ingresos − gastos de toda la historia                  | `$ 0`                         |
| Movimientos del mes      | Número de movimientos del mes                          | `0`                           |

- En gastos el color de la variación se invierte: subir es rojo y bajar es
  verde.
- Debajo de las tarjetas: ingresos vs. gastos de los últimos 6 meses (incluido
  el actual), dona de gastos por categoría del mes (top 6 + "Otras") y los
  últimos 5 movimientos, con enlace a Movimientos.
- Entre las tarjetas y las gráficas: "Próximos pagos" y "Presupuestos en
  riesgo" (ver [Gastos fijos y presupuestos](#gastos-fijos-y-presupuestos)).

### Periodos de Reportes

Periodo y tipo viven en la URL, así un enlace se puede compartir y recargar:

| Parámetro | Valores                                     | Por defecto              |
| --------- | ------------------------------------------- | ------------------------ |
| `period`  | `month`, `quarter`, `year`, `range`         | `month`                  |
| `value`   | `YYYY-MM`, `YYYY-Qn` o `YYYY` según periodo | periodo actual en Bogotá |
| `from`    | `YYYY-MM-DD` (solo `range`)                 | —                        |
| `to`      | `YYYY-MM-DD` (solo `range`)                 | —                        |
| `type`    | `expense`, `income`                         | `expense`                |

- Cualquier valor inválido cae a su valor por defecto. Un rango con fechas
  inválidas, `from > to` o más de 24 meses muestra un aviso y cae al mes
  actual.
- La tendencia siempre agrupa por mes (barras de ingresos y gastos, línea de
  balance) y no cambia con el tipo.
- El toggle Gastos/Ingresos cambia la dona (top 6 + "Otras"), el top 5 en
  barras horizontales y la tabla resumen.
- La tabla muestra por categoría el total, el % del total del tipo (redondeado
  para que sume 100), el número de movimientos y el promedio por movimiento.
  Cada fila abre Movimientos filtrado por categoría y tipo, en ese mes si el
  periodo es un mes o en todos los meses si no.
- Estados vacíos: sin ningún movimiento, una invitación a registrar el primero;
  periodo sin movimientos, "No hay movimientos en este periodo"; tipo sin
  datos, "No hay gastos/ingresos en este periodo".

## Gastos fijos y presupuestos

Página `/dashboard/personal/budgets` con dos tabs: **Presupuestos** (por
defecto) y **Gastos fijos**. Las dos son la planificación del mes: lo que se
quiere gastar como máximo y lo que se debe pagar.

| Parámetro | Valores                | Por defecto                    |
| --------- | ---------------------- | ------------------------------ |
| `tab`     | `budgets`, `recurring` | `budgets`                      |
| `month`   | `YYYY-MM`              | mes actual en `America/Bogota` |

- `month` solo aplica a Presupuestos. Un valor inválido cae a su valor por
  defecto. Todos los meses, pasados y futuros, se pueden ver y editar.

### Gastos fijos

- Nombre (1 a 60 caracteres), monto (mismas reglas que movimientos), categoría
  de gasto activa, frecuencia `monthly` o `yearly`, día de pago (1 a 31), mes
  de pago (solo anuales), fecha de inicio y fecha de fin opcional (≥ inicio).
- Se pueden pausar y reanudar. Uno pausado no aparece en Próximos pagos ni en
  el comprometido de los presupuestos.
- Al eliminarlo, sus pagos se conservan en Movimientos con el enlace en `null`
  (`on delete set null` + trigger `check_transaction_recurring`).
- Las ocurrencias no se guardan: las calcula la RPC
  `recurring_occurrences(workspace, from, to)` con su pago, si existe.

Reglas de vencimiento:

| Frecuencia | Vencimiento                                   | Ejemplo                                       |
| ---------- | --------------------------------------------- | --------------------------------------------- |
| `monthly`  | `day_of_month` de cada mes                    | día 31 en noviembre → 30 de noviembre         |
| `yearly`   | `day_of_month` de `month_of_year` de cada año | 29 de febrero en 2027 → 28 de febrero de 2027 |

- Si el día no existe en el mes, el vencimiento cae en el último día del mes.
- La primera ocurrencia es el primer vencimiento ≥ `starts_on` y la última, el
  último ≤ `ends_on`.

Estado de una ocurrencia (fechas en `America/Bogota`):

| Estado  | Condición                  | Color  |
| ------- | -------------------------- | ------ |
| Pagado  | tiene movimiento enlazado  | verde  |
| Vencido | pendiente y `due_on < hoy` | rojo   |
| Hoy     | pendiente y `due_on = hoy` | ámbar  |
| Próximo | pendiente y `due_on > hoy` | neutro |

- **Próximos pagos** muestra todas las ocurrencias del mes actual y las
  impagas de los 2 meses anteriores, en orden de vencimiento.
- **Marcar como pagado** abre el diálogo de movimiento prellenado (gasto,
  monto, categoría, fecha = vencimiento, descripción = nombre). El monto se
  puede cambiar antes de guardar; si la categoría está archivada queda vacía
  con un aviso. Nada se crea sin confirmar.
- El pago es un movimiento con `recurring_expense_id` y `recurring_due_on`.
  Un índice único impide pagar dos veces la misma ocurrencia ("Este pago ya
  está registrado"). Borrar el movimiento devuelve la ocurrencia a pendiente.
  Editarlo desde Movimientos conserva el enlace, y debe seguir siendo un
  gasto.

### Presupuestos

- Monto por categoría de gasto y mes, sin categorías de ingreso ni archivadas.
  El total del mes es la suma de las categorías.
- La RPC `budget_progress(workspace, month)` devuelve por categoría el
  presupuesto, el **gastado** (gastos del mes, futuros incluidos) y el
  **comprometido** (ocurrencias pendientes de gastos fijos que vencen en el
  mes). También devuelve las categorías con gastos y sin presupuesto.
- Tarjetas: presupuestado, gastado (solo categorías con presupuesto) y
  restante = presupuestado − gastado, en rojo si es negativo.
- Cada fila tiene una barra con el gastado sólido y el comprometido rayado.

| Gastado / presupuestado | Etiqueta         | Color  |
| ----------------------- | ---------------- | ------ |
| < 80 %                  | —                | neutro |
| 80 % – 99 %             | Cerca del límite | ámbar  |
| ≥ 100 %                 | Excedido         | rojo   |

- El porcentaje se trunca: nunca dice 80 % antes de llegar al umbral.
- El comprometido no cambia el estado. Si gastado + comprometido llega al
  80 %, la fila dice "Con pagos pendientes llegarías al X %".
- **Copiar del mes anterior** solo crea los presupuestos que faltan
  (`on conflict do nothing`), omite categorías archivadas y nunca pisa montos
  ya definidos.
- **Sin presupuesto** lista las categorías con gastos en el mes y sin
  presupuesto, con un botón "Presupuestar".

### Widgets del Resumen

- **Próximos pagos:** hasta 5 ocurrencias pendientes, vencidas primero, con
  "Marcar como pagado".
- **Presupuestos en riesgo:** hasta 5 presupuestos del mes actual con gastado
  ≥ 80 %, de mayor a menor porcentaje.
- Ambos con enlace "Ver todos" a su tab.

### Seguridad

- RLS en `recurring_expenses` y `budgets` con `is_workspace_owner`.
- El trigger `check_expense_category` exige una categoría de gasto del sistema
  o del mismo espacio. `check_transaction_recurring` exige que un pago tenga
  fecha de vencimiento, sea un gasto y enlace un gasto fijo del mismo espacio.
- Las RPC son `security invoker` y solo las ejecuta `authenticated`. Con un
  espacio ajeno devuelven vacío.

## Metas de ahorro

Página `/dashboard/personal/goals`. Una meta es algo para lo que el usuario
aparta dinero: un viaje, un fondo de emergencia, una compra.

- Los aportes son **independientes de los movimientos**: no cambian el
  balance, los gastos, los presupuestos ni los reportes. El diálogo de aporte
  lo dice: "Los aportes no cambian tu balance ni tus movimientos".
- Un fondo de emergencia es una meta normal, sin tipo especial.
- Las metas no se eliminan: se archivan y se pueden reactivar. La historia de
  ahorro no se pierde.

### Modelo

- **Meta:** nombre (1 a 60 caracteres), monto objetivo (mismas reglas que
  movimientos), fecha objetivo opcional, icono y color de las paletas de
  categorías, y estado `active`, `completed` o `archived`.
- La fecha objetivo debe ser posterior a hoy al crear la meta o al cambiarla.
  Al editar otros campos, una fecha ya pasada se conserva.
- **Aporte:** monto con signo en una sola tabla (`> 0` aporte, `< 0` retiro),
  fecha hasta hoy (también antes de la creación de la meta) y nota opcional de
  hasta 120 caracteres. En el formulario se elige Aporte o Retiro y el monto
  se escribe positivo.
- Los aportes se pueden editar y eliminar desde el historial, solo mientras la
  meta está activa.
- La RPC `goal_progress(workspace)` devuelve cada meta, en cualquier estado,
  con `saved` (suma de sus aportes, 0 si no tiene) y `contributions_count`.

### Cálculos

Fechas en `America/Bogota`.

| Valor                   | Cálculo                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Progreso                | `saved / target_amount`, en porcentaje truncado. Puede pasar de 100 %                      |
| Faltante                | `max(target_amount − saved, 0)`                                                            |
| Meses restantes         | Meses desde el mes siguiente al actual hasta el de `target_date`, contando ambos; mínimo 1 |
| Aporte mensual sugerido | `faltante / meses restantes`. Solo con fecha y faltante > 0                                |
| Inicio                  | Fecha de `created_at` en `America/Bogota`                                                  |
| Esperado hoy            | `target_amount × (hoy − inicio) / (target_date − inicio)`, con tope en `target_amount`     |

- Si `target_date ≤ inicio`, el esperado es `target_amount`.
- Ejemplo: hoy 30 de octubre y fecha objetivo 15 de diciembre → 2 meses
  restantes (noviembre y diciembre). Fecha objetivo en el mes actual → 1.
- Ejemplo: "Viaje" de 3.000.000, creada el 1 de octubre con objetivo el 31 de
  marzo. El 30 de octubre, con 500.000 va "En camino" y el aporte sugerido es
  500.000 (2.500.000 / 5 meses). Con 400.000 va "En riesgo".
- Avance lineal desde la creación, sin margen. Los ahorros previos se
  registran como un primer aporte.

### Estados

| Estado    | Condición                                            | Color  |
| --------- | ---------------------------------------------------- | ------ |
| Cumplida  | `status = 'completed'`                               | verde  |
| Archivada | `status = 'archived'`                                | neutro |
| En camino | activa, con fecha y `saved ≥ esperado hoy`           | verde  |
| En riesgo | activa, con fecha y `saved < esperado hoy`           | ámbar  |
| —         | activa sin fecha: sin etiqueta, "Sin fecha objetivo" | neutro |

- Una meta activa con `target_date < hoy` y faltante > 0 está "En riesgo",
  muestra "La fecha objetivo ya pasó" y su aporte sugerido es el faltante
  completo.
- Con `saved ≥ target_amount`, una meta activa muestra "¡Lo lograste!" y
  "Marcar como cumplida" en lugar del aporte sugerido. Cumplirla es manual: un
  retiro posterior no la reabre sin que el usuario lo note.

### Transiciones

| Acción               | Desde                   | Hacia       | Efecto                 |
| -------------------- | ----------------------- | ----------- | ---------------------- |
| Marcar como cumplida | `active`                | `completed` | `completed_at = now()` |
| Archivar             | `active`, `completed`   | `archived`  | `completed_at = null`  |
| Reactivar            | `completed`, `archived` | `active`    | `completed_at = null`  |

- Las metas cumplidas y archivadas van en la sección plegable "Cumplidas y
  archivadas". No aceptan aportes y su Sheet es de solo lectura, con
  "Reactivar". Al reactivarlas, sus aportes siguen intactos.

### Página y Resumen

- Las metas activas se muestran en tarjetas, ordenadas por fecha objetivo (sin
  fecha al final). Cada tarjeta abre un Sheet con el resumen, "Aportar",
  "Retirar" y el historial de aportes.
- **Widget del Resumen:** "Metas de ahorro" con hasta 3 metas activas, de
  fecha más cercana primero, con barra, porcentaje, estado y "Ver todas". Como
  los widgets de Gastos fijos y presupuestos, solo aparece cuando hay
  movimientos.

### Seguridad

- RLS en `savings_goals` y `goal_contributions` con `is_workspace_owner`. Sin
  política `delete` en `savings_goals`: no hay forma de eliminar una meta desde
  el cliente.
- `goal_contributions` tiene `workspace_id` con FK compuesta
  `(goal_id, workspace_id)` a la meta: un aporte siempre es del mismo espacio
  que su meta.
- Trigger `check_goal_contribution` (`before`): la meta debe estar activa (en
  `delete`, la fila vieja), el aporte no cambia de meta y su fecha es ≤ hoy.
  Bloquea la fila de la meta para serializar aportes concurrentes.
- Trigger `check_goal_balance` (`after`): la suma de la meta nunca queda
  negativa tras un retiro, una edición o un borrado ("No puedes retirar más de
  lo ahorrado").
- `goal_progress` es `security invoker` y solo la ejecuta `authenticated`.

## Tarjetas de crédito y deudas

Página `/dashboard/personal/debts`, con dos tabs en la URL: **Debo**
(`?tab=debts`, por defecto) y **Me deben** (`?tab=receivables`). Un valor
inválido de `tab` cae a Debo.

- Tres tipos en una sola tabla: **tarjeta de crédito**, **préstamo** y
  **cuenta por cobrar** (lo que le deben al usuario). El tipo no cambia tras
  crear la deuda.
- Las compras con tarjeta son gastos al comprar (Movimientos). Por eso
  **pagar la tarjeta no crea un movimiento**: contaría el mismo consumo dos
  veces. El diálogo de pago de tarjeta lo dice.
- Un pago de préstamo puede crear un gasto en la categoría de sistema
  "Deudas" ("Pago <nombre>"), y un abono de cuenta por cobrar un ingreso en
  "Cobros" ("Abono <nombre>"). La casilla viene marcada por defecto; se
  desmarca para cargar pagos antiguos sin inflar los gastos.
- Las deudas no se eliminan: se marcan como pagadas, se archivan y se
  reactivan. La historia de pagos no se pierde.

### Modelo

- **Tarjeta:** nombre, entidad opcional, saldo inicial (≥ 0), cupo, día de
  pago, y opcionales tasa con su tipo, pago mínimo y día de corte.
- **Préstamo:** nombre, entidad opcional, saldo inicial (> 0), cuota, tasa
  (obligatoria, 0 permitido) con su tipo, día de pago, y opcionales monto
  original y plazo en meses (informativos).
- **Cuenta por cobrar:** nombre, deudor opcional, monto (> 0) y fecha
  esperada opcional. Sin tasa ni proyección.
- **Tasa:** porcentaje con coma decimal (`28,5`), E.A. (máximo 200 %) o M.V.
  (máximo 10 %).
- **Entradas** (`debt_entries`): pagos (monto > 0) y ajustes (monto con
  signo), con fecha hasta hoy y nota opcional de hasta 120 caracteres. Un
  pago de préstamo o un abono puede enlazar su movimiento (`transaction_id`).
- **Saldo:** no se guarda. Es `saldo inicial − Σ pagos + Σ ajustes`. Así
  editar un pago viejo no descuadra nada y el historial explica cada cambio.
  El saldo nunca queda negativo ni hay saldo a favor.
- **"Actualizar saldo":** el usuario escribe el saldo real (por ejemplo, el
  del extracto) y se crea un ajuste por la diferencia. Si es 0, "El saldo ya
  es ese". Corrige compras e intereses que el saldo no sube solo.
- Editar un pago enlazado copia su monto y fecha al movimiento; eliminarlo
  elimina el movimiento. Eliminar el movimiento desde Movimientos solo quita
  el enlace: el pago y el saldo siguen igual.

### Ciclo de pago

Tarjetas y préstamos. Fechas en `America/Bogota`. El vencimiento de cada mes
es `due_day`; si el día no existe en el mes, cae en el último día del mes
(igual que los gastos fijos).

| Fecha  | Cálculo                                        |
| ------ | ---------------------------------------------- |
| `D_n`  | Primer vencimiento ≥ hoy (próximo vencimiento) |
| `D_b`  | Vencimiento anterior a `D_n`                   |
| `D_bb` | Vencimiento anterior a `D_b`                   |
| Ciclo  | Σ pagos con fecha en `(D_b, hoy]`              |
| Previo | Σ pagos con fecha en `(D_bb, D_b]`             |

- Ejemplo: hoy 30 de octubre y día de pago 5 → `D_n` 5 de noviembre, `D_b` 5
  de octubre, `D_bb` 5 de septiembre. Con día de pago 31 → `D_n` 31 de
  octubre; los de noviembre y febrero caen el 30 y el 28.

### Cálculos

| Valor              | Cálculo                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Tasa mensual `r`   | E.A.: `(1 + i/100)^(1/12) − 1`. M.V.: `i/100`. Sin tasa: 0                     |
| Pago requerido     | `min(cuota o pago mínimo, saldo)`. Tarjeta sin pago mínimo: no hay             |
| Utilización        | `saldo / cupo`, en porcentaje truncado. Puede pasar de 100 %                   |
| Utilización global | `Σ saldos / Σ cupos` de las tarjetas activas                                   |
| Deuda total        | `Σ saldo` de tarjetas y préstamos activos                                      |
| Te deben           | `Σ saldo` de cuentas por cobrar activas                                        |
| Interés del mes    | `saldo × r` por deuda (en centavos); el encabezado suma las activas            |
| % pagado           | `(monto original − saldo) / monto original`, solo préstamos con monto original |
| % cobrado          | `(monto inicial − saldo) / monto inicial`                                      |

- Ejemplo: 26,82 % E.A. ≈ 2 % mensual.

### Proyección

Tarjetas y préstamos activos con saldo > 0.

- Pago `P`: la cuota del préstamo o el pago mínimo de la tarjeta. En el
  simulador "Si pagaras X al mes" del Sheet, el valor que escribe el usuario
  (no guarda nada).
- Mes a mes desde `D_n`: `interés = saldo × r` (redondeado a centavos),
  `saldo = saldo + interés − P`, hasta llegar a 0, con tope de 600 meses.
- Resultado: meses `n`, mes de pago total (mes de `D_n` + `n − 1`) e
  intereses totales. La tarjeta muestra "Terminas en octubre de 2027"; el
  Sheet, los tres valores.
- `P ≤ saldo × r`: "Con este pago la deuda no baja". Tope: "Más de 50 años".
  Tarjeta sin tasa: sin intereses, con el aviso "Sin tasa, la proyección no
  incluye intereses". Tarjeta sin pago mínimo: "Agrega el pago mínimo para
  ver la proyección" (el simulador sí funciona).
- Ejemplo: saldo 1.000.000, 2 % M.V., cuota 100.000, `D_n` 15 de noviembre
  de 2026 → 12 meses, termina en octubre de 2027, intereses `$ 127.033`.
- No usa el promedio de pagos reales ni el plazo del préstamo.

### Estados

Estado del próximo pago (tarjetas y préstamos activos con saldo > 0 y pago
requerido), evaluado en este orden:

| Estado    | Condición                                                                      | Fecha | Color  |
| --------- | ------------------------------------------------------------------------------ | ----- | ------ |
| Vencido   | ciclo previo < requerido, ciclo actual < requerido y la deuda existía en `D_b` | `D_b` | rojo   |
| Pagado    | ciclo actual ≥ requerido                                                       | `D_n` | verde  |
| Hoy       | `D_n = hoy`                                                                    | `D_n` | ámbar  |
| Pendiente | el resto                                                                       | `D_n` | neutro |

- "La deuda existía en `D_b`": su fecha de creación en `America/Bogota` ≤
  `D_b`. Una deuda recién creada no aparece vencida.
- Un pago tardío (después de `D_b`) quita el "Vencido" y cuenta para el ciclo
  actual, así que puede marcarlo "Pagado". La app no reparte pagos entre
  ciclos.
- Una tarjeta sin pago mínimo muestra solo la fecha, sin estado.

Utilización de una tarjeta (los umbrales siguen la referencia usual de las
centrales de riesgo):

| Rango       | Etiqueta  | Color |
| ----------- | --------- | ----- |
| < 30 %      | Saludable | verde |
| 30 % – 69 % | Moderada  | ámbar |
| ≥ 70 %      | Alta      | rojo  |

Etiquetas de la deuda:

| Estado                           | Tarjeta o préstamo | Cuenta por cobrar | Color  |
| -------------------------------- | ------------------ | ----------------- | ------ |
| `paid`                           | Pagada             | Cobrada           | verde  |
| `archived`                       | Archivada          | Archivada         | neutro |
| activa con fecha esperada pasada | —                  | Vencida           | ámbar  |
| activa con saldo 0               | Saldo en cero      | Saldo en cero     | verde  |

### Transiciones

| Acción             | Desde              | Hacia      | Condición | Efecto              |
| ------------------ | ------------------ | ---------- | --------- | ------------------- |
| Marcar como pagada | `active`           | `paid`     | saldo 0   | `closed_at = now()` |
| Archivar           | `active`, `paid`   | `archived` | —         | `closed_at = null`  |
| Reactivar          | `paid`, `archived` | `active`   | —         | `closed_at = null`  |

- El cierre es manual: una tarjeta en 0 se puede seguir usando. Con saldo > 0,
  "Marcar como pagada" falla con "La deuda aún tiene saldo".
- Archivar con saldo pide confirmación: "Esta deuda tiene saldo. Al
  archivarla sale de los totales y de los próximos pagos."
- Pagadas, cobradas y archivadas van en las secciones plegables "Pagadas y
  archivadas" y "Cobradas y archivadas". No cuentan en totales, utilización,
  interés, próximos pagos ni Resumen. No aceptan pagos ni ajustes y su Sheet
  es de solo lectura, con "Reactivar". Al reactivarlas, su historial sigue
  intacto.

### Página y Resumen

- **Debo:** totales (deuda total, utilización global, interés estimado del
  mes), "Próximos pagos" (vencidos primero y luego por fecha) y una tarjeta
  por deuda activa, ordenadas por próximo vencimiento.
- **Me deben:** total "Te deben" y una tarjeta por cuenta activa, ordenadas
  por fecha esperada (sin fecha al final).
- Cada tarjeta abre un Sheet con el detalle, la proyección y el simulador,
  "Registrar pago" (o "Registrar abono"), "Actualizar saldo" y el historial
  de pagos y ajustes, editable mientras la deuda está activa.
- **Widget del Resumen:** "Deudas" con la deuda total, la utilización global
  (si hay tarjetas activas) y hasta 3 próximos pagos, vencidos primero, con
  "Ver todas". Las cuentas por cobrar no aparecen. Como los demás widgets,
  solo se muestra cuando hay movimientos.

### Seguridad

- RLS en `debts` y `debt_entries` con `is_workspace_owner`. Sin política
  `delete` en `debts`.
- `debt_entries` tiene `workspace_id` con FK compuesta `(debt_id,
workspace_id)`: una entrada siempre es del mismo espacio que su deuda.
- Trigger `check_debt_update`: el tipo de una deuda no cambia.
- Trigger `check_debt_entry` (`before`): la deuda debe estar activa (en
  `delete`, la fila vieja), la entrada no cambia de deuda ni de tipo, la fecha
  es ≤ hoy, y un movimiento enlazado es un gasto de un préstamo o un ingreso
  de una cuenta por cobrar del mismo espacio. Una tarjeta nunca tiene
  movimiento. Quitar el enlace al borrar el movimiento se permite aunque la
  deuda no esté activa. Bloquea la fila de la deuda para serializar pagos
  concurrentes.
- Trigger `check_debt_balance` (`after`, en `debt_entries` y en
  `debts.opening_balance`): el saldo nunca queda negativo.
- Trigger `sync_debt_entry_transaction`: el pago manda sobre su movimiento.
- `debt_overview` y `record_debt_payment` son `security invoker` y solo las
  ejecuta `authenticated`. `record_debt_payment` crea el movimiento y el pago
  en una sola transacción.

## Score y recomendaciones

Página `/dashboard/personal/recommendations` y tarjeta "Salud financiera" en
el Resumen. El score resume la salud financiera del espacio Personal de 0 a
100; las recomendaciones dicen qué hacer, en qué dato se basan y enlazan a la
sección donde se resuelven.

- El score **se calcula al vuelo** y no se guarda. Todo dato tiene fecha, así
  que el histórico se reconstruye mes a mes: editar un movimiento viejo
  corrige también el histórico.
- Las sumas corren en Postgres (`score_monthly_inputs`,
  `score_weekly_activity`, `score_balances`, más `debt_overview` y
  `goal_progress`). Las curvas, el score y las reglas son funciones puras en
  `src/features/score/`.
- Las recomendaciones son **reglas fijas, sin IA**.

### Periodo de un mes

Fechas en `America/Bogota`. La **referencia** es hoy si `M` es el mes actual,
o el último día de `M` si es pasado.

| Concepto            | Definición                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Ventana             | De `max(M − 2 meses, mes del primer movimiento)` a `M`, inclusive (1 a 3 meses)                      |
| Ingreso mensual     | `Σ ingresos de la ventana / meses de ventana`                                                        |
| Meses cerrados      | Los 3 meses anteriores a `M`, desde el mes del primer movimiento                                     |
| Gasto promedio      | `Σ gastos de los meses cerrados / número de meses cerrados`                                          |
| Saldos              | Al fin de `M`: saldo de cada deuda, ahorrado de cada meta y balance acumulado (`closing_balance`)    |
| Semanas de ventana  | Semanas ISO (lunes) que tocan `[max(inicio de ventana, primer movimiento), referencia]`              |
| Deudas consideradas | Tarjetas y préstamos creados ≤ fin de `M`, sin archivar hoy y no pagados antes del fin de `M`        |
| Metas consideradas  | Metas con fecha objetivo, creadas ≤ fin de `M`, sin archivar hoy y no cumplidas antes del fin de `M` |

### Datos suficientes

Un mes tiene score si la ventana tiene ingresos > 0 y el primer movimiento es
de hace al menos 30 días (contra la referencia). Si no, muestra "Sin datos
suficientes" con cada motivo: "Registra tus ingresos" o "Necesitamos 30 días
de registros (faltan N días)".

### Factores y pesos

Cada factor da de 0 a 100 puntos por interpolación lineal entre los puntos de
su curva, con tope en los extremos. Un factor sin datos se **excluye** y los
pesos de los demás se reescalan.

| Factor                  | Peso | Dato                                                       | Curva                                           | Excluido si                  |
| ----------------------- | ---- | ---------------------------------------------------------- | ----------------------------------------------- | ---------------------------- |
| Tasa de ahorro          | 25   | `(ingresos − gastos) / ingresos` de la ventana             | ≤ 0 % → 0; ≥ 20 % → 100                         | nunca                        |
| Deuda / ingresos        | 20   | `Σ pago requerido / ingreso mensual`                       | ≤ 15 % → 100; ≥ 50 % → 0. Sin deudas → 100      | nunca                        |
| Colchón                 | 15   | `max(closing_balance, 0) / gasto promedio`, en meses       | 0 → 0; ≥ 6 → 100                                | sin meses cerrados o gasto 0 |
| Presupuestos            | 15   | Presupuestos de `M` con gastado ≤ presupuesto / total      | 0 % → 0; 100 % → 100                            | sin presupuestos en `M`      |
| Utilización de tarjetas | 10   | `Σ saldos / Σ cupos` de las tarjetas consideradas          | ≤ 10 % → 100; 30 % → 75; 70 % → 25; ≥ 100 % → 0 | sin tarjetas                 |
| Metas                   | 10   | % de metas consideradas "En camino" a la referencia        | 0 % → 0; 100 % → 100                            | sin metas con fecha objetivo |
| Regularidad             | 5    | Semanas de ventana con ≥ 1 movimiento / semanas de ventana | 0 % → 0; 100 % → 100                            | nunca                        |

- **Pago requerido** por deuda: `min(cuota o pago mínimo, saldo al fin de M)`,
  como en Deudas. Una tarjeta sin pago mínimo suma 0; la utilización sí la
  mide.
- **"En camino"** usa la regla de Metas con hoy = referencia y el ahorrado al
  fin de `M`.
- **Score:** `round(Σ (peso × puntos) / Σ pesos incluidos)`.
- El **colchón** es una estimación: no hay cuentas bancarias, así que usa el
  balance acumulado (los aportes a metas no lo restan). Su dato dice "Tu
  balance cubre N meses de gastos".

Ejemplo: hoy 30 oct 2026, primer movimiento el 1 de agosto, ingresos de
4.000.000 y gastos de 3.400.000 cada mes, un préstamo con cuota de 600.000 y
movimientos todas las semanas. Ahorro 15 % → 75; deuda 15 % → 100; colchón
0,53 meses → 8,82; regularidad → 100; el resto excluido. Score
`(25 × 75 + 20 × 100 + 15 × 8,82 + 5 × 100) / 65` = **69, Bueno**.

### Bandas, variación e histórico

| Score    | Banda     | Color |
| -------- | --------- | ----- |
| 0 – 39   | Débil     | rojo  |
| 40 – 59  | Regular   | ámbar |
| 60 – 79  | Bueno     | sky   |
| 80 – 100 | Excelente | verde |

- **Variación:** score de `M` − score de `M − 1`, en puntos; "—" si el
  anterior no tiene score.
- **Histórico:** los 12 meses hasta el actual. Un mes sin datos suficientes es
  un hueco en la línea.
- **Aproximación:** cupo, cuota, pago mínimo, tasa, fecha objetivo y estado
  archivado se toman con su **valor actual**. Archivar una deuda o cambiar un
  cupo cambia también los meses pasados. No hay `archived_at` en metas ni
  deudas.

### Reglas de recomendación

Se evalúan sobre hoy y el mes actual, aunque el score esté "Sin datos
suficientes".

| Regla                 | Condición                                                                                                                                                  | Severidad | Enlace                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------- |
| `deficit`             | Último mes cerrado con gastos > ingresos                                                                                                                   | alta      | Reportes de ese mes          |
| `category_growth`     | Con 3 meses completos antes del último cerrado: categoría ≥ 130 % de su promedio de esos meses y diferencia ≥ 5 % del gasto promedio de los meses cerrados | media     | Movimientos de esa categoría |
| `budget_exceeded`     | Presupuesto del mes actual con gastado ≥ 100 %                                                                                                             | alta      | Presupuestos                 |
| `goal_at_risk`        | Meta activa "En riesgo"                                                                                                                                    | media     | Metas                        |
| `high_utilization`    | Tarjeta activa con utilización ≥ 70 %                                                                                                                      | media     | Deudas                       |
| `highest_rate_first`  | ≥ 2 tarjetas o préstamos activos con saldo y tasa > 0; señala la de mayor tasa mensual                                                                     | baja      | Deudas                       |
| `overdue_payment`     | Deuda "Vencida" u ocurrencia de gasto fijo vencida                                                                                                         | alta      | Deudas o Gastos fijos        |
| `low_cushion`         | Factor colchón incluido y < 3 meses                                                                                                                        | media     | Metas                        |
| `unbudgeted_spending` | ≥ 2 categorías con gastos en el mes actual y sin presupuesto                                                                                               | baja      | Presupuestos                 |
| `irregular_records`   | Regularidad del mes actual < 50 %, solo con datos suficientes                                                                                              | baja      | Movimientos                  |

- **Orden:** severidad (alta, media, baja) y luego monto descendente (déficit,
  exceso, faltante, interés…). Las 3 primeras no ocultas van al Resumen.
- **Ocultar este mes** guarda `(rule, entity_key, mes actual)` en
  `dismissed_recommendations`. La recomendación pasa a "Ocultas este mes" y
  vuelve el mes siguiente si la condición sigue. **Mostrar de nuevo** borra la
  fila. No se descartan para siempre.
- Una fila oculta cuya condición ya no se cumple no se muestra en ningún lado
  y no necesita limpieza.

### Seguridad

- RLS en `dismissed_recommendations` con `is_workspace_owner`: `select`,
  `insert` y `delete`, sin `update`. Un `check` limita `rule` a las 10 claves.
- Las tres RPC del score son `security invoker` y `stable`, y solo las
  ejecuta `authenticated`. Con un espacio ajeno no devuelven datos.
- `dismissRecommendation` y `restoreRecommendation` validan con Zod la regla
  y la entidad, y usan el espacio Personal del usuario autenticado.

## Specs

Tesoro se construye en 13 specs (`specs/`), cada uno sobre los anteriores. El
detalle de cada uno (objetivo, alcance, modelo y preguntas abiertas) está en
[`ROADMAP.md`](../ROADMAP.md).

1. Autenticación y layout del dashboard ✅
2. Movimientos personales y categorías
3. Resumen y reportes con gráficas
4. Gastos fijos y presupuestos
5. Metas de ahorro
6. Tarjetas de crédito y deudas
7. Score financiero y recomendaciones
8. Importar desde Excel o CSV
9. Cuenta y perfil
10. Espacio Empresa: crear y registrar operaciones
11. Empresa: flujo de caja, reportes, score y recomendaciones
12. Landing, páginas legales y assets
13. Lanzamiento v1.0
