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

| Tabla        | Qué guarda                                                                     | RLS (cliente)                         |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------- |
| `profiles`   | Un perfil por usuario: `full_name`, `avatar_url`, `currency` (COP por defecto) | `select` y `update` del propio perfil |
| `workspaces` | Espacios del usuario: `type` (`personal` / `business`) y `name`                | `select` de los propios               |

- Cada usuario tiene **un solo** espacio Personal (índice único parcial) y, en
  el futuro, Empresas ilimitadas.
- El trigger `on_auth_user_created` (función `handle_new_user`, `security
definer`) crea el perfil y el espacio Personal al insertar en
  `auth.users`. Por eso el cliente no tiene políticas de `insert` ni `delete`.
- Los datos de los siguientes módulos (movimientos, metas, deudas…) colgarán
  de `workspace_id`.

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

## Specs

Tesoro se construye en 5 specs (`specs/`), cada uno sobre el anterior:

1. **Autenticación y layout del dashboard**: sesión, `profiles` y
   `workspaces` con RLS, shadcn/ui, tema y aside con tab Personal/Empresa.
2. **Movimientos personales**: ingresos y gastos con categorías.
3. **Resumen y gráficas**.
4. **Gastos fijos, ahorro/metas y tarjetas/deudas**.
5. **Score y recomendaciones**.

## Score financiero

Puntaje que resume la salud financiera del espacio activo y su evolución en el
tiempo. Se calcula solo con los registros del usuario. Los factores y pesos
exactos se definen al implementar el módulo y deben documentarse aquí.

## Recomendaciones

Sugerencias accionables derivadas de los registros (por ejemplo, categorías
que crecen, meses con déficit, metas en riesgo). Cada recomendación debe
explicar en qué dato se basa.
