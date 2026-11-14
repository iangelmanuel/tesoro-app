# SPEC 40 — Hero con video de fondo sin Three.js y pulido de landing y dashboard

> **Estado:** Aprobado
> **Depende de:** SPEC 12, SPEC 24, SPEC 31, SPEC 37, SPEC 38
> **Fecha:** 2026-11-13 (ampliado 2026-11-14)
> **Objetivo:** Reemplazar la escena 3D del hero por un hero tipográfico sobre un video de fondo con tinte verde, que se pinte completo y estable en la primera carga; rediseñar las secciones de score y espacios de la landing; dejar el fondo claro de la landing en blanco puro; poner iconos de redes en el footer; y pulir en el dashboard el selector de mes de Gastos e Ingresos fijos, los paneles laterales de detalle y el pie del aside.

## Por qué existe este spec

SPEC 24 puso en el hero una escena 3D (React Three Fiber) que se carga después del HTML, con el mockup `hero-visual.tsx` como fallback. En la primera carga se ve el mockup o un hueco y luego salta a la escena: el primer vistazo se ve roto.

El video demo (SPEC 24) ya muestra el producto más abajo. El hero no tiene que mostrar la app: tiene que vender la idea (orden con tu dinero, en casa y en el negocio) y llevar al registro. Se quitan la escena, el mockup y Three.js, y en su lugar va un video de ambiente hecho con Hyperframes a partir de material de stock libre de derechos, con un tinte verde de marca y el texto encima.

Además, varias piezas recientes se salen del diseño:

- **Selector de mes en Gastos fijos e Ingresos fijos** (SPEC 37 y 38). `MonthNav` pinta flechas sueltas y el mes en texto plano dentro de la tarjeta "Próximos pagos". En Movimientos el mismo control es una píldora (`CONTROL_SURFACE`) con flechas y mes dentro, alineada con la búsqueda. Hay que usar ese patrón.
- **Paneles laterales de detalle** (Ingresos fijos, Gastos fijos, Deudas y por cobrar, Metas, Categorías). Funcionan, pero cuesta entender qué es cada bloque, qué está pendiente y qué acción toca. Además no son uniformes: unos abren abajo en móvil y otros siempre a la derecha.
- **Pie del aside**: "Ayuda" y el cambio de tema ocupan una fila propia encima del menú de cuenta. Van dentro del menú de cuenta.
- **Landing**: las secciones "Tu salud financiera, en un número de 0 a 100" y "Tu casa y tu negocio, cada uno en su lugar" se leen genéricas (tarjetas repetidas, iconos decorativos, simetría de plantilla). El fondo claro de la landing es el gris del dashboard; la landing va en blanco. El footer lista las redes solo con texto.

Es el quinto de cinco specs del mismo pedido (SPEC 36 a 40). Todo el diseño se guía con Impeccable (`PRODUCT.md`, `DESIGN.md`, `.claude/skills/impeccable/`) y nada sale del sistema actual: mismos tokens, radios, píldoras, tarjetas sin borde y tipografía Inter.

## Alcance

**Entra:**

### 1. Hero con video de fondo (landing)

- **Texto** en `src/features/landing/components/hero.tsx`, una columna:
  - título (`SITE.info.slogan`), subtítulo, CTA principal (**Crear cuenta** / `SITE.navigation.cta`), CTA secundario **Ver la demo** (`#demo`) y promesas (Gratis, Sin conectar bancos, Código abierto);
  - jerarquía, tamaños, alineación, ancho de línea, alto del hero y espacio vertical se definen con `/impeccable shape` antes de escribir código y se documentan en `DESIGN.md`;
  - el texto de título y subtítulo se puede reescribir en ese paso; cambios del slogan van en `SITE.info.slogan`;
  - solo tokens existentes; sin gradientes de texto ni efectos que Impeccable marque como antipatrón;
  - se conserva la entrada escalonada `hero-enter` solo si no desplaza el layout; respeta `prefers-reduced-motion`.
