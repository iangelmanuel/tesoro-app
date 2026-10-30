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

| Tabla          | Qué guarda                                                                         | RLS (cliente)                          |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| `profiles`     | Un perfil por usuario: `full_name`, `avatar_url`, `currency` (COP por defecto)     | `select` y `update` del propio perfil  |
| `workspaces`   | Espacios del usuario: `type` (`personal` / `business`) y `name`                    | `select` de los propios                |
| `categories`   | Categorías de ingreso o gasto: del sistema (`workspace_id` null) o propias         | `select`, `insert` y `update`          |
| `transactions` | Movimientos: `type`, `amount`, `occurred_on`, `category_id`, `description`, `note` | `select`, `insert`, `update`, `delete` |

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
- Presupuestos por categoría
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
