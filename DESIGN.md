---
name: Tesoro
description: Tus finanzas, claras desde el primer registro.
colors:
  brand: "oklch(69.6% 0.17 162.48)"
  accent-personal: "oklch(50.8% 0.118 165.612)"
  accent-personal-bright: "oklch(72% 0.15 162.5)"
  accent-business: "oklch(55.3% 0.195 38.402)"
  accent-business-bright: "oklch(74% 0.17 48)"
  accent-neutral-dark: "oklch(0.985 0 0)"
  accent-neutral-light: "oklch(0.21 0.016 265)"
  on-accent: "oklch(0.99 0 0)"
  night-background: "oklch(0.125 0.003 264)"
  night-surface: "oklch(0.215 0.005 264)"
  night-surface-secondary: "oklch(0.255 0.005 264)"
  night-overlay: "oklch(0.265 0.005 264)"
  night-default: "oklch(0.29 0.005 264)"
  night-field: "oklch(0.32 0.005 264)"
  night-foreground: "oklch(0.985 0 0)"
  night-muted: "oklch(0.72 0.012 264)"
  day-background: "oklch(0.962 0.004 264)"
  day-surface: "oklch(1 0 0)"
  day-surface-secondary: "oklch(0.967 0.004 264)"
  day-default: "oklch(0.93 0.006 264)"
  day-field: "oklch(0.952 0.006 264)"
  day-foreground: "oklch(0.21 0.016 265)"
  day-muted: "oklch(0.5 0.02 262)"
  income-day: "oklch(50% 0.12 163)"
  income-night: "oklch(60% 0.15 170)"
  expense-day: "oklch(55% 0.23 25)"
  expense-night: "oklch(66% 0.23 25)"
  balance-day: "oklch(43% 0.16 255)"
  balance-night: "oklch(67% 0.16 255)"
  success-day: "oklch(52.7% 0.154 150.069)"
  success-night: "oklch(79.2% 0.209 151.711)"
  warning-day: "oklch(55.5% 0.163 48.998)"
  warning-night: "oklch(82.8% 0.189 84.429)"
  danger-day: "oklch(54% 0.235 27.4)"
  danger-night: "oklch(70.4% 0.191 22.216)"
  danger-button-night: "oklch(57.7% 0.245 27.325)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body-lead:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.56
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  figure:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  chart-bar: "4px"
  field: "20px"
  card: "24px"
  pill: "9999px"
spacing:
  gutter-sm: "16px"
  gutter: "24px"
  card: "20px"
  card-lg: "32px"
  stack: "24px"
  section-sm: "80px"
  section: "96px"
  touch: "44px"
components:
  button-primary-personal:
    backgroundColor: "{colors.accent-personal}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
  button-primary-business:
    backgroundColor: "{colors.accent-business}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
  button-primary-public-night:
    backgroundColor: "{colors.accent-neutral-dark}"
    textColor: "{colors.night-background}"
    rounded: "{rounded.pill}"
  button-danger-night:
    backgroundColor: "{colors.danger-button-night}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
  card-night:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  card-day:
    backgroundColor: "{colors.day-surface}"
    textColor: "{colors.day-foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  field-night:
    backgroundColor: "{colors.night-field}"
    textColor: "{colors.night-foreground}"
    rounded: "{rounded.field}"
  field-day:
    backgroundColor: "{colors.day-field}"
    textColor: "{colors.day-foreground}"
    rounded: "{rounded.field}"
  chip-neutral-night:
    backgroundColor: "{colors.night-default}"
    textColor: "{colors.night-muted}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
  tour-tab-selected-night:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.night-foreground}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
---

# Design System: Tesoro

## Overview

**Creative North Star: "El cofre en orden"**

Tesoro se ve como lo que promete: registros sueltos que, uno a uno, quedan ordenados. Es un sistema oscuro por defecto, sobre una base casi negra, donde las cifras son las protagonistas y todo lo demás se retira. Las superficies no llevan borde; se separan por el contraste entre fondo y tarjeta y por una elevación muy contenida (una sombra difusa en claro, un brillo superior de 1 px en oscuro). La densidad es media: pocas métricas, bien explicadas, con aire entre bloques.