- **Video de fondo** (`public/videos/hero.*`):
  - **Contenido:** ambiente de finanzas cotidianas, no la app. Tomas cortas de stock: manos con monedas o billetes, una libreta de cuentas, una calculadora, una tienda o un pequeño negocio, una mesa de cocina con recibos. Sin caras en primer plano ni marcas visibles.
  - **Origen:** solo material con licencia de uso comercial libre y sin atribución obligatoria (Pexels License, Pixabay Content License o Mixkit Free License). Cada clip se registra en `docs/creditos-media.md` con URL, autor, licencia y fecha de descarga, aunque la licencia no exija crédito. Nada con licencia editorial ni generada con marcas de agua.
  - **Edición con Hyperframes** (`video/hero/`, git-ignorado como el resto de `video/`): 12–16 s en loop sin corte visible (la última toma funde con la primera), cortes lentos o fundidos, movimiento de cámara suave. Sin texto ni logo dentro del video: el texto vive en el HTML.
  - **Tinte verde:** gradación duotono hacia el verde de marca (`--brand` / emerald) con negros profundos, más un velo oscuro encima del video en CSS. El velo se ajusta en claro y oscuro hasta que todo el texto del hero dé AA sobre el fotograma más claro del loop.
  - **Codificación:** sin audio. Escritorio 1920 × 1080 y móvil 720 × 1280 (recorte vertical), H.264 (MP4) y VP9 (WebM), más póster WebP del primer fotograma de cada uno. Presupuesto del hero ≤ 4 MB en total (las cuatro variantes y los dos pósters).
  - **Presupuesto de `public/videos/`:** hoy ocupa ~25 MB, el tope de SPEC 24. El tope sube a **30 MB** solo para dar cabida al hero; se documenta en `CLAUDE.md` y `docs/ui.md`.
- **Sin salto en la primera carga:**
  - el hero es componente de servidor; el contenedor del video tiene tamaño fijo por CSS (`absolute inset-0`, `object-cover`) y el póster va como `poster` del `<video>`, así el primer pintado ya es la imagen final;
  - `<video autoplay muted loop playsinline preload="metadata">` con `<source media>` para escritorio y móvil; ningún tamaño del hero depende de JavaScript;
  - con `prefers-reduced-motion: reduce` o `Save-Data` solo se ve el póster: CSS oculta el video y una isla cliente mínima lo pausa y evita la descarga. Esa isla no cambia ningún tamaño;
  - el video lleva `aria-hidden="true"` y no tiene controles: es decoración.
- **Quitar Three.js:**
  - borrar `hero-scene.tsx`, `hero-scene-loader.tsx` y `hero-visual.tsx`;
  - `pnpm remove three @react-three/fiber @types/three` y lockfile sincronizado;
  - quitar configuración que solo exista para ellos (`next.config.ts`, CSS de la escena en `globals.css`).
- **Móvil (< 768 px):** a 390 × 844, título, subtítulo y CTA principal se ven sin desplazar; CTA de 44 px o más.

### 2. Fondo blanco en la landing (tema claro)

- En claro, todas las páginas públicas (`app/(public)/`, incluida la landing y las legales) usan fondo `#FFFFFF`. El gris actual de `--background` (`oklch(0.962 0.004 264)`) queda solo para el dashboard y la auth si Impeccable no indica otra cosa.
- Se implementa en `globals.css` redefiniendo `--background` (y los tokens que dependan de él, como `--surface` de las tarjetas de la landing) bajo un ámbito de las páginas públicas, por ejemplo un `data-surface="site"` en el layout de `(public)`. No se tocan colores en componentes.
- Las tarjetas de la landing siguen distinguiéndose del fondo en claro (superficie gris muy suave, sin borde), y se verifica que su texto dé AA.
- El oscuro no cambia.

### 3. Sección "Tu salud financiera, en un número de 0 a 100"

- `score-section.tsx`, `score-visual.tsx` y `score-bands.ts` se rediseñan con `/impeccable shape` + `/impeccable critique`, con la **misma información** que hoy (qué mide el score, sus factores, las bandas y que se calcula con tus propios registros).
- Se quitan los patrones que Impeccable marca como plantilla de IA: rejilla de tarjetas iguales con icono + título + texto, iconos decorativos, gradientes, contadores animados sin propósito, simetría centrada por defecto.
- Dirección inicial a validar en el shape: el número como protagonista (una cifra grande con su banda y una frase de lectura), y los factores como una lista o una barra compuesta con su peso, no como tarjetas. Las bandas como una escala única, no como chips sueltos.
- Colores solo de tokens (`--income`, `--expense`, `--balance`, `--chart-*`, `tone.ts`).

### 4. Sección "Tu casa y tu negocio, cada uno en su lugar"

- `workspaces-section.tsx` se rediseña igual, con la misma información (Personal por defecto con su estructura; Empresa opcional con la suya; datos separados).
- Dirección inicial a validar: una comparación lado a lado que use los colores reales de cada espacio (emerald en Personal, naranja en Empresa, como en el dashboard) y muestre la estructura de cada uno como el aside real (los grupos de SPEC 31), en vez de dos tarjetas con lista de viñetas.
- Si la sección usa el clip `espacios`, se conserva; no se graba material nuevo.

