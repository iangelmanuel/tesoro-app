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

| Tabla                | Qué guarda                                                                                           | RLS (cliente)                          |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `profiles`           | Un perfil por usuario: `full_name`, `avatar_url`, `currency` (COP por defecto)                       | `select` y `update` del propio perfil  |
| `workspaces`         | Espacios del usuario: `type` (`personal` / `business`) y `name`                                      | `select` de los propios                |
| `categories`         | Categorías de ingreso o gasto: del sistema (`workspace_id` null) o propias                           | `select`, `insert` y `update`          |
| `transactions`       | Movimientos: `type`, `amount`, `occurred_on`, `category_id`, `description`, `note`                   | `select`, `insert`, `update`, `delete` |
| `recurring_expenses` | Gastos fijos: `name`, `amount`, `category_id`, `frequency`, día y mes de pago, vigencia, `is_active` | `select`, `insert`, `update`, `delete` |
| `budgets`            | Presupuesto por categoría de gasto y mes (`month` = primer día), único por categoría y mes           | `select`, `insert`, `update`, `delete` |

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

## Score financiero

Puntaje que resume la salud financiera del espacio activo y su evolución en el
tiempo. Se calcula solo con los registros del usuario. Los factores y pesos
exactos se definen al implementar el módulo y deben documentarse aquí.

## Recomendaciones

Sugerencias accionables derivadas de los registros (por ejemplo, categorías
que crecen, meses con déficit, metas en riesgo). Cada recomendación debe
explicar en qué dato se basa.