El color es escaso y significa algo. Fuera de los espacios el primario es neutro; dentro, un solo acento por espacio (emerald en Personal, naranja en Empresa) que cambia por ruta y nunca por props. Ingresos, gastos y balance tienen tokens propios que sirven a la vez de texto y de serie de gráfica. La landing lleva el mismo mundo a una escala mayor: titulares grandes y apretados en Inter, el cofre del isotipo armándose con bloques en 3D ("cada registro suma"), y videos reales de la app en marcos claros.

El movimiento llega lento y sin rebote. Una sola curva (expo.out) gobierna la landing; el dashboard se mueve poco y rápido. Todo respeta `prefers-reduced-motion`.

**Key Characteristics:**

- Oscuro por defecto, claro disponible, con el mismo lenguaje en los dos temas.
- Tarjetas sin borde, radios grandes (24 px) y controles en pill.
- Un solo acento por espacio; el resto es neutro de matiz 264.
- Color por significado: dinero y estados desde tokens, nunca desde la paleta cruda de Tailwind.
- Inter en todo, con cifras tabulares.
- Movimiento corto en la app, revelados de 0.7 s en la landing, una sola curva.

## Colors

Neutros fríos de un solo matiz (264), un primario por espacio y una familia semántica para el dinero y los estados; cada par texto/fondo cumple AA en claro y oscuro.

### Primary

- **Emerald de Personal** (`accent-personal`, emerald-700): relleno de botones primarios, pestaña activa y acentos del espacio Personal, con texto blanco (5.22:1). Es el tono 700 a propósito: el primero que da AA con blanco.
- **Emerald brillante** (`accent-personal-bright`): solo en oscuro, para el anillo de foco y el texto suave del acento, porque el 700 no contrasta con el fondo casi negro.
- **Naranja de Empresa** (`accent-business`, orange-700) y **Naranja brillante** (`accent-business-bright`): los mismos papeles en el espacio Empresa.
- **Primario neutro** (`accent-neutral-dark` / `accent-neutral-light`): el primario fuera de los espacios (landing, auth, cuenta). En oscuro es casi blanco con texto oscuro; en claro, casi negro con texto claro.

### Secondary

- **Emerald de marca** (`brand`, emerald-500): el color del isotipo. No cambia con el tema ni con el espacio. Como texto pequeño se usa mezclado con el foreground (utilidad `text-brand`, 5.06:1 en claro, 11.74:1 en oscuro), nunca puro.

### Tertiary

- **Verde ingreso, rojo gasto y azul balance** (`income-*`, `expense-*`, `balance-*`): texto ≥ 4.5:1 sobre superficie y fondo, y series de gráfica en ese orden fijo. En la landing, `--income` es además el verde de acento: viñetas de las promesas, subrayado de enlaces, checks de los espacios y los siete tonos de la barra de factores del score.
- **Estados** (`success-*`, `warning-*`, `danger-*`): green-700/amber-700/rojo en claro y sus 400 en oscuro, para chips, barras y errores. El botón de peligro en oscuro usa su propio relleno (`danger-button-night`, red-600) con texto blanco; `--danger` sigue en red-400 para texto.
- **Categorías y serie neutra** (`--category-*`, `--chart-1…5` en `globals.css`): 12 colores que el usuario elige por categoría (tono 500–600 en claro, 400 en oscuro, ≥ 3:1) y una serie slate escalonada para gráficas sin significado.

### Neutral

- **Noche profunda** (`night-background`, ≈ `#07080a`): fondo de página en oscuro.
- **Tarjeta grafito** (`night-surface`, ≈ `#16171a`), **grafito medio** (`night-surface-secondary`) y **overlay** (`night-overlay`): tarjetas, niveles internos y diálogos/menús, escalonados para que cada nivel se lea sin borde.
- **Gris de control** (`night-default`) y **relleno de campo** (`night-field`): ítem activo del aside, chips neutros y hover de filas; los campos van más claros que la tarjeta y el modal.
- **Texto** (`night-foreground`) y **texto atenuado** (`night-muted`, 7.06:1 sobre la tarjeta).
- **Papel gris** (`day-background`, `#f1f2f5`), **tarjeta blanca** (`day-surface`), y sus equivalentes `day-*`: la misma estructura en claro.

### Named Rules

**La Regla de Un Acento.** Cada pantalla tiene un solo primario, y lo decide la ruta: `WorkspaceThemeRoot` pinta `data-workspace` y `globals.css` lo aplica con `:has()`. Un color de espacio nunca se pasa por props ni se escribe en un componente.