### 5. Footer con iconos de redes

- `src/components/site/site-footer.tsx`: el grupo de redes (GitHub, LinkedIn, X, Sitio web) se muestra con el icono de cada red y su nombre (o solo el icono con `aria-label` y tooltip, según defina Impeccable).
- Iconos de marca como SVG propios en `src/components/site/social-icons.tsx`, tomados de Simple Icons (CC0). `lucide-react` solo para "Sitio web" (`Globe`). Los iconos de marca en `currentColor`, sin los colores de cada marca.
- Objetivos táctiles de 44 px o más en móvil; foco visible.

### 6. Selector de mes en Gastos fijos e Ingresos fijos (dashboard)

- `MonthNav` (`src/components/dashboard/month-nav.tsx`) adopta el patrón de Movimientos: una sola píldora `CONTROL_SURFACE` con flecha anterior, mes y flecha siguiente dentro (`min-h-11`, flechas `size-11` en móvil y `size-10` en escritorio, `aria-live="polite"` en el mes).
- Se extrae un componente compartido (por ejemplo `MonthSwitcher`) que usan tanto `MonthNav` como `transactions-filters.tsx`, para que no haya dos versiones del mismo control.
- Ubicación: en Gastos fijos e Ingresos fijos el selector sale del cuerpo de la tarjeta "Próximos pagos" / "Pagos de …" y pasa a la barra superior de la página o a la derecha de la cabecera de la tarjeta (`CardHeading`), según defina `/impeccable shape`. En móvil ocupa el ancho completo.
- Presupuestos (`budget-month-nav.tsx`) hereda el cambio sin trabajo extra.
- La lógica de `?month` y los límites (`parseRecurringMonth`) no cambian.

### 7. Paneles laterales de detalle (dashboard)

Afecta a `recurring-income-sheet.tsx`, `recurring-expense-sheet.tsx`, `debt-sheet.tsx` (deudas y por cobrar), `goal-sheet.tsx` y `categories-sheet.tsx`.

- Se mantiene la idea actual (Drawer a la derecha en escritorio) y se mejora para que se entienda de un vistazo, con `/impeccable critique` y `/impeccable clarify` sobre cada panel:
  - **Cabecera:** nombre, estado (con `tone.ts`) y la cifra clave (monto, saldo pendiente o progreso) en una sola zona.
  - **Resumen primero:** lo que importa hoy (próximo pago o cobro, lo pagado este mes, lo que falta) antes del historial y la configuración.
  - **Secciones con título claro** (`CardHeading` o el mismo estilo de encabezado de sección en todos), en el mismo orden en todos los paneles: resumen → acción del momento → historial → detalles → zona de peligro.
  - **Acciones:** la acción principal (registrar pago, marcar recibido, abonar) visible sin desplazar; editar y eliminar agrupados abajo o en `RowActions`.
  - Textos de ayuda con `HelpHint` donde un término no sea obvio (frecuencia, cuota, recibos múltiples).
- **Uniformidad:** todos abren abajo en móvil (`placement="bottom"` con `Drawer.Handle`) y a la derecha en escritorio, con el mismo ancho máximo. Un componente base compartido (por ejemplo `DetailSheet`) define estructura, ancho, cabecera y pie; cada panel solo aporta su contenido.
- Sin cambios de datos ni de actions.

### 8. Pie del aside: Ayuda y tema dentro del menú de cuenta

- `app-sidebar.tsx`: se quita la fila con el enlace "Ayuda" y `ThemeToggle`. En el pie queda solo `UserMenu`.
- `user-menu.tsx`: el Dropdown suma:
  - **Ayuda** (icono `CircleHelp` + `ArrowUpRight`), abre `SITE.repository.issues` en otra pestaña, con el texto para lectores de pantalla actual;
  - **Tema** como control de tabs (HeroUI `Tabs`, píldora) con **Claro** y **Oscuro**, dentro del menú y sin cerrarlo al cambiar.
  - Orden: Cuenta → Ayuda → separador → Tema → separador → Cerrar sesión (ajustable en el shape).
- Aplica igual en el Drawer móvil, que usa el mismo aside.
- `ThemeToggle` se borra si queda sin uso en el dashboard; el toggle de la landing (`site-theme-toggle.tsx`) no cambia.

### 9. Skeletons del dashboard

