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

| Ruta                           | Qué es                                      | Indexable |
| ------------------------------ | ------------------------------------------- | --------- |
| `/`                            | Landing                                     | Sí        |
| `/legal/[slug]`                | Privacidad (`privacy`) y Términos (`terms`) | Sí        |
| `/sign-in`                     | Inicio de sesión                            | Sí        |
| `/sign-up`                     | Registro                                    | Sí        |
| `/forgot-password`             | Pedir el enlace para recuperar contraseña   | Sí        |
| `/reset-password`              | Elegir la nueva contraseña                  | No        |
| `/check-email`                 | Revisar el correo de confirmación           | No        |
| `/auth/callback`               | Callback de OAuth (Google, GitHub)          | No        |
| `/auth/confirm`                | Verifica los enlaces de email               | No        |
| `/account-deleted`             | Cuenta en periodo de gracia del borrado     | No        |
| `/dashboard`                   | Redirige a `/dashboard/personal`            | No        |
| `/dashboard/account`           | Cuenta y perfil                             | No        |
| `/dashboard/personal/...`      | Espacio Personal (requiere sesión)          | No        |
| `/dashboard/business`          | Redirige a la empresa o estado vacío        | No        |
| `/dashboard/business/[id]/...` | Espacio de una empresa                      | No        |

Las rutas viven en `SITE.routes` y la navegación de los espacios en
`SITE.navigation.personal` y `SITE.navigation.business` (este con `segment`,
que se agrega a `/dashboard/business/[id]`). `robots.ts` bloquea `/dashboard/`, `/api/` y
`/auth/`, y `proxy.ts` exige sesión en `/dashboard/*`. Los slugs van en inglés
(`/transactions`, `/budgets`, `/goals`, `/debts`, `/reports`,
`/recommendations`); la UI, en español. Cada empresa vive en
`/dashboard/business/[id]/...`, para que la URL refleje el espacio activo.

## Landing

Presenta el producto y lleva a crear cuenta. Vive en el grupo `app/(public)/`,
cuyo layout pone el header y el footer públicos en `/` y `/legal/*` (no en
auth ni en el dashboard).

Secciones, en orden (`src/features/landing/components/`):

1. **Hero**: título, `SITE.info.slogan`, CTA "Crear cuenta" y "Ver en GitHub",
   y el visual `LandingHeroVisual`.
2. **Funciones** (`#funciones`): los 6 ítems de `SITE.features`, cada uno con
   su ícono de lucide (`icon`).