**La Regla del Texto Blanco.** Todo botón de color lleva texto blanco sobre un tono 700 (o red-600 en peligro oscuro). Si un relleno nuevo no da 4.5:1 con blanco, se oscurece el relleno; no se cambia el texto.

**La Regla del Significado.** Ingresos, gastos, balance y estados salen de sus tokens (`tone.ts` para chips, barras y cifras). La paleta cruda de Tailwind (`emerald-*`, `amber-*`, `rose-*`…) no se usa para color de interfaz. Un aumento de gastos se pinta como malo aunque el número suba.

## Typography

**Display Font:** Inter (con `ui-sans-serif, system-ui`)
**Body Font:** Inter (con `ui-sans-serif, system-ui`)

**Character:** Una sola familia, de peso 600 y tracking cerrado en los títulos, regular y atenuada en el texto de apoyo. La jerarquía la dan el tamaño y el color, no una segunda fuente.

### Hierarchy

- **Display** (600, 2.25rem → 3rem → 3.75rem, interlineado 1, tracking −0.025em): solo el H1 del hero y el título del cierre de la landing, que repiten el slogan. Con `text-balance`.
- **Headline** (600, 1.875rem → 2.25rem, tracking −0.025em): el `<h2>` de cada sección de la landing (`SectionHeading`), máximo 42 rem de ancho, con `text-balance`.
- **Title** (600, 1.25rem): títulos de tarjeta en la landing; en el dashboard, el `<h1>` único del header y los `<h2>` de `CardHeading`.
- **Body lead** (400, 1.125rem, atenuado): bajada del hero y descripción de sección, con `text-pretty`, máximo ~36 rem.
- **Body** (400, 1rem): texto corrido.
- **Label** (500, 0.875rem): etiquetas, chips, pestañas, nombres de factores. Sin mayúsculas sostenidas ni tracking abierto.
- **Figure** (600, `tabular-nums`): montos, KPIs, tablas, ejes y porcentajes; las fechas y porcentajes llevan espacio duro para no partirse.

### Named Rules

**La Regla del Título Solo.** Un título se sostiene sin etiqueta encima: ni eyebrow, ni kicker, ni texto en versalitas sobre el `<h2>`. Una sola `<h1>` por pantalla; en el dashboard la pone el header.

**La Regla de la Cifra Quieta.** Todo número que se compara lleva `tabular-nums`. Los saldos y totales pasan por `<Amount />` para poder ocultarse.

## Layout

En la landing, cada sección es una franja de ancho completo con un contenedor centrado de 72 rem (`max-w-6xl`), márgenes de 16 px (24 px desde 640 px) y padding vertical de 80 px (96 px desde 640 px); el cierre sube a 96/128 px. Las secciones con contenido de apoyo usan una grilla de dos columnas desde 1024 px (texto + visual: hero `1.05fr / 1fr`, score `1fr / 26rem`, recorrido de funciones `21rem / 1fr`) y se apilan en móvil con el visual primero. La única franja tintada es la de los espacios (`--default` al 40 %); el resto va sobre el fondo. El ritmo interno se apoya en saltos de 24 y 40 px entre bloques.

En el dashboard, aside a la izquierda y header con el único título y los accesos rápidos. Por debajo de 768 px el aside pasa a un Drawer, aparece la barra inferior con [+] al centro y la hoja de acciones rápidas, y todo control mide 44 px o más (56 px las acciones de la hoja). Las tablas se deslizan en horizontal dentro de `ScrollTable` en vez de convertirse en tarjetas.

**La Regla del Pulgar.** Por debajo de 768 px ningún control táctil mide menos de 44 × 44 px.

## Elevation & Depth

Sistema híbrido y muy contenido: la profundidad la da primero el escalón tonal entre fondo, tarjeta y overlay, y luego una sombra de dos niveles que cambia de naturaleza con el tema. En claro es una sombra teñida con el foreground (nunca negro puro), fina de contacto y difusa ambiental. En oscuro es un brillo superior de 1 px, la luz que cae sobre el borde alto, más una sombra profunda. No hay trazo alrededor de ninguna superficie.

### Shadow Vocabulary