Cada cambio de los puntos 6 a 8 actualiza su estado de carga en la misma tarea, para que el skeleton tenga la misma forma y el mismo tamaño que el contenido final (sin salto al cargar):

- **Selector de mes:** los skeletons de Movimientos, Gastos fijos, Ingresos fijos y Presupuestos (`fallback` de `Suspense` en sus `page.tsx` y `CardSkeleton`) muestran la píldora del selector en su nueva ubicación, con su alto (`min-h-11`) y ancho, no las flechas sueltas.
- **Paneles de detalle:** `DetailSheet` trae su propio skeleton de cuerpo (cabecera con cifra, resumen, acción, historial) que reemplaza los skeletons propios de `recurring-income-sheet.tsx` y `recurring-expense-sheet.tsx`; los paneles que hoy no tienen estado de carga y lo necesiten (datos que se piden al abrir) lo usan.
- **Pie del aside:** `app-sidebar-skeleton.tsx` quita el hueco de la fila Ayuda + tema y deja solo el del menú de cuenta.
- Skeletons con los mismos tokens y radios del contenido (tarjetas sin borde, píldoras), con `aria-busy` en el contenedor y sin animación con `prefers-reduced-motion: reduce`.

### 10. Documentación

- `DESIGN.md`: hero, video, fondo blanco de la landing, nuevas secciones de score y espacios, `MonthSwitcher`, `DetailSheet` y menú de cuenta.
- `docs/ui.md`: tokens del ámbito `site`, patrón de selector de mes, estructura de paneles de detalle, pie del aside y presupuesto de video.
- `docs/producto.md` y `PRODUCT.md`: quitar la escena 3D y el mockup; describir el hero nuevo.
- `docs/creditos-media.md` (nuevo): fuentes y licencias del material del video del hero.
- `CLAUDE.md`: comando de render del hero y tope de 30 MB en `public/videos/`.
- `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Otras secciones de la landing (demo, funciones, agentes, código abierto, CTA final), salvo heredar el fondo blanco en claro.
- Grabar la app de nuevo o re-renderizar los clips existentes.
- Cambios en metadata, Open Graph o la imagen OG.
- Rediseño de la navegación de la landing.
- Cambios de datos, queries o actions de Gastos fijos, Ingresos fijos, Deudas, Metas o Categorías.
- Un tema "Sistema" en el selector de tema.

## Modelo de datos

Este spec no introduce datos. Solo cambia componentes, estilos, dependencias, assets y documentación.

Archivos:

```text
src/features/landing/components/hero.tsx                 (cambia)
src/features/landing/components/hero-video.tsx           (nuevo, isla cliente mínima: pausa con reduced-motion / Save-Data)
src/features/landing/components/hero-scene.tsx           (se borra)
src/features/landing/components/hero-scene-loader.tsx    (se borra)
src/features/landing/components/hero-visual.tsx          (se borra)
src/features/landing/components/score-section.tsx        (cambia)
src/features/landing/components/score-visual.tsx         (cambia o se reemplaza)
src/features/landing/components/workspaces-section.tsx   (cambia)
src/components/site/site-footer.tsx                      (cambia)
src/components/site/social-icons.tsx                     (nuevo)
app/(public)/layout.tsx                                  (ámbito data-surface="site")
src/styles/globals.css                                   (fondo blanco del ámbito site; sin estilos de la escena)
src/components/dashboard/month-nav.tsx                   (cambia)
src/components/dashboard/month-switcher.tsx              (nuevo, compartido con Movimientos)
src/features/transactions/components/transactions-filters.tsx (usa MonthSwitcher)
src/features/recurring-expenses/components/recurring-view.tsx  (ubicación del selector)
src/features/recurring-incomes/components/recurring-income-view.tsx (ubicación del selector)
src/components/dashboard/detail-sheet.tsx                (nuevo, base de los paneles)
src/features/*/components/*-sheet.tsx                    (cinco paneles, usan DetailSheet)
src/components/dashboard/app-sidebar.tsx                 (sin Ayuda ni ThemeToggle)
src/components/dashboard/user-menu.tsx                   (Ayuda y tabs de tema)
src/components/theme/theme-toggle.tsx                    (se borra si queda sin uso)
src/components/dashboard/app-sidebar-skeleton.tsx        (sin la fila Ayuda + tema)
src/components/dashboard/card-skeleton.tsx               (variante con selector de mes si hace falta)
app/dashboard/**/page.tsx                                (fallbacks de Movimientos, Gastos fijos, Ingresos fijos y Presupuestos)
public/videos/hero.mp4, hero.webm, hero-mobile.mp4, hero-mobile.webm,
  hero-poster.webp, hero-mobile-poster.webp               (nuevos)