3. **Cómo funciona** (`#como-funciona`): Registra → Visualiza → Mejora.
4. **Score** (`#score`): los 7 factores con sus pesos, las 4 bandas y
   `LandingScoreVisual`. Los pesos son constantes de presentación copiadas de
   [Factores y pesos](#factores-y-pesos); si cambian allí, se cambian en
   `score-section.tsx`.
5. **Personal y Empresa**: `SITE.workspaces.types`, con lo que trae cada
   espacio tomado de `SITE.navigation.personal` y `SITE.navigation.business`.
6. **Código abierto** (`#open-source`): licencia, repositorio, issues y
   `CONTRIBUTING`.
7. **CTA final** a `/sign-up`.

- Los visuales son **mockups JSX interinos** con datos ficticios fijos, en
  `hero-visual.tsx` y `score-visual.tsx`. Son decorativos (`aria-hidden`) con
  una descripción `sr-only`. Un spec futuro los reemplaza por videos.
- **Header**: `Logo`, `SITE.navigation.main`, toggle de tema y botones de
  sesión. Los botones son una isla en `<Suspense>` que lee la sesión con
  `getClaims()`; el fallback es el estado sin sesión ("Iniciar sesión" y
  "Crear cuenta") y con sesión muestra "Ir al dashboard". Así `/` sigue
  prerenderizada (PPR). En móvil, los enlaces y botones van en un `Sheet`.
- **Footer**: `Logo`, slogan, legales, repositorio, issues, seguridad, redes de
  `SITE.social`, licencia, versión y "Hecho por" `SITE.author`.
- La landing no hace peticiones a dominios externos: sin analítica, sin
  cookies de terceros y sin contador de estrellas de GitHub.

### Páginas legales

`/legal/privacy` y `/legal/terms` salen de una sola ruta
`app/(public)/legal/[slug]/page.tsx`, con `generateStaticParams` desde
`SITE.legal`. Un slug desconocido responde 404.

- El contenido vive en TSX (`src/content/legal/privacy.tsx` y `terms.tsx`):
  una descripción para la metadata y una lista de secciones (`id`, `title`,
  `content`). `LegalDocument` pinta título, "Última actualización", índice con
  anclas y cuerpo.
- `SITE.legal[].updatedAt` se cambia a mano cada vez que cambia un texto.
- La URL se arma con `legalHref(slug)`, nunca a mano.
- Responsable: Angel De La Torre, persona natural en Colombia. Marco: Ley 1581
  de 2012 y Decreto 1377 de 2013. Edad mínima: 18 años.
- `/sign-up` muestra bajo el formulario "Al crear tu cuenta aceptas los
  Términos y Condiciones y la Política de Privacidad". No hay checkbox ni se
  guarda la versión aceptada.

## Marca

- **Isotipo**: un cofre blanco sobre un cuadro redondeado del acento. Fuente
  en `assets/brand/mark.svg`; `app/icon.svg` es una copia.
- **Wordmark**: "Tesoro" en Geist SemiBold.
- **Acento**: `--income` (emerald). No hay paleta propia de marca. Para texto
  pequeño se usa la utilidad `text-brand` (`--income` mezclado con el
  foreground), que cumple contraste AA en claro y oscuro.
- **Componente** `Logo` (`src/components/brand/logo.tsx`): isotipo inline y
  wordmark, con variante solo isotipo (`variant="mark"`) y tamaños `default` y
  `lg`. Si cambia `mark.svg`, se actualiza también aquí.

### Assets

`pnpm brand:assets` (`scripts/generate-brand-assets.mjs`, con sharp) genera
desde los SVG fuente de `assets/brand/`:

| Archivo                       | Fuente          | Tamaño     |
| ----------------------------- | --------------- | ---------- |
| `public/opengraph-image.png`  | `opengraph.svg` | 1200×630   |
| `public/brand/logo.png`       | `logo.svg`      | 512×512    |
| `public/apple-touch-icon.png` | `mark.svg`      | 180×180    |
| `public/icons/icon-192.png`   | `mark.svg`      | 192×192    |
| `public/icons/icon-512.png`   | `mark.svg`      | 512×512    |
| `app/favicon.ico`             | `mark.svg`      | 16, 32, 48 |

- Los textos de `logo.svg` y `opengraph.svg` van convertidos a trazos, así el
  rasterizado no depende de las fuentes del sistema.
- El `.ico` se arma en el script con PNG embebidos, sin dependencias extra.
- La salida se commitea; el CI no corre el script. Es determinista: correrlo
  dos veces da los mismos bytes.

## Autenticación

Supabase Auth con tres métodos:

- **Email y contraseña**: registro con nombre, email y contraseña (mínimo 8
  caracteres). Por ahora no se pide confirmar el email (ver abajo).
- **Google** y **GitHub** (OAuth), con callback en `/auth/callback`. El nombre
  y el avatar salen del proveedor.

Al registrarse, por cualquier método, el usuario recibe automáticamente su
perfil y su espacio _Personal_. Quien ya tiene sesión y entra a `/sign-in` o
`/sign-up` va directo al dashboard; quien no la tiene y entra al dashboard va a
`/sign-in?next=<ruta>` y vuelve a esa ruta al iniciar sesión.

**Recuperar la contraseña**: "¿Olvidaste tu contraseña?" en `/sign-in` lleva
a `/forgot-password`. La respuesta es la misma exista o no el email, para no
enumerar cuentas; solo cambia ante el límite de envíos. El enlace del correo
abre `/reset-password`, que sin sesión vuelve a
`/forgot-password?error=expired`.

**Enlaces de email**: las plantillas de `supabase/templates/` enlazan a
`/auth/confirm?token_hash=…&type=…&next=…`, que verifica el enlace y redirige a
`next`. Funcionan aunque el correo se abra en otro navegador. Un enlace
vencido o usado lleva a `/sign-in?error=link`.

**Confirmación de email**: lista pero apagada (`enable_confirmations = false`).
Si se enciende, el registro lleva a `/check-email` con "Reenviar correo", y
quien inicia sesión sin confirmar ve el error con el enlace para reenviar.
Conviene encenderla solo con un SMTP propio: sin él, Supabase envía muy pocos
correos por hora.

Queda para un spec futuro el magic link.

## Modelo de datos

Las migraciones viven en `supabase/migrations/`. Toda tabla con datos de
usuario tiene RLS.

| Tabla                       | Qué guarda                                                                                                                                                                                                                               | RLS (cliente)                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `profiles`                  | Un perfil por usuario: `full_name`, `avatar_url`, `currency` (COP por defecto)                                                                                                                                                           | `select` y `update` del propio perfil           |
| `workspaces`                | Espacios del usuario: `type` (`personal` / `business`), `name` y `deletion_requested_at` (solo Empresa)                                                                                                                                  | `select`; `insert` y `update (name)` de Empresa |
| `business_profiles`         | Datos de una empresa, 1:1 con su espacio: `tax_id` (NIT opcional) y `sector`                                                                                                                                                             | `select`, `insert`, `update`                    |
| `categories`                | Categorías de ingreso o gasto: del sistema (`workspace_id` null) o propias, con `scope` (`personal` / `business`)                                                                                                                        | `select`, `insert` y `update`                   |
| `transactions`              | Movimientos: `type`, `amount`, `occurred_on`, `category_id`, `description`, `note`, `account_id` opcional y, en Empresa, `counterparty` e `invoice_ref`                                                                                  | `select`, `insert`, `update`, `delete`          |
| `accounts`                  | Cuentas y métodos de pago: `name` (único por espacio), `kind` (`cash` / `bank` / `wallet` / `other`), `icon`, `color`, `opening_balance`, `archived_at`                                                                                  | `select`, `insert`, `update`                    |
| `transfers`                 | Traspasos entre cuentas propias: `from_account_id`, `to_account_id` (distintas), `amount` > 0, `occurred_on`, `note`                                                                                                                     | `select`, `insert`, `update`, `delete`          |
| `account_adjustments`       | Ajustes de saldo de "Actualizar saldo": `account_id`, `amount` ≠ 0 (> 0 sube el saldo), `occurred_on`, `note`                                                                                                                            | `select`, `insert`, `update`, `delete`          |
| `recurring_expenses`        | Gastos fijos: `name`, `amount`, `category_id`, `frequency`, día y mes de pago, vigencia, `is_active`                                                                                                                                     | `select`, `insert`, `update`, `delete`          |
| `budgets`                   | Presupuesto por categoría de gasto y mes (`month` = primer día), único por categoría y mes                                                                                                                                               | `select`, `insert`, `update`, `delete`          |
| `savings_goals`             | Metas de ahorro: `name`, `target_amount`, `target_date` opcional, `icon`, `color`, `status`                                                                                                                                              | `select`, `insert`, `update`                    |
| `goal_contributions`        | Aportes (`amount` > 0) y retiros (`amount` < 0) de una meta, con `occurred_on` y `note`                                                                                                                                                  | `select`, `insert`, `update`, `delete`          |
| `dismissed_recommendations` | Recomendaciones ocultas: `rule`, `entity_key` y `month` en que se ocultaron, únicas por los tres                                                                                                                                         | `select`, `insert`, `delete`                    |
| `imports`                   | Importaciones: `target` (destino), `filename`, `sheets`, `status` (`completed` / `undone`), `stats`, `undone_at`. Las filas importadas llevan `import_id` en `transactions`, `recurring_expenses`, `debt_entries` o `goal_contributions` | `select` (solo escriben las RPC)                |

- Cada usuario tiene **un solo** espacio Personal (índice único parcial) y
  hasta `business_workspace_limit()` empresas (hoy 1).
- El trigger `on_auth_user_created` (función `handle_new_user`, `security
definer`) crea el perfil y el espacio Personal al insertar en
  `auth.users`. Por eso el cliente no tiene políticas de `insert` ni `delete`.
- Los datos de cada módulo (movimientos, metas, deudas…) cuelgan de
  `workspace_id`. Sus políticas RLS usan la función
  `is_workspace_owner(workspace_id)` (`security invoker`), y el trigger
  reutilizable `set_updated_at()` mantiene `updated_at`.
- Las políticas de escritura de movimientos, categorías, cuentas, traspasos,
  ajustes y `business_profiles` usan `is_workspace_writable(workspace_id)`:
  dueño **y** sin marca de borrado. Ver [Espacio Empresa](#espacio-empresa-1).

## Dashboard

Layout con **aside** de navegación. En la parte superior del aside hay un
selector tipo tab para cambiar de espacio:

- **Personal** (por defecto): siempre existe, con su estructura completa.
- **Empresa**: si el usuario no tiene uno, el dashboard muestra un estado vacío
  que lo invita a crear su espacio de empresa. Con una empresa,
  `/dashboard/business` redirige a ella.

Los espacios están definidos en `SITE.workspaces`.

### Espacio Personal

- Resumen: balance, ingresos vs. gastos del mes, score
- Movimientos: ingresos y gastos con categorías, más traspasos y ajustes
- Cuentas: saldo de efectivo, bancos y billeteras
- Presupuestos por categoría y gastos fijos
- Metas de ahorro
- Deudas
- Reportes y gráficas
- Recomendaciones

### Espacio Empresa

- Resumen: ventas, costos y gastos, y utilidad del mes, más los últimos 5
  movimientos
- Movimientos: ventas (ingresos) y costos o gastos (egresos), con cliente o
  proveedor y factura
- Cuentas: las mismas de Personal, dentro de la empresa
- Flujo de caja, Reportes y Recomendaciones (próximamente, SPEC 11)
- Ajustes: nombre, NIT, sector y eliminar la empresa

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

| Parámetro  | Valores                         | Por defecto                    |
| ---------- | ------------------------------- | ------------------------------ |
| `month`    | `YYYY-MM` o `all`               | mes actual en `America/Bogota` |
| `type`     | `income`, `expense`, `transfer` | sin filtro                     |
| `category` | uuid                            | sin filtro                     |
| `account`  | uuid o `none`                   | sin filtro                     |
| `q`        | texto (descripción y nota)      | sin filtro                     |
| `page`     | entero ≥ 1                      | `1`                            |

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

## Cuentas y traspasos

Página `/dashboard/personal/accounts` (ítem "Cuentas" del aside). Dice de
dónde sale la plata: efectivo, bancos y billeteras como Nequi.

### Cuentas

- Nombre (1 a 40 caracteres, único por espacio sin distinguir mayúsculas),
  tipo, ícono y color (los del picker de categorías) y saldo inicial, que
  puede ser negativo.
- Cada espacio, nuevo o existente, trae la cuenta "Efectivo" con saldo 0
  (trigger `seed_workspace_accounts` y backfill).
- Se archivan y restauran, no se borran. Una cuenta archivada sale de los
  `select`, pero sus movimientos la conservan.

| `kind`   | Etiqueta          | Ícono      | Color     |
| -------- | ----------------- | ---------- | --------- |
| `cash`   | Efectivo          | `banknote` | `emerald` |
| `bank`   | Banco             | `landmark` | `blue`    |
| `wallet` | Billetera digital | `wallet`   | `violet`  |
| `other`  | Otra              | `wallet`   | `slate`   |

### Saldo

El saldo no se guarda: se calcula con la RPC `account_balances`.

```text
saldo = opening_balance
      + Σ ingresos − Σ gastos           (transactions con esa account_id)
      + Σ traspasos entrantes − Σ salientes
      + Σ ajustes
```

- **Saldo a hoy:** solo filas con `occurred_on ≤ hoy` (`America/Bogota`). Es
  el que se muestra, en rojo si es negativo.
- **Con lo programado:** todas las filas. Aparece solo si difiere.
- El saldo puede ser negativo: un sobregiro o un movimiento olvidado es real.
- "Actualizar saldo" pide el saldo real y crea un ajuste por
  `saldo real − saldo a hoy` con fecha de hoy. Si la diferencia es 0, no crea
  nada ("El saldo ya coincide").
- Los movimientos sin cuenta no cuentan en ningún saldo.

### Cuenta en movimientos

- El formulario de movimiento tiene un `select` "Cuenta" opcional ("Sin
  cuenta" por defecto). Al editar un movimiento de una cuenta archivada, la
  cuenta se muestra como "(archivada)" y se puede guardar sin cambiarla.
- El pago de un préstamo o el abono de una cuenta por cobrar con "Registrar
  como gasto/ingreso" acepta una cuenta para el movimiento que crea.

### Traspasos y ajustes

- Un traspaso mueve plata entre dos cuentas propias distintas. Se crea desde
  Cuentas o Movimientos, y se edita y elimina desde Movimientos.
- Traspasos y ajustes viven en sus propias tablas: **no son ingreso ni gasto**
  y no afectan Resumen, Reportes, Presupuestos ni el score.
- Movimientos los muestra en la misma lista paginada, leyendo la vista
  `ledger_entries`, con estilo neutro: "Nequi → Efectivo" (monto sin signo) y
  "Ajuste de saldo · Nequi" (monto con signo, solo eliminar). Los totales del
  encabezado solo suman movimientos.
- `?account=<id>` muestra los movimientos y ajustes de la cuenta y los
  traspasos donde es origen o destino. `?account=none` muestra solo
  movimientos sin cuenta. `?type=transfer` muestra solo traspasos y ajustes.

### Resumen

- Tarjeta "Saldo en cuentas": suma de los saldos a hoy de las cuentas
  activas, con enlace a Cuentas.

### Seguridad

- RLS en `accounts`, `transfers` y `account_adjustments` con
  `is_workspace_owner`. Sin política `delete` en `accounts`.
- FK compuestas `(account_id, workspace_id)` en `transactions`, `transfers` y
  `account_adjustments`: la cuenta siempre es del mismo espacio.
- Trigger `check_account_active`: una fila nueva, o una que cambia de cuenta,
  no puede usar una cuenta archivada.
- `ledger_entries` es `security_invoker` y solo la lee `authenticated`.
  `account_balances` es `security invoker` y solo la ejecuta `authenticated`.

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

- RLS en `dismissed_recommendations`: `select` con `is_workspace_owner`;
  `insert` y `delete` con `is_workspace_writable` (SPEC 11); sin `update`. Un
  `check` limita `rule` a las claves de Personal y de Empresa.
- Las tres RPC del score son `security invoker` y `stable`, y solo las
  ejecuta `authenticated`. Con un espacio ajeno no devuelven datos.
- `dismissRecommendation(workspaceId, rule, entityKey)` y
  `restoreRecommendation` resuelven el espacio con `requireWritableWorkspace`
  y validan con Zod la regla contra las claves de su tipo de espacio y la
  entidad.

## Importar

Página `/dashboard/personal/import`, con entrada desde el botón "Importar" de
Movimientos y de su estado vacío, de la tab Gastos fijos de Presupuestos, de
Deudas y de Metas. No está en el aside: importar es ocasional. Importa en el
espacio Personal con **un destino por importación**: movimientos, gastos
fijos, pagos y ajustes de deudas o aportes y retiros de metas (ver
[Destinos](#destinos)).

- El archivo **se lee en el navegador** (`read-excel-file` para `.xlsx` y
  `papaparse` para `.csv`, cargadas con `import()` solo al elegir el archivo).
  Al servidor solo llegan las filas ya mapeadas. El archivo no se guarda.
- El estado del asistente vive en el cliente y se pierde al recargar.

### Formatos y límites

| Límite                | Valor                                                   |
| --------------------- | ------------------------------------------------------- |
| Formatos              | `.xlsx` (una o varias hojas) y `.csv` (una hoja)        |
| Tamaño                | 5 MB, validado antes de leer                            |
| Filas por importación | 2.000 filas con datos, sumando todas las hojas elegidas |
| Payload de la acción  | `serverActions.bodySizeLimit` en `2mb`                  |
| Delimitador del CSV   | Lo detecta `papaparse` (`,`, `;`, tabulador…)           |

### Pasos

1. **Archivo:** destino ("¿Qué vas a importar?") y zona de arrastre o
   selector. El destino se precarga con `?target=` (`transactions`,
   `recurring_expenses`, `debt_entries`, `goal_contributions`; un valor
   inválido cae a movimientos). Cambiarlo reinicia el mapeo.
2. **Tabla:** hojas con casillas, tabla detectada, ajuste de la fila de
   encabezados y de las columnas, y las primeras 5 filas.
3. **Columnas:** un `select` por campo con la sugerencia, el modo de tipo, el
   formato de fecha y el mapeo de los valores de tipo.
4. **Categorías:** cada par (tipo, valor de origen) va a una categoría
   existente, a una nueva o a "No importar". En deudas y metas este paso es
   **Deudas** o **Metas** (ver [Destinos](#destinos)).
5. **Vista previa:** contadores por estado, filtro, tabla de 100 filas por
   página con casilla y "Importar N movimientos".
6. **Resumen:** importadas, omitidas, duplicadas omitidas y con error.

### Detección de tablas

- **Encabezados:** una fila con ≥ 3 celdas de texto contiguas cuya siguiente
  fila no vacía, dentro del mismo rango, tiene una celda tipo fecha y otra
  tipo número. El rango es el tramo contiguo de celdas no vacías; una fila
  puede dar varias tablas si las separa al menos una columna vacía.
- **Fin:** 3 filas vacías seguidas en el rango, o el fin de la hoja.
- Sin detección, se usa la fila 1 con todas las columnas con datos.
- **Varias hojas:** la primera hoja marcada define la tabla y el mapeo. En las
  demás se busca una tabla con los mismos encabezados normalizados (minúsculas,
  sin tildes ni espacios sobrantes), empiece en la columna que empiece. Las que
  no coinciden se marcan "No coincide" y se excluyen.

### Mapeo

Campos: fecha, monto, tipo, ingreso, gasto, categoría, descripción, nota y
cuenta (columna Método, SPEC 08c). Las columnas sin destino se ignoran.
Encabezados que sugieren cada campo:

| Campo            | Encabezados                                        |
| ---------------- | -------------------------------------------------- |
| `date`           | fecha, date, día                                   |
| `amount`         | monto, valor, importe, amount                      |
| `type`           | tipo, salida entrada, entrada salida, movimiento   |
| `income_amount`  | ingreso, entrada, abono, crédito                   |
| `expense_amount` | gasto, salida, cargo, débito                       |
| `category`       | categoría, category, rubro                         |
| `description`    | descripción, concepto, detalle, notas, description |
| `note`           | nota, observación, comentario                      |
| `account`        | método, medio de pago, forma de pago, cuenta       |

**Tipo**, en 3 modos:

- **Columna con valores:** cada valor distinto se mapea a ingreso, gasto u
  "Omitir fila". Se sugiere entrada / ingreso / income → ingreso y salida /
  gasto / egreso / expense → gasto. Un valor sin asignar da "Tipo
  desconocido".
- **Signo del monto:** negativo → gasto, positivo → ingreso.
- **Dos columnas:** la columna con valor ≠ 0. Ambas > 0 da "Ingreso y gasto a
  la vez".

**Categorías:** cada par (tipo, valor de origen) se mapea. Se sugiere la
categoría del mismo tipo con ese nombre (sin distinguir mayúsculas ni tildes)
o una nueva con el valor de origen (máximo 40 caracteres). Sin columna de
categoría, todo va a "Otros ingresos" u "Otros gastos". Un valor vacío es el
par (tipo, "Sin categoría"). Las archivadas no aparecen como destino. Las
nuevas se crean con `receipt` / `slate` (gasto) o `coins` / `lime` (ingreso).

**Cuentas:** con la columna Método mapeada, el paso 4 agrega una sección
"Cuentas": cada valor distinto con su número de filas y un `select` con las
cuentas activas, "Crear «valor»" y "Sin cuenta". Se sugiere la cuenta con ese
nombre normalizado o una nueva (máximo 40 caracteres); un valor vacío va a
"Sin cuenta". La cuenta no omite filas. Las nuevas se crean como "Otra"
(`wallet` / `slate`) y se quedan al deshacer. Sin columna, los movimientos
quedan sin cuenta. Las filas "Traspaso" del Excel siguen yendo a "No
importar".

### Normalización por fila

| Campo       | Regla                                                                                                                                                                                                                           | Error                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Fecha       | Celda fecha de Excel → componentes UTC (`read-excel-file` la entrega a las 00:00 UTC). Número entre 20.000 y 80.000 → serie de Excel. Texto → DD/MM/AAAA (por defecto), MM/DD/AAAA o AAAA-MM-DD. Entre 2000-01-01 y hoy + 1 año | "Fecha inválida"       |
| Monto       | Texto con coma y punto: el último separador es el decimal. Con uno solo, formato es-CO. Signo como `-50.000`, `50.000-` o `(50.000)`. Redondeo a 2 decimales; > 0 y ≤ 999.999.999.999,99                                        | "Monto inválido"       |
| Descripción | Recortada; vacía → valor de categoría de origen. Más de 120 caracteres se recorta con aviso                                                                                                                                     | "Falta la descripción" |
| Nota        | Opcional; más de 500 caracteres se recorta                                                                                                                                                                                      | —                      |

- Una fila **sin fecha ni monto** es vacía: no se muestra y suma en omitidas.
- Una fila con tipo "Omitir fila" o categoría "No importar" queda **omitida**
  con el motivo, aunque tenga otros errores.

### Duplicados

- Clave: `fecha | tipo | monto con 2 decimales | descripción normalizada`
  (minúsculas, sin tildes, espacios colapsados).
- Se compara contra los movimientos del rango `[min fecha, max fecha]` del
  archivo (`transactions_for_duplicates`) y contra filas anteriores del mismo
  archivo.
- Una fila duplicada queda **desmarcada** con "Posible duplicado de un
  movimiento del DD/MM/AAAA" o "Posible duplicado de la fila N (Hoja)". El
  usuario puede marcarla.

### Guardado, historial y deshacer

- `import_transactions` guarda **todo o nada**: crea la fila de `imports` con
  sus stats, las categorías y cuentas nuevas y los movimientos con
  `import_id`. Los
  `check` y el trigger `check_transaction_category` siguen aplicando.
- Stats: `read` (filas con datos), `imported`, `skipped` ("No importar",
  desmarcadas y vacías), `duplicates` (duplicadas no incluidas) y `errors`.
- El historial, bajo el asistente, muestra archivo, hojas, fecha, stats y
  estado. **Deshacer** está disponible siempre: pide confirmación con el
  número de movimientos, borra todos los del import (también los editados
  después) y lo deja "Deshecho". Las categorías creadas se quedan. Un pago de
  deuda enlazado queda sin movimiento.

### Destinos

Cada importación tiene un solo destino. Para cargar gastos fijos y aportes
del mismo archivo se corre el asistente dos veces. Las deudas y metas **no se
crean** al importar: se crean antes en su página. Sin deudas (o metas)
activas, su destino aparece deshabilitado con "Primero crea una deuda" (o
"una meta").

Fechas y montos siguen las reglas de [Normalización por
fila](#normalización-por-fila). Los campos con \* son obligatorios.

**Gastos fijos** (`recurring_expenses`, siempre activos al importar):

| Campo      | Encabezados                          | Regla                                                                                                              |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Nombre \*  | nombre, gasto, concepto, descripción | Más de 60 caracteres se recorta con aviso. Vacío → "Falta el nombre"                                               |
| Monto \*   | monto, valor, importe, cuota         | Valor absoluto                                                                                                     |
| Categoría  | categoría, rubro                     | Mapeo igual que movimientos, solo de gasto. Sin columna → "Otros gastos"                                           |
| Frecuencia | frecuencia, periodicidad             | Cada valor → mensual, anual u "Omitir fila" (mensual / mes / monthly, anual / año / yearly). Sin columna → mensual |
| Día        | día, día de pago, vence              | Entero 1–31. Sin columna → día del inicio                                                                          |
| Mes        | mes                                  | Solo anuales: 1–12 o nombre en español. Sin valor → mes del inicio de la columna; sin eso, "Falta el mes"          |
| Inicio     | inicio, desde, fecha                 | Sin columna → primer día del mes actual                                                                            |
| Fin        | fin, hasta                           | Opcional, ≥ inicio                                                                                                 |

Hace falta mapear Día o Inicio (con uno basta).

**Deudas** (`debt_entries`) y **Metas** (`goal_contributions`):

| Campo      | Deudas                                                          | Metas                  |
| ---------- | --------------------------------------------------------------- | ---------------------- |
| Fecha \*   | fecha, date, día. No puede ser futura ("Fecha futura")          | Igual                  |
| Monto \*   | monto, valor, pago, abono                                       | monto, valor, aporte   |
| Tipo       | tipo, movimiento, concepto                                      | tipo, movimiento       |
| Deuda/Meta | deuda, tarjeta, préstamo, crédito, entidad                      | meta, objetivo, ahorro |
| Nota       | nota, descripción, detalle, observación (máximo 120 caracteres) | Igual                  |

- **Tipo**, en 3 modos:
  - **Columna con valores:** en deudas, cada valor → Pago, Cargo (ajuste que
    sube el saldo), Ajuste a la baja u "Omitir fila" (pago / abono → Pago;
    compra / cargo / interés / cuota de manejo → Cargo). En metas → Aporte,
    Retiro u "Omitir fila" (aporte / ahorro / depósito → Aporte; retiro /
    saca → Retiro).
  - **Signo del monto:** negativo → Pago (o Retiro); positivo → Cargo (o
    Aporte).
  - **Todas son pagos** (o **Todos son aportes**).
- **Deuda o meta de cada fila:** con la columna, el paso 4 mapea cada valor a
  una deuda o meta activa o a "No importar" (se sugiere la del mismo nombre).
  Sin columna, se elige una para todo el archivo y el paso 4 se salta.
- Las compras con tarjeta siguen siendo **movimientos**: un Cargo sirve para
  intereses o cuotas de manejo de un extracto.
- **Saldos en la vista previa:** saldo actual → resultante de cada deuda
  (`saldo + cargos − pagos − bajas`) o meta (`ahorrado + aportes − retiros`)
  con filas marcadas. Si alguno queda < 0, "Importar" se deshabilita con "El
  saldo de «X» quedaría en −$ N".
- **Casilla "Registrar también como gasto/ingreso"**, desmarcada por defecto:
  cada pago a un préstamo crea un gasto "Pago <nombre>" en "Deudas" y cada
  abono de una cuenta por cobrar, un ingreso "Abono <nombre>" en "Cobros",
  igual que `record_debt_payment`. Solo aparece si algún pago marcado va a un
  préstamo o cuenta por cobrar; nunca en tarjetas. Se deja desmarcada si esos
  pagos ya se importaron como movimientos.

**Duplicados por destino** (desmarcados por defecto, también contra filas
anteriores del mismo archivo):

| Destino      | Clave                                         | Compara contra                                   |
| ------------ | --------------------------------------------- | ------------------------------------------------ |
| Gastos fijos | Nombre normalizado                            | Todos los gastos fijos del espacio, activos o no |
| Deudas       | Deuda, pago o ajuste, monto con signo y fecha | Entradas de esas deudas en el rango del archivo  |
| Metas        | Meta, monto con signo y fecha                 | Aportes de esas metas en el rango del archivo    |

**Guardado y deshacer:** cada destino tiene su RPC (`import_recurring_expenses`,
`import_debt_entries`, `import_goal_contributions`), todo o nada. Deudas y
metas insertan primero lo que sube el saldo, así el trigger de saldo no falla
en un estado intermedio. "Deshacer" borra las filas del destino con ese
`import_id`:

- en deudas también borra los movimientos creados con los pagos;
- en gastos fijos, los movimientos que pagaban sus ocurrencias quedan sin
  enlace;
- si la deuda o meta ya no está activa, o quedaría con saldo negativo, falla
  sin borrar nada y nombra cuál ("Reactiva la meta «Viaje» para deshacer la
  importación").

El historial muestra el destino de cada importación y la confirmación usa su
unidad ("Borrar 3 gastos fijos").

### Seguridad

- RLS en `imports`: solo `select` con `is_workspace_owner`. Sin políticas de
  escritura: el historial no se puede falsear desde el cliente.
- `import_recurring_expenses`, `import_debt_entries` e
  `import_goal_contributions` son `security definer` con `search_path = ''`,
  verifican el dueño con la función interna `create_import` (que no se
  expone) y que cada deuda o meta sea del espacio. Solo las ejecuta
  `authenticated`.
- Sus acciones revalidan con Zod y comprueban que las categorías, deudas y
  metas elegidas sean visibles y estén activas.
- `import_transactions` y `undo_import` son `security definer` con
  `search_path = ''` y verifican `is_workspace_owner` al inicio.
  `transactions_for_duplicates` es `security invoker` y también lo verifica.
  Las tres solo las ejecuta `authenticated`.
- `confirmImport` revalida con Zod las filas, las categorías y cuentas nuevas
  y los stats, y comprueba que las categorías existentes sean visibles, del
  tipo de la fila y activas, y que las cuentas existentes sean visibles y
  estén activas.

## Cuenta y perfil

`/dashboard/account`, desde "Cuenta" en el menú de usuario. Vive en el layout
del dashboard (el aside muestra el menú Personal sin ítem activo) y tiene
cuatro secciones apiladas.

### Perfil y preferencias

- **Avatar**: JPG, PNG o WebP de hasta 5 MB. El navegador lo recorta al
  centro en cuadrado y lo sube como WebP de 256×256 a
  `avatars/<user_id>/<uuid>.webp`. Queda un solo archivo por usuario.
  "Quitar foto" vacía la carpeta y vuelve a las iniciales.
- **Nombre**: de 2 a 80 caracteres, como en el registro.
- **Email**: el cambio exige confirmar desde el correo actual y desde el
  nuevo (`double_confirm_changes`). Mientras falta, la sección muestra
  "Cambio pendiente a X".
- **Moneda**: COP, USD, EUR, MXN, PEN, CLP o ARS (`SITE.currencies`). Solo
  cambia el formato: los montos guardados no se convierten. COP y CLP se
  muestran sin decimales.

### Contraseña

- Con contraseña: se pide la actual y se verifica antes de cambiarla.
- Solo OAuth (`has_password()` es `false`): "Crear contraseña" sin pedir la
  actual. La action revisa `has_password()` en el servidor.

### Borrado con periodo de gracia

1. El usuario escribe su email exacto en el diálogo de la zona de peligro.
2. Se borra su avatar (Postgres no puede borrar archivos de Storage), se marca
   la cuenta con `deletion_requested_at` en `auth.users.raw_app_meta_data` y
   se cierra la sesión. `/sign-in` muestra la fecha de borrado.
3. Durante 30 días (`SITE.accountDeletionGraceDays`) puede iniciar sesión:
   `proxy.ts` lo lleva a `/account-deleted`, con la fecha, "Restaurar cuenta"
   y "Cerrar sesión". Restaurar quita la marca; todo vuelve salvo la foto.
4. El job diario de `pg_cron` `purge-deleted-accounts` (08:00 UTC, 03:00 en
   Bogotá) borra de `auth.users` las cuentas marcadas hace más de 30 días, y
   en cascada todos sus datos.

La marca vive en `app_metadata` y no en `profiles` porque el proxy ya la recibe
en su `getUser()` y el usuario no la puede editar.

### Seguridad

- Bucket `avatars` público para leer, de 1 MB y solo `image/webp`. Sus 4
  políticas exigen que la primera carpeta sea `auth.uid()`. `setAvatar`
  además exige la ruta `<user_id>/<uuid>.webp`.
- `has_password`, `request_account_deletion` y `cancel_account_deletion` son
  `security definer`, solo tocan la fila de `auth.uid()` y solo las ejecuta
  `authenticated`. `purge_deleted_accounts` no la ejecuta ningún rol de la
  API.
- Las FK que antes eran `on delete restrict` (categorías y cuentas) son
  `on delete no action`: dentro de la cascada del borrado se revisan al final
  de la sentencia, y fuera de ella siguen bloqueando borrar una categoría o
  cuenta en uso.
- Nada usa la `service_role`.

## Espacio Empresa

El usuario crea su empresa desde el estado vacío de `/dashboard/business` y
registra en ella ventas y costos o gastos operativos. Flujo de caja, reportes,
score y recomendaciones están en
[Empresa: flujo de caja, reportes y score](#empresa-flujo-de-caja-reportes-y-score).

### Crear y editar

- Dialog "Crear empresa": nombre (2 a 60 caracteres), NIT opcional y sector.
- El NIT se valida solo por formato: 5 a 10 dígitos y dígito de verificación
  opcional (`900123456-7`), igual en Zod y en el `check` de la BD. El DV no se
  valida.
- El sector es una lista cerrada en `SITE.businessSectors`, validada con Zod
  (sin `check` en la BD): agregar uno no exige migración.
- `create_business` (RPC `security invoker`) crea el espacio y su
  `business_profiles` en una transacción. Al crear, la app lleva a
  `/dashboard/business/[id]`.
- El trigger `seed_workspace_accounts` (SPEC 08c) le crea la cuenta
  "Efectivo".
- En Ajustes se editan nombre, NIT y sector. El nombre se ve en el aside.

### Límite

- Cada usuario tiene **una** empresa. `business_workspace_limit()` devuelve
  `1` y es el único punto a cambiar con un plan premium.
- El trigger `check_business_limit` lanza "Alcanzaste el límite de empresas".
  Una empresa programada para borrar cuenta para el límite, así restaurarla
  nunca choca con otra activa.
- `SITE.businessLimit` refleja el valor en la UI. La BD es la que manda.
- Las rutas (`/dashboard/business/[id]`) y el selector de empresa del aside
  ya soportan varias. El selector solo se pinta con más de una.

### Rutas

- `/dashboard/business/[id]` lo valida su layout: un `id` ajeno, inexistente
  o del espacio Personal da 404.
- Navegación: Resumen, Movimientos, Cuentas, Flujo de caja, Reportes,
  Recomendaciones y Ajustes.
- El registro rápido del header registra en la empresa de la ruta.

### Categorías de negocio

- `categories.scope` indica a qué tipo de espacio pertenece una categoría. Las
  del sistema tienen su scope en la semilla. Las propias toman el tipo de su
  espacio por trigger (`set_category_scope`).
- Un espacio solo ve y usa las categorías de su scope: Personal no lista
  categorías de negocio, ni Empresa las personales.
  `check_transaction_category` y `check_expense_category` lo exigen en la BD.
- Semilla de negocio:
  - Ingresos: Ventas de productos, Ventas de servicios y Otros ingresos.
  - Gastos: Costo de ventas, Sueldos y honorarios, Arriendo, Servicios
    públicos, Marketing y publicidad, Transporte y logística, Software y
    herramientas, Impuestos y tasas, Comisiones bancarias y Otros gastos
    operativos.
- Las funciones que buscan categorías del sistema por nombre ("Deudas",
  "Cobros") filtran `scope = 'personal'`.

### Movimientos de Empresa

- Misma tabla, filtros, totales y paginación que Personal (SPEC 02).
- Los textos son "Venta" y "Costo o gasto".
- Campos opcionales, solo en Empresa:
  - `counterparty`: "Cliente" en ventas, "Proveedor" en costos y gastos (máx.
    80 caracteres);
  - `invoice_ref`: "N.º de factura" (máx. 40).
  - En Personal se guardan como `null` y no se muestran.
- La búsqueda de Movimientos (tabla y `transaction_totals`) también busca en
  ellos.
- Clientes y proveedores son texto libre, no entidades.

### Resumen de Empresa

Sobre el mes actual en America/Bogota. Traspasos y ajustes no son ventas ni
costos.

- Tarjeta "Salud del negocio" arriba: score, banda, variación y las 3
  recomendaciones principales no ocultas.
- Tarjetas, con `monthly_totals`:

| Tarjeta          | Cálculo                                               | Sin datos                     |
| ---------------- | ----------------------------------------------------- | ----------------------------- |
| Ventas / Costos  | Suma de ingresos / gastos; variación % vs. mes previo | variación "—" si anterior = 0 |
| Utilidad         | ventas − costos; variación como diferencia en dinero  | diferencia contra 0           |
| Margen           | utilidad / ventas × 100, puede ser negativo           | "—" si ventas = 0             |
| Saldo en cuentas | Σ `account_balances.balance` de las cuentas activas   | `$ 0`                         |

- La variación de costos usa color invertido: subir es malo.
- Barras de ventas vs. costos de los últimos 6 meses (meses vacíos en cero) y
  dona de costos y gastos por categoría del mes (top 6 + "Otras").
- Últimos 5 movimientos.
- Sin movimientos: "Registra tu primera venta" con el botón de nuevo
  movimiento.

### Borrado con periodo de gracia

- En Ajustes, "Eliminar empresa" abre un `AlertDialog` que exige escribir el
  nombre exacto. La action lo revalida en el servidor.
- `request_workspace_deletion` guarda `workspaces.deletion_requested_at`. Es
  `security definer`, idempotente y solo actúa sobre empresas propias.
- Mientras la empresa está marcada:
  - toda ruta de la empresa muestra "Esta empresa se borrará el <fecha>"
    (marca + `SITE.workspaceDeletionGraceDays`, 30 días) con "Restaurar
    empresa" (`cancel_workspace_deletion`);
  - RLS bloquea escribir en sus movimientos, categorías, cuentas, traspasos,
    ajustes y perfil (`is_workspace_writable`).
- El job diario de `pg_cron` `purge-deleted-workspaces` (08:15 UTC) corre
  `purge_deleted_workspaces()`. Borra las empresas marcadas hace más de 30
  días, en cascada a todas sus tablas.

### Seguridad

- `workspaces` tiene `insert` solo de Empresa y sin marca. El `update` es
  solo de Empresa y solo de la columna `name` (privilegio de columna): la marca
  y el `type` no los cambia el usuario. Sin política de `delete`: solo borra
  la purga.
- Personal nunca tiene marca (`check workspaces_personal_not_deleted`).
- `request_workspace_deletion` y `cancel_workspace_deletion` solo las ejecuta
  `authenticated`. `purge_deleted_workspaces` no la ejecuta ningún rol de la
  API.
- Las actions resuelven el espacio con `requireWritableWorkspace(id)`, que
  exige dueño y sin marca antes de escribir.
- Nada usa la `service_role`.

## Empresa: flujo de caja, reportes y score

Flujo de caja, Reportes y Recomendaciones de cada empresa. Todo se arma con lo
registrado: movimientos y saldos de cuentas (SPEC 08c). No hay cuentas por
cobrar ni por pagar.

### Flujo de caja

Página `/dashboard/business/[id]/cash-flow`. Usa el selector de periodo de
Reportes (mes, trimestre, año o rango de hasta 24 meses); por defecto, el año
actual.

| Columna                    | Cálculo                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| Entradas                   | ventas del mes (`monthly_totals.income`), con o sin cuenta           |
| Salidas                    | costos y gastos del mes (`monthly_totals.expense`), con o sin cuenta |
| Neto                       | entradas − salidas                                                   |
| Saldo en cuentas al cierre | `account_monthly_balances` del mes                                   |

- `account_monthly_balances` suma, al fin de cada mes, las cuentas **activas
  hoy**: el saldo inicial si la cuenta se creó (en Bogotá) hasta ese día, más
  ingresos − gastos con cuenta, ± traspasos y + ajustes hasta ese día. Mismas
  reglas que `account_balances`, así que el cierre del mes actual coincide con
  "Saldo en cuentas" de la página Cuentas cuando no hay movimientos futuros.
- Traspasos y ajustes no son entradas ni salidas, pero sí mueven el saldo.
- El neto y la variación del saldo no cuadran cuando hay movimientos sin
  cuenta o ajustes. La página avisa "N movimientos del periodo no tienen
  cuenta y no mueven el saldo" con un enlace a esos movimientos.
- Gráfica de barras de entradas y salidas con línea de saldo al cierre, tabla
  mes a mes y saldo a hoy de cada cuenta activa con el total.

### Reportes de Empresa

Página `/dashboard/business/[id]/reports`: la misma de Personal (SPEC 03) con
"Ventas" y "Costos y gastos". El toggle arranca en costos y gastos y las filas
de la tabla abren los Movimientos de la empresa.

### Periodo de un mes

Mismas definiciones que el score de Personal (ventana, meses cerrados,
semanas de ventana, referencia), con ingresos = ventas y gastos = costos y
gastos. Además:

| Concepto               | Definición                                                                  |
| ---------------------- | --------------------------------------------------------------------------- |
| Costo promedio         | `Σ costos de los meses cerrados (hasta 3) / número de meses cerrados`       |
| Saldo en cuentas       | `account_monthly_balances` al fin de `M`                                    |
| Trimestre reciente     | Los 3 meses cerrados anteriores a `M`                                       |
| Trimestre previo       | Los 3 meses cerrados anteriores al trimestre reciente                       |
| Meses cerrados del año | Hasta 6 meses cerrados anteriores a `M`, desde el mes del primer movimiento |

Datos suficientes: ventas de la ventana > 0 y primer movimiento de hace al
menos 30 días. Los motivos son "Registra tus ventas" y "Necesitamos 30 días de
registros (faltan N días)".

### Factores y pesos

Se calcula al vuelo, sin `score_snapshots`, con la mecánica del score de
Personal (`src/features/score/curves.ts`): interpolación lineal con tope en
los extremos, exclusión y reescalado, bandas, variación e histórico de 12
meses. Los factores y reglas están en `src/features/business-score/`.

| Factor                  | Peso | Dato                                                           | Curva                               | Excluido si                                       |
| ----------------------- | ---- | -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| Margen neto             | 30   | `(ventas − costos) / ventas` de la ventana                     | ≤ 0 % → 0; ≥ 20 % → 100             | nunca                                             |
| Liquidez                | 25   | `max(saldo en cuentas, 0) / costo promedio`, en meses          | 0 → 0; ≥ 3 → 100                    | sin meses cerrados o costo promedio 0             |
| Crecimiento de ventas   | 15   | `(ventas del trimestre reciente − previo) / ventas del previo` | ≤ −20 % → 0; 0 % → 50; ≥ 20 % → 100 | menos de 6 meses cerrados o ventas del previo = 0 |
| Meses con utilidad      | 15   | % de meses cerrados del año con ventas > costos                | 0 % → 0; 100 % → 100                | sin meses cerrados                                |
| Concentración de costos | 10   | % de los costos de la ventana en la categoría de mayor costo   | ≤ 30 % → 100; ≥ 70 % → 0            | costos de la ventana = 0                          |
| Regularidad             | 5    | semanas de ventana con ≥ 1 movimiento / semanas de ventana     | 0 % → 0; 100 % → 100                | nunca                                             |

- **Score:** `round(Σ (peso × puntos) / Σ pesos incluidos)`. Bandas iguales a
  Personal: Débil, Regular, Bueno y Excelente.
- **Liquidez** usa el saldo real en cuentas (saldos iniciales y ajustes
  incluidos), no el balance acumulado.
- **Crecimiento** compara trimestres cerrados: el mes en curso, parcial, haría
  caer el crecimiento cada inicio de mes.

Ejemplo: hoy 31 oct 2026, primer movimiento el 1 de abril, ventas de
9.000.000 de abril a junio y 10.000.000 de julio a octubre, costos de
8.500.000 cada mes ("Costo de ventas" 60 %), saldo en cuentas de 12.750.000 y
movimientos cada semana. Margen 15 % → 75; liquidez 1,5 meses → 50;
crecimiento +11,11 % → 77,78; meses con utilidad 6 de 6 → 100; concentración
60 % → 25; regularidad → 100. Score **69, Bueno**.

### Reglas de recomendación

Se evalúan sobre hoy y el mes actual, aunque el score esté "Sin datos
suficientes". Orden, "Ocultar este mes" y "Mostrar de nuevo" iguales a
Personal, sobre `dismissed_recommendations` de la empresa.

| Regla                  | Condición                                                                                                                            | Severidad | Enlace                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------- |
| `loss_month`           | Último mes cerrado con costos > ventas                                                                                               | alta      | Reportes de ese mes                |
| `negative_account`     | Cuenta activa con saldo a hoy < 0                                                                                                    | alta      | Cuentas                            |
| `low_liquidity`        | Factor liquidez incluido en el mes actual y < 1 mes                                                                                  | alta      | Flujo de caja                      |
| `sales_drop`           | Con 3 meses cerrados antes del último cerrado: ventas del último cerrado ≤ 80 % de su promedio (> 0)                                 | media     | Reportes de ese mes, ventas        |
| `low_margin`           | Ventas de la ventana > 0 y margen neto de la ventana < 10 %                                                                          | media     | Reportes                           |
| `cost_growth`          | Con 3 meses completos antes del último cerrado: categoría ≥ 130 % de su promedio de esos meses y diferencia ≥ 5 % del costo promedio | media     | Movimientos de esa categoría y mes |
| `client_concentration` | Un cliente (`counterparty_totals` de las ventas de la ventana) suma ≥ 50 % de las ventas de la ventana                               | media     | Movimientos de ese cliente, ventas |
| `cost_concentration`   | Una categoría suma ≥ 50 % de los costos de la ventana                                                                                | baja      | Reportes de costos                 |
| `missing_accounts`     | Mes actual con movimientos y `(ventas + costos sin cuenta) / (ventas + costos)` ≥ 30 %                                               | baja      | Movimientos sin cuenta             |
| `irregular_records`    | Regularidad del mes actual < 50 %, solo con datos suficientes. Clave y texto compartidos con Personal                                | baja      | Movimientos                        |

- `client_concentration` agrupa clientes por `lower(btrim())`: "Café Sol" y
  "café sol " son el mismo. Otra ortografía queda separada; clientes como
  entidad van en otro spec.
- En comercio, "Costo de ventas" suele dominar los costos. Por eso la
  concentración pesa 10 y su regla es de severidad baja. Los umbrales se
  pueden revisar con datos reales.

### Aproximaciones

- El estado archivado de las cuentas se toma con su **valor actual**:
  archivar una cuenta cambia el saldo en cuentas de meses pasados. No hay
  `archived_at` histórico.
- Movimientos sin cuenta suman en ventas, costos, entradas y salidas, pero no
  en el saldo en cuentas.

### Estados vacíos

- Empresa sin movimientos: Resumen, Flujo de caja, Reportes y Recomendaciones
  muestran "Registra tu primera venta" con el botón de nuevo movimiento.
- Periodo sin movimientos: "No hay movimientos en este periodo".
- Sin recomendaciones activas: "Todo en orden por ahora".
- Score sin datos: los motivos.

### Seguridad

- `account_monthly_balances` y `counterparty_totals` son `security invoker`,
  `stable` y `search_path = ''`. Solo las ejecuta `authenticated`; con una
  empresa ajena devuelven ceros o vacío.
- Ocultar o mostrar una recomendación en una empresa marcada para borrar falla
  por RLS (`is_workspace_writable`). Una regla de Personal sobre una empresa,
  o al revés, es un error de validación y no escribe.
- Ocultar en Empresa no oculta nada en Personal: las filas son por
  `workspace_id`.

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
8. Importar desde Excel o CSV (más 8b, gastos fijos, deudas y metas, y 8c,
   cuentas y traspasos)
9. Cuenta y perfil
10. Espacio Empresa: crear y registrar operaciones ✅
11. Empresa: flujo de caja, reportes, score y recomendaciones
12. Landing, páginas legales y assets ✅
13. Lanzamiento v1.0