- **Tarjeta** (`--surface-shadow`; claro `0 1px 2px 0 oklch(0.21 0.016 265 / 0.05), 0 6px 20px -4px oklch(0.21 0.016 265 / 0.07)`; oscuro `inset 0 1px 0 0 oklch(1 0 0 / 0.055), 0 8px 24px -10px oklch(0 0 0 / 0.5)`): toda superficie sobre el fondo, incluidas listas, ítems de grilla, notas, pestaña activa del recorrido y tarjetas de la landing.
- **Overlay** (`--overlay-shadow`; claro `0 2px 6px 0 … / 0.06, 0 18px 44px -10px … / 0.16`; oscuro `inset 0 1px 0 0 oklch(1 0 0 / 0.08), 0 18px 44px -10px oklch(0 0 0 / 0.7)`): menús, diálogos, popovers, tooltips y el overlay de arrastre.

### Named Rules

**La Regla de Un Nivel.** Cada pila de tarjetas lleva una sola sombra: lo anidado dentro de una tarjeta se separa por tono (`surface-secondary`, `surface-tertiary`, `default`), no con otra sombra.

**La Regla Sin Halo.** La luz no se pinta con degradados: nada de resplandores radiales, focos ni manchas de color detrás del contenido.

## Shapes

Formas amplias y amables, sin aristas duras. Las tarjetas y paneles usan un radio grande (24 px), igual que el marco de los videos y la pestaña activa del recorrido. Botones, pestañas, selects, filtros, chips y la barra de factores del score son pill (9999 px). Los campos de formulario van a 20 px, que a su altura de 36–40 px se lee como pill. Las barras de las gráficas redondean solo su borde superior (4 px). Los puntos (viñetas, leyendas, factores) son círculos de 6–10 px. El isotipo, un cofre sobre un cuadro redondeado, es la única silueta recurrente; la escena 3D del hero lo reconstruye en bloques.

## Components

### Buttons

Firmes y redondos; el color solo aparece en el principal.

- **Shape:** pill (9999 px), de HeroUI v3 (`buttonVariants`), con `onPress`.
- **Primary:** relleno del primario de la ruta con texto blanco dentro de un espacio; neutro (claro sobre oscuro) en la landing. En la landing va en tamaño `lg` y con flecha.
- **Hover / Focus:** hover más oscuro (`--accent` mezclado con 12 % de negro), nunca más claro; anillo de foco con `--focus` (`--accent-bright` en oscuro). En la landing, los CTA se levantan 2 px al pasar y se comprimen al 97 % al pulsar (resorte 420/30).
- **Secondary:** `outline` solo para la acción secundaria del hero ("Ver la demo"). En barras de herramientas del dashboard, `ghost` con relleno de superficie (`CONTROL_BUTTON`), nunca `outline`.
- **Danger:** en oscuro, red-600 con texto blanco; las acciones destructivas van al final de los menús.
- **Enlaces de texto:** las acciones terciarias (código abierto, "Ya tengo cuenta") son enlaces con subrayado de 2 px en `--income` al 40 % que se completa al pasar, de 44 px de alto, para no competir con el CTA.

### Chips

- **Style:** pill sin borde, 0.875rem. Estados desde `TONE_BADGE_CLASSES` (`*-soft` con su `*-soft-foreground`, ≥ 6.3:1); `info` usa `--balance` al 15 %; neutro en `--default` con texto atenuado.
- **State:** el filtro activo va en `accent-soft`; los inactivos, en el gris de superficie.

### Cards / Containers

- **Corner Style:** 24 px.
- **Background:** `--surface` sobre `--background`; dentro, niveles `surface-secondary` y `surface-tertiary`.
- **Shadow Strategy:** `--surface-shadow`, un solo nivel (ver Elevation & Depth).
- **Border:** ninguno. Nunca `rounded-xl border` ni `border-dashed`; las listas usan divisores `--separator` entre filas.
- **Internal Padding:** 20 px en ítems de grilla y filas de lista (16 × 20 px), 24–32 px en las tarjetas de la landing.
- **Piezas propias:** `StatCard` (KPI), `CardHeading`, `EmptyState` / `CardEmpty`, `CardSkeleton` y las clases de `surface.ts`.

### Inputs / Fields

- **Style:** relleno suave sin trazo (`--field-background`; `--field-border` transparente), radio de 20 px. En oscuro el campo es más claro que la tarjeta y que el modal.
- **Focus:** anillo de foco; el relleno no cambia.
- **Error / Disabled:** `FieldError` dentro del campo, texto en `--danger`; validación del servidor (`validationBehavior="aria"`).

### Navigation