package.json, pnpm-lock.yaml                             (sin three, @react-three/fiber, @types/three)
docs/producto.md, docs/ui.md, docs/creditos-media.md,
  PRODUCT.md, DESIGN.md, CLAUDE.md, CHANGELOG.md          (cambian)
```

## Plan de implementación

1. **Dirección con Impeccable.** `/impeccable shape` con `PRODUCT.md` como contexto sobre: hero (texto + video), sección de score, sección de espacios, footer, selector de mes, panel de detalle base y menú de cuenta. Resultado: dirección y textos aprobados por el usuario antes de tocar código.
2. **Fondo blanco de la landing.** Ámbito `site` en `globals.css` y en el layout de `(public)`; revisar contraste de las tarjetas.
3. **Video del hero.** Elegir y descargar los clips de stock (registrar licencias), componer en Hyperframes (`video/hero/`), gradación verde, render y codificación en las cuatro variantes más pósters. Verificar el presupuesto de 4 MB.
4. **Hero nuevo.** Reescribir `hero.tsx` con el video de fondo, el velo y el texto. Borrar la escena, el mockup y `pnpm remove three @react-three/fiber @types/three`.
5. **Secciones de score y espacios.** Rediseño según el paso 1, luego `/impeccable critique` para confirmar que no queda plantilla de IA.
6. **Footer.** Iconos de redes.
7. **Dashboard.** `MonthSwitcher` y su uso en Movimientos, Gastos fijos, Ingresos fijos y Presupuestos; `DetailSheet` y los cinco paneles; menú de cuenta con Ayuda y tabs de tema. Cada pieza actualiza su skeleton en el mismo paso (punto 9 del alcance), no al final.
8. **Pulido.** `/impeccable polish` y `/impeccable audit` sobre todo lo tocado, en claro y oscuro, escritorio y 390 px.
9. **Docs y CHANGELOG.**
10. **Verificación.** `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`; Lighthouse de `/` en móvil.

## Criterios de aceptación

**Landing**

- [ ] `grep -r "three" src app package.json` no encuentra imports ni dependencias de Three.js.
- [ ] `hero-scene.tsx`, `hero-scene-loader.tsx` y `hero-visual.tsx` no existen.
- [ ] El hero muestra título, subtítulo, dos CTA y promesas sobre el video con tinte verde; no hay mockup ni visual a la derecha.
- [ ] El video no lleva texto, logo, caras en primer plano ni marcas; cada clip está en `docs/creditos-media.md` con licencia de uso comercial libre.
- [ ] El loop no muestra un corte visible al reiniciar.
- [ ] Los archivos del hero suman ≤ 4 MB y `public/videos/` ≤ 30 MB.
- [ ] Con JavaScript deshabilitado, el hero se ve completo, con el mismo tamaño y el mismo encuadre que con JavaScript.
- [ ] Lighthouse móvil de `/` da CLS ≤ 0,02 y ningún cambio visible de tamaño del hero tras la carga.
- [ ] A 390 × 844, título, subtítulo y CTA principal se ven sin desplazar, con el video móvil vertical.
- [ ] Con `prefers-reduced-motion: reduce` no hay animación de entrada y solo se ve el póster (el video no se reproduce).
- [ ] Todo texto del hero da AA sobre el fotograma más claro del loop, en claro y oscuro.
- [ ] En claro, el fondo de la landing y de las páginas legales es `#FFFFFF`; el dashboard conserva su gris.
- [ ] Las secciones de score y espacios muestran la misma información que antes, sin rejillas de tarjetas iguales ni iconos decorativos, y pasan `/impeccable critique` sin antipatrones marcados.
- [ ] El footer muestra el icono de cada red, con nombre accesible y objetivo de 44 px o más en móvil.

**Dashboard**

