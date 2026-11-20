# SPEC 50 — Logo nuevo: monograma T

> **Estado:** Aprobado
> **Depende de:** SPEC 12, SPEC 32, SPEC 33
> **Fecha:** 2026-11-19
> **Objetivo:** Reemplazar el cofre actual por un monograma T geométrico, sobrio y profesional, y regenerar con él todos los assets de marca.

## Por qué existe este spec

Es el primero de cuatro specs que rehacen la UI de Tesoro:

- **SPEC 50** (este): logo y assets de marca.
- **SPEC 51**: base shadcn, paleta y tipografía nuevas, shell del dashboard, menús rápidos y patrón de skeletons.
- **SPEC 52**: migrar las pantallas de Personal.
- **SPEC 53**: migrar Empresa, cuenta, auth y páginas públicas, y quitar HeroUI.

El cofre de hoy (SPEC 12) es ilustrativo: tapa, cuerpo, cerradura y un punto. A 16 px pierde detalle y se lee como un ícono de stock. La marca nueva necesita una forma propia, que funcione a un color y que escale de un favicon a la imagen OG.

El logo va primero porque el shell de SPEC 51 ya lo usa.

Cuándo se crean SPEC 52 y 53, y el texto exacto para pedirlos con `/spec`, está en SPEC 51, sección "Siguientes specs: cuándo y qué pedir".

## Alcance

**Entra:**

- **Tres propuestas** de monograma T, dibujadas a mano en SVG sobre una retícula de 64 × 64. No se usan generadores de imagen.
  - Cada una con una idea de construcción en una línea. Direcciones a explorar (no obligatorias):
    - la contraforma entre asta y travesaño forma una cerradura;
    - el asta se arma con barras ascendentes, como una gráfica;
    - el travesaño es un arco, como la tapa de un cofre.
  - Hoja comparativa (página local, no se commitea) con cada propuesta a 16, 32, 64 y 512 px, en claro y oscuro, a un color y sobre el color de marca, junto al wordmark.
  - El usuario elige una. Se refina con él antes de generar assets.
- **Reglas de dibujo** que debe cumplir la elegida:
  - legible a 16 px: ningún trazo ni contraforma menor a 1 px a ese tamaño;
  - funciona a un solo color (sin degradados, brillos, sombras ni 3D);
  - formas cerradas y pocas (≤ 4 paths en `mark.svg`);
  - centrado óptico, no solo geométrico.
- **Wordmark** "Tesoro" dibujado como paths propios (letra ajustada a mano sobre una base de palo seco, con espaciado corregido). No depende de la fuente de la UI.
- **Versiones del isotipo:**
  - **tinta** (principal): un color, `currentColor` en el componente; en los SVG fuente, el foreground del tema claro;
  - **color**: el mismo monograma, sin fondo ni cuadro, en el color de marca (`BRAND_HEX`), para favicon, íconos de app, apple-touch, el logo y la imagen OG. En los íconos que exigen fondo completo (apple-touch, 192, 512 y maskable) va sobre blanco.
- **Archivos fuente** en `assets/brand/`:
  - `mark.svg` (tinta), `mark-color.svg` (en color de marca, nuevo), `logo.svg` (isotipo + wordmark), `opengraph.svg` (1200 × 630).
- **Regeneración** con `pnpm brand:assets` (`scripts/generate-brand-assets.mjs`):
  - `app/icon.svg`, `app/favicon.ico` (16, 32, 48);
  - `public/apple-touch-icon.png`, `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`;
  - `public/brand/logo.png`, `public/opengraph-image.png`;
  - `src/features/exports/workbook/logo-data.ts` (Excel) y `src/features/exports/pdf/brand-data.ts` (PDF).
  - Los íconos de app salen de `mark-color.svg` sobre fondo blanco; el maskable respeta la zona segura del 80 %.
  - El color de marca de los PNG sale de una sola constante `BRAND_HEX` en el script (reemplaza a `MASKABLE_BACKGROUND`, que pasa a ser blanco). SPEC 51 la actualiza si re-afina `--brand`.
- **Componente** `src/components/brand/logo.tsx`:
  - `LogoMark` con el monograma nuevo en `currentColor` y prop `tone: "ink" | "color"` (por defecto `ink`);
  - `variant="full"` muestra isotipo + wordmark en paths, no texto en Inter;
  - se mantienen `variant` y `size` actuales para no tocar a los consumidores.