- **Header público:** sticky, transparente arriba de todo; tras 8 px de scroll toma el fondo al 80 % (60 % con soporte de blur), desenfoque y un divisor inferior, en 300 ms.
- **Aside del dashboard:** logo, pestañas Personal / Empresa, navegación con el ítem activo en `--default`; tema y usuario abajo. En móvil, Drawer más barra inferior de 4 destinos y [+].

### Recorrido de funciones (landing)

Una lista vertical de pestañas a la izquierda y un clip grande a la derecha, en vez de una grilla de tarjetas iguales. La pestaña activa se vuelve tarjeta (superficie, 24 px, sombra de tarjeta) y despliega su descripción; las inactivas son solo texto atenuado. Navegable con flechas, Inicio y Fin.

### Marco de video (landing)

El video demo y los clips viven en un marco de 16:9 con radio de 24 px que es claro en los dos temas, porque los videos traen su propio escritorio claro. Los botones del reproductor son círculos blancos translúcidos con desenfoque. Nunca hay autoplay en el demo (`preload="none"`); los clips se reproducen en silencio solo en pantalla y se quedan en el póster con reduced motion o ahorro de datos. Los videos están en `public/videos/`, renderizados con Hyperframes.

### Score (landing)

Una barra única de 12 px en pill que suma 100, partida en siete tramos de `--income` en opacidad decreciente según el peso, que se descubre de izquierda a derecha con el scroll sin deformarse. Al lado, un medidor dividido en las cuatro bandas del score (`score-bands.ts`: Débil `--danger`, Regular `--warning`, Bueno `--balance`, Excelente `--income`), con su leyenda en chips de `tone.ts`.

### Escena del hero

Un cofre en bloques (el isotipo) que se arma desde una nube de bloques sueltos, con colores leídos de `--brand` e `--income`, sin sombras ni postproceso. Se carga solo si el equipo lo permite (`hero-scene-loader.tsx`) y deja de renderizar fuera de pantalla; si no, queda el mockup del panel (`hero-visual.tsx`).

### Movimiento

- **Landing:** una sola curva, expo.out `cubic-bezier(0.16, 1, 0.3, 1)`. Revelado al entrar en pantalla: 0.7 s desde 24 px abajo y opacidad 0; listas escalonadas cada 80 ms; una vez por elemento. Los revelados son CSS con un único `IntersectionObserver` (`data-reveal`, `data-pending`); lo visible al cargar nunca se oculta. Motion (`LazyMotion` estricto, `MotionConfig reducedMotion="user"`) queda solo para el reproductor y el recorrido de funciones. Con reduced motion o sin JS, todo aparece en su estado final.
- **Dashboard:** tarjetas en 180 ms desde casi visibles, hover de 150 ms, gráficas en 400 ms; nada con `prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:

- **Do** separar las superficies por tono y por `--surface-shadow`, con radio de 24 px y sin borde.
- **Do** tomar el primario de la ruta (`data-workspace` + `:has()`), con texto blanco sobre el tono 700 y `--accent-bright` para foco y texto suave en oscuro.
- **Do** pintar dinero y estados con `--income`, `--expense`, `--balance` y `tone.ts`, en ese orden fijo en las gráficas.
- **Do** verificar AA (4.5:1 texto, 3:1 gráficos y foco) en claro y oscuro para todo par nuevo.
- **Do** usar la curva expo.out y los tiempos de `reveal.tsx` en la landing, sin duplicarlos.
- **Do** llevar `tabular-nums` en toda cifra comparable.
- **Do** dar a cada control táctil 44 px o más por debajo de 768 px.

### Don't:

- **Don't** poner eyebrows ni kickers sobre los títulos de sección.
- **Don't** meter íconos en cuadros o círculos de color como decoración de una función.
- **Don't** vender funciones con una grilla de tarjetas iguales; en la landing se muestran con el recorrido de pestañas y un clip grande. Las grillas de datos del dashboard (deudas, metas, cuentas) sí son nativas.
- **Don't** usar degradados radiales, halos ni focos de luz detrás del contenido.
- **Don't** escribir titulares en fórmula ("No es X, es Y", tríadas de frases cortas).
- **Don't** usar la paleta cruda de Tailwind para color de interfaz ni pasar colores de espacio por props.
- **Don't** usar `rounded-xl border`, `border-dashed` ni `variant="outline"` en superficies y barras de herramientas del dashboard.
- **Don't** reproducir video con sonido ni en automático el demo principal; los clips se detienen fuera de pantalla.