- [ ] Movimientos, Gastos fijos, Ingresos fijos y Presupuestos usan el mismo componente de selector de mes, con aspecto de píldora.
- [ ] En Gastos fijos e Ingresos fijos el selector ya no está suelto dentro de la tarjeta de pagos.
- [ ] Los cinco paneles de detalle usan `DetailSheet`, siguen el mismo orden de secciones y abren abajo en móvil y a la derecha en escritorio.
- [ ] En cada panel, la acción principal se ve sin desplazar en escritorio.
- [ ] El pie del aside solo tiene el menú de cuenta; el menú incluye Ayuda (abre GitHub en otra pestaña) y tabs Claro / Oscuro que cambian el tema sin cerrar el menú.
- [ ] Los skeletons de Movimientos, Gastos fijos, Ingresos fijos, Presupuestos, los paneles de detalle y el aside coinciden en forma y tamaño con el contenido nuevo: al terminar la carga no hay salto (comprobado con red lenta en DevTools).
- [ ] Ningún skeleton muestra piezas que ya no existen (flechas sueltas del mes, fila Ayuda + tema del aside).
- [ ] Todo par texto/fondo nuevo da AA en claro y oscuro; controles de 44 px o más en móvil.

**Proyecto**

- [ ] `pnpm-lock.yaml` está sincronizado (`pnpm install --frozen-lockfile` pasa).
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** quitar la escena 3D y Three.js (decisión del usuario). Motivo: el salto en la primera carga se ve mal.
- **Sí:** video de fondo en el hero hecho con Hyperframes, con material de stock libre y tinte verde (decisión del usuario). Reemplaza la decisión anterior de un hero solo tipográfico.
- **Sí:** el video vende la idea, no muestra la app. Motivo: la app ya aparece en el video demo de más abajo.
- **No:** texto dentro del video. Motivo: el texto en HTML es accesible, indexable y se pinta antes que el video.
- **No:** conservar el mockup CSS ni poner una captura estática de la app. Descartado por el usuario.
- **Sí:** hero como componente de servidor con póster en el HTML inicial. Motivo: se pinta completo y no salta.
- **Sí:** fondo `#FFFFFF` en la landing en claro; el gris hueso es solo del dashboard (decisión del usuario).
- **Sí:** subir el tope de `public/videos/` de 25 a 30 MB. Motivo: el tope actual ya está lleno y el hero necesita su propio video.
- **Sí:** un solo componente de selector de mes para todo el dashboard, con el aspecto de Movimientos (decisión del usuario).
- **Sí:** Ayuda y tema dentro del menú de cuenta; el tema como tabs (decisión del usuario).
- **Sí:** iconos de marca de Simple Icons (CC0) como SVG propios. Motivo: `lucide-react` ya no mantiene iconos de marca.
- **Sí:** toda la dirección visual se define con Impeccable antes de codificar (pedido del usuario).

## Riesgos

| Riesgo                                                         | Mitigación                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| El texto no se lee sobre el video                              | Velo oscuro en CSS + gradación con negros profundos; verificar AA sobre el fotograma más claro.             |
| El video pesa y empeora LCP en móvil                           | Variante móvil 720 px, ≤ 4 MB total, `preload="metadata"`, póster como LCP; sin video con Save-Data.        |
| Licencia del material de stock dudosa                          | Solo Pexels, Pixabay o Mixkit; registrar cada clip en `docs/creditos-media.md`; sin personas reconocibles.  |
| El video se ve genérico ("stock de banco")                     | Tomas cotidianas y cercanas (casa, tienda), gradación de marca; aprobación del usuario en el paso 1.        |
| El fondo blanco hace que las tarjetas de la landing se pierdan | Superficie gris suave en el ámbito `site` y revisión de Impeccable en claro.                                |
| Las secciones rediseñadas vuelven a caer en plantilla          | `/impeccable critique` antes de cerrar; criterio de aceptación explícito.                                   |
| Unificar los paneles rompe un flujo existente (pagos, recibos) | `DetailSheet` solo define estructura; el contenido y las actions de cada panel no cambian. Probar cada uno. |
| Tabs dentro del Dropdown cierran el menú o pierden el foco     | Tema fuera de `Dropdown.Menu` (sección propia del Popover) o `shouldCloseOnSelect={false}`; probar teclado. |
| Los skeletons quedan con la forma vieja y el contenido salta   | Actualizar cada skeleton junto con su componente (paso 7) y revisar con red lenta.                          |
| Otro componente importa la escena o Three.js                   | `grep` en el paso 4 y `pnpm build` antes de cerrar.                                                         |
| La fuente Inter carga tarde y cambia el tamaño del título      | Ya se usa `next/font` con `display` adecuado; verificar CLS en Lighthouse.                                  |

## Qué **no** entra en este spec

- Otras secciones de la landing, salvo el fondo blanco.
- Grabar o re-renderizar los clips de la app.
- Metadata y OG.
- Cambios de datos o actions en el dashboard.
- Lo de SPEC 36 a 39.