- **Consumidores** revisados sin cambiar su layout: header y footer públicos, aside, auth, `/account-deleted`, consentimiento OAuth (`app/oauth/consent/`), página `/mcp`.
- **Documentación:** `PRODUCT.md` (Brand Commitments: isotipo nuevo), `docs/ui.md` (uso del logo, versiones tinta y color, área de respeto mínima) y `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Re-renderizar los videos de la landing y sus pósters (`public/videos/`). Siguen con el logo viejo hasta un spec propio.
- Re-afinar el tono de `--brand`: lo hace SPEC 51 con la paleta nueva.
- Cambiar la tipografía de la UI (SPEC 51).
- Rediseñar la landing o el header público (SPEC 53).
- Guía de marca completa (usos incorrectos, co-branding, papelería).

## Modelo de datos

Este spec no agrega datos, tablas ni migraciones.

Cambia el contrato del componente de marca:

```ts
// src/components/brand/logo.tsx
type LogoProps = {
  variant?: "full" | "mark"
  size?: "default" | "lg"
  tone?: "ink" | "color" // nuevo; "ink" usa currentColor
  className?: string
}
```

```js
// scripts/generate-brand-assets.mjs
const BRAND_HEX = "#059669" // único color de marca de los PNG; SPEC 51 lo puede re-afinar
```

## Plan de implementación

1. Dibujar las tres propuestas en SVG y armar la hoja comparativa local. El usuario elige una.
2. Refinar la elegida (retícula, centrado óptico, prueba a 16 px) y dibujar el wordmark en paths.
3. Escribir `mark.svg`, `mark-color.svg`, `logo.svg` y `opengraph.svg` en `assets/brand/`.
4. Ajustar `generate-brand-assets.mjs`: `BRAND_HEX`, íconos de app desde `mark-color.svg`. Correr `pnpm brand:assets` y commitear la salida.
5. Actualizar `logo.tsx` (monograma, `tone`, wordmark en paths) y revisar cada consumidor en claro y oscuro.
6. Revisar un Excel y un PDF exportados con el logo nuevo.
7. Actualizar `PRODUCT.md`, `docs/ui.md` y `CHANGELOG.md`.

## Criterios de aceptación

- [ ] Hubo tres propuestas y el usuario eligió una antes de generar assets.
- [ ] `assets/brand/mark.svg` tiene 4 paths o menos y ningún degradado, filtro ni sombra.
- [ ] A 16 px (favicon en la pestaña) el monograma se reconoce como una T, sin trazos borrosos.
- [ ] `pnpm brand:assets` corre sin errores y regenera los 10 archivos listados en Alcance.
- [ ] El ícono maskable queda completo dentro del círculo central del 80 %.
- [ ] `LogoMark` con `tone="ink"` toma el color del texto que lo rodea en claro y en oscuro.
- [ ] El wordmark del componente se ve igual con o sin la fuente de la UI cargada (son paths).
- [ ] El logo nuevo aparece en header y footer públicos, aside, auth, `/account-deleted`, consentimiento OAuth y `/mcp`.
- [ ] El Excel y el PDF exportados muestran el logo nuevo, nítido al 200 % de zoom.
- [ ] El isotipo a color y el de tinta dan ≥ 3:1 contra su fondo en claro y oscuro.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** monograma T. Escala a 16 px, no depende de una ilustración y es propio de la marca.
- **No:** cofre reinterpretado. Aun en trazo mínimo sigue siendo un ícono genérico.
- **No:** solo wordmark. No resuelve favicon ni íconos de app.
- **No:** símbolo abstracto sin letra. Más riesgo de verse genérico.
- **Sí:** tres propuestas y elección del usuario. El logo es una decisión de marca, no técnica.
- **Sí:** SVG dibujado a mano, sin generadores de imagen. Control de cada nodo y nada de "AI slop".
- **Sí:** tinta como versión principal y una versión a color para íconos de app. La UI nueva usa la marca con sobriedad; el color queda donde el sistema lo pide.
- **Sí:** wordmark en paths. Si SPEC 51 cambia la fuente, el logo no cambia.
- **Sí:** el logo va antes que la base shadcn. El shell nuevo ya nace con él.
- **Sí:** versión a color sin cuadro: la T sola en `BRAND_HEX` (emerald-600, ≥ 3:1 sobre blanco y sobre oscuro), y blanco detrás solo donde el sistema exige fondo. El usuario descartó el cuadro verde al revisar el Paso 3; `#10b981` con blanco daba ~2,5:1.
- **No:** re-renderizar videos aquí. Requieren Docker, FFmpeg y la UI nueva; van en un spec propio.

## Riesgos

| Riesgo                                                         | Mitigación                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Navegadores y SO guardan el favicon viejo en caché             | Se cambia el contenido de `app/icon.svg` y `favicon.ico`; Next les pone hash. Se acepta.    |
| La landing muestra el logo nuevo y los videos el viejo         | Se acepta de forma temporal; queda anotado en Fuera de alcance.                             |
| `--brand` cambia en SPEC 51 y los PNG quedan con el tono viejo | Una sola constante `BRAND_HEX`; SPEC 51 la actualiza y vuelve a correr `pnpm brand:assets`. |
| La T se confunde con una cruz o un ícono de herramienta        | La hoja comparativa incluye el wordmark al lado y tamaños reales antes de elegir.           |

## Qué no entra en este spec

- Re-render de los videos y pósters de la landing.
- Tono final de `--brand` y paleta nueva (SPEC 51).
- Tipografía de la UI (SPEC 51).
- Rediseño de la landing y el header público (SPEC 53).
- Guía de marca completa.

Cada uno de esos, si llega, va en su propio spec.
