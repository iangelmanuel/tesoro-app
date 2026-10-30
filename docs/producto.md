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

| Ruta         | Qué es                          | Indexable |
| ------------ | ------------------------------- | --------- |
| `/`          | Landing                         | Sí        |
| `/sign-in`   | Inicio de sesión                | Sí        |
| `/sign-up`   | Registro                        | Sí        |
| `/dashboard` | App principal (requiere sesión) | No        |

Las rutas viven en `SITE.routes`; `robots.ts` bloquea `/dashboard/`, `/api/` y
`/auth/`.

## Landing

Presenta el producto y lleva a crear cuenta: propuesta de valor, funciones
(`SITE.features`), explicación del score, sección de código abierto y CTA a
`/sign-up`.

## Autenticación

Supabase Auth con registro e inicio de sesión. Al registrarse, el usuario
recibe automáticamente su espacio _Personal_.

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

## Score financiero

Puntaje que resume la salud financiera del espacio activo y su evolución en el
tiempo. Se calcula solo con los registros del usuario. Los factores y pesos
exactos se definen al implementar el módulo y deben documentarse aquí.

## Recomendaciones

Sugerencias accionables derivadas de los registros (por ejemplo, categorías
que crecen, meses con déficit, metas en riesgo). Cada recomendación debe
explicar en qué dato se basa.
