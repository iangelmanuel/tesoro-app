# SPEC 56c — Rendimiento: landing, páginas públicas y métricas de campo

> **Estado:** Implementado
> **Depende de:** SPEC 24, SPEC 40, SPEC 56a, SPEC 56b
> **Fecha:** 2026-11-26
> **Objetivo:** Dejar la landing y las páginas públicas en Lighthouse móvil ≥ 90 con videos re-codificados y cargados solo al verse, medir Web Vitals reales con Vercel Speed Insights y cerrar la serie 56 subiendo la versión.

## Por qué existe este spec

Es el último de la serie 56 (ver SPEC 56a). La landing es la primera impresión y la única pantalla que ven los buscadores. Su peso lo ponen los videos: ~29 MB en `public/videos`, justo en el límite de 30 MB que fija SPEC 24.

Estado de partida:

| Archivo                                                       |       Tamaño |
| ------------------------------------------------------------- | -----------: |
| `demo.mp4` / `demo.webm`                                      | 6,4 / 5,7 MB |
| `registros.mp4` / `.webm`                                     | 1,7 / 1,6 MB |
| `hero.mp4` / `hero.webm`                                      | 1,7 / 1,0 MB |
| `score`, `espacios`, `graficas`, `recomendaciones` (cada uno) |   0,9–1,3 MB |
| `hero-mobile.mp4` / `.webm`                                   | 0,8 / 0,5 MB |

Lo que ya está bien y no se toca:

- El póster del hero es el LCP, va en `<picture>` con `fetchPriority="high"` (`hero.tsx`).
- Los clips usan `preload="none"` y un `IntersectionObserver` que da play / pausa (`feature-clip.tsx`), y respetan reduced motion y ahorro de datos.
- La fuente es un solo `woff2` variable latino con `next/font/local` y fuente de respaldo ajustada.
- `motion` ya va con `LazyMotion` (`motion-provider.tsx`).

Hoy no hay métricas de usuarios reales: solo Lighthouse de laboratorio.

## Alcance

**Entra:**

### 1. Línea base

- Parte de la foto "Antes" de 56a: Lighthouse móvil de `/` y JS por ruta.
- Se agregan Lighthouse móvil de `/legal/privacy`, `/legal/terms` y `/mcp`, y los bytes transferidos al cargar `/` y al hacer scroll hasta el final (DevTools, red "Fast 4G", caché vacía).

### 2. Videos re-codificados

- Se re-codifican desde los masters locales (`video/renders/` y `video/hero/renders/`), con FFmpeg, sin re-renderizar con Hyperframes. Mismos fotogramas, mismas duraciones.
- **Clips de funciones** (`registros`, `score`, `espacios`, `graficas`, `recomendaciones`): se muestran en una tarjeta que no pasa de ~800 px de ancho. Se bajan de 1920 × 1080 a 1280 × 720, con el atributo `width` / `height` del `<video>` actualizado.
- **Demo:** se mantiene 1920 × 1080 (se ve a pantalla grande al dar play) y se sube el CRF hasta que no haya diferencia visible a tamaño real.
- **Hero:** se sube el CRF de escritorio y de móvil hasta que los cuatro videos y sus pósters quepan en 3 MB. Ajustar solo el escritorio no alcanza: sin tocar el móvil, el total queda en ~3,4 MB.
- **Agentes** (`agentes.*`): ya pesa < 300 kB; no se toca.
- Los pósters WebP se regeneran solo para los videos que cambian de resolución.
- Los CRF finales se anotan en `CLAUDE.md` (sección de videos) y en `docs/rendimiento.md`.

### 3. Carga de los videos

- **Clips:** las `<source>` se montan solo cuando la tarjeta está a menos de un viewport de distancia (`IntersectionObserver` con `rootMargin`), no al hidratar. Hasta entonces se ve el póster. Así ningún clip descarga nada si el usuario no llega a él.
- **Demo:** sigue sin autoplay y con `preload="none"`. No cambia.
- **Hero:** sigue con `preload="metadata"`, y el video no empieza a bajar antes de que el póster haya pintado. En la línea base sí empezaba antes (70–170 ms antes del LCP), porque el servidor pintaba el `<video>` con `autoPlay` y sus `<source>`. Por eso `hero-video.tsx` monta las `<source>` y llama a `play()` tras el evento `load` y en idle. Sin JS solo se ve el póster.

### 4. Cache-Control de los estáticos públicos

- En `next.config.ts` (`headers()`), `/videos/:path*` responde `Cache-Control: public, max-age=604800, stale-while-revalidate=86400`.
- Los nombres de archivo no llevan hash, por eso no se marca `immutable`. Al re-codificar se mantiene el nombre.

### 5. Páginas públicas

- Con el analyzer de 56b sobre `/`, `/legal/*` y `/mcp`: se difiere el JS que no se necesita en el primer pintado (secciones bajo el pliegue con lógica cliente).
- Se verifica que `/legal/*` y `/mcp` sean estáticas (sin datos dinámicos fuera de `Suspense`) y que `getGithubStars` (`src/libs/github.ts`, `"use cache"` + `cacheLife("hours")`) no bloquee el shell.
- Imágenes de las públicas con `next/image` o `getImageProps`, `sizes` correcto y sin `priority` / `fetchPriority="high"` fuera del LCP.

### 6. Vercel Speed Insights

- Dependencia `@vercel/speed-insights` (versión exacta) y `<SpeedInsights />` de `@vercel/speed-insights/next` en `app/layout.tsx`.
- **Rutas con ids:** `beforeSend` reemplaza el id de `/dashboard/business/[id]` por `[id]` en la URL antes de enviarla. No se envía ningún query string (`?next=…`, filtros de Movimientos).
- **Privacidad:** el documento de privacidad (`src/content/legal/privacy.tsx`, registrado en `src/features/legal/documents.ts`) agrega Vercel Speed Insights: qué mide (Web Vitals y ruta), que no usa cookies ni identifica al usuario y que no envía datos financieros. Se actualiza su `updatedAt` en `SITE.legal`.
- Las métricas de campo se revisan en el panel de Vercel; el resumen de los primeros 7 días con datos queda en `docs/rendimiento.md`.

### 7. Cierre de la serie

- `docs/rendimiento.md`: tablas "Antes" y "Después" de este spec y un resumen de la serie (56a, 56b, 56c) con la diferencia total por métrica.
- Versión **0.4.0** en `package.json`, `SITE.info.version`, `CHANGELOG.md` (las entradas de `[Unreleased]` de la serie pasan a `[0.4.0]`) y la tabla de `SECURITY.md`.
- `SITE.landing.demo.durationSeconds` se revisa: no cambia, porque la duración del demo no cambia.

**Fuera de alcance:**

- Base de datos, sesión y servidor del dashboard (56a).
- Bundle y render del dashboard (56b).
- Mover los videos a Vercel Blob u otro CDN.
- Re-renderizar videos o cambiar su contenido.
- Cambiar textos, diseño o secciones de la landing.
- Caché entre requests de datos de usuario.
- Otras herramientas de analítica (Web Analytics, eventos, embudos).

## Modelo de datos

No hay datos de la app nuevos. Cambian configuración y dependencias:

```ts
// next.config.ts
async headers() {
  return [
    {
      source: "/videos/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=604800, stale-while-revalidate=86400"
        }
      ]
    }
  ]
}

// app/layout.tsx
<SpeedInsights beforeSend={normalizeVitalsUrl} />
```

`normalizeVitalsUrl` es una función pura (con test) que quita el query string y cambia el segmento de id de `/dashboard/business/<uuid>` por `[id]`.

## Plan de implementación

1. **Línea base pública.** Lighthouse de `/`, `/legal/*` y `/mcp` y bytes transferidos de `/`, sobre `master` con 56a y 56b fusionados. Anotar en `docs/rendimiento.md`.
2. **Re-codificar clips.** Los cinco clips a 1280 × 720 desde los masters, con pósters nuevos. Actualizar `width` / `height` en `feature-clip.tsx` y el `SITE` que los referencie. Comparar a tamaño real contra los actuales.
3. **Re-codificar demo y hero.** CRF del demo y, si hace falta, del hero. Anotar los CRF en `CLAUDE.md`.
4. **Fuentes de video al acercarse.** `feature-clip.tsx` monta las `<source>` con `rootMargin`. Verificar en la pestaña Red que sin scroll no baja ningún clip.
5. **Cache-Control.** `headers()` en `next.config.ts`. Verificar la cabecera en el Preview de Vercel.
6. **JS y estáticas de las públicas.** Analyzer sobre `/`, `/legal/*` y `/mcp`; diferir lo que sobre; revisar imágenes y que las rutas sean estáticas en la salida de `next build`.
7. **Speed Insights.** Dependencia, `normalizeVitalsUrl` con su test y `<SpeedInsights />` en el layout raíz. Activar Speed Insights en el proyecto de Vercel (lo hace el usuario en el panel).
8. **Privacidad.** Actualizar el documento de privacidad y su fecha.
9. **Medición "Después".** Repetir §1 en un Preview y llenar las tablas.
10. **Cierre de la serie.** Resumen de la serie en `docs/rendimiento.md`, versión 0.4.0 en los cuatro lugares y `CHANGELOG.md`.
11. **Métricas de campo.** Tras 7 días con datos en producción, anotar el resumen de Speed Insights en `docs/rendimiento.md` (puede ir en un PR de documentación aparte).

## Criterios de aceptación

- [x] `public/videos` pesa ≤ 20 MB en total.
- [x] `hero.mp4` + `hero.webm` + `hero-mobile.mp4` + `hero-mobile.webm` + sus pósters pesan ≤ 3 MB en total.
- [x] Los cinco clips de funciones son 1280 × 720 y su `<video>` declara esas medidas.
- [x] Ningún video cambia de duración ni de contenido.
- [x] Cargar `/` sin hacer scroll no descarga ningún clip de funciones ni el demo (pestaña Red).
- [x] Cargar `/` sin hacer scroll transfiere menos bytes que en la línea base.
- [x] `/videos/*` responde con `Cache-Control: public, max-age=604800, stale-while-revalidate=86400` en el Preview.
- [ ] Lighthouse móvil de `/`, `/legal/*` y `/mcp`: Performance ≥ 90, LCP ≤ 2,5 s, CLS ≤ 0,1 y TBT ≤ 200 ms. **Se cumple en `/legal/*`; en `/mcp` falta el TBT y `/` no llega. Queda en "Pendiente" de `docs/rendimiento.md`.**
- [x] `/legal/*` y `/mcp` tienen el shell estático en `next build` (◐): lo único dinámico es la isla de sesión del header, dentro de `Suspense`.
- [x] `<SpeedInsights />` está en `app/layout.tsx` y `@vercel/speed-insights` tiene versión exacta.
- [x] `normalizeVitalsUrl` tiene test: quita el query string y cambia el uuid de `/dashboard/business/<uuid>` por `[id]`.
- [x] El documento de privacidad menciona Speed Insights y tiene la fecha actualizada.
- [x] `package.json`, `SITE.info.version`, `CHANGELOG.md` y `SECURITY.md` dicen 0.4.0.
- [x] `docs/rendimiento.md` tiene las tablas de este spec y el resumen de la serie.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm test` y `pnpm build` pasan.

Notas de la verificación (detalle en `docs/rendimiento.md`):

- Videos: `public/videos` pasa de 28,8 MB a 19,8 MB y el hero con sus pósters, de 4,1 MB a 2,99 MB. Mismos fotogramas y duración que los masters (ffprobe). La calidad se comparó con SSIM y recortes 1:1. El demo baja sobre todo en VP9: en H.264 los separadores finos de la UI se pierden desde CRF 33.
- Carga: verificada con Playwright en un build local y en el Preview. Sin scroll no se pide ningún clip ni el demo, y el video del hero empieza ~0,5 s después del LCP (en la línea base, 70–170 ms antes). Bytes de `/` sin scroll: 873 kB (antes 1.018) en móvil y 1.348 kB (antes 1.560) en escritorio.
- Lighthouse (Preview, mediana de 3, y de 5 en `/` y `/mcp`): `/legal/*` 95, LCP 2,4 s, TBT 159–174 ms. `/mcp` 91, LCP 2,5 s, TBT 313 ms. `/` 72, LCP 3,7 s, TBT 753 ms (de 332 a 1.381 ms entre corridas). En `/` el LCP es el `<h1>` del hero y lo frenan el CSS global que bloquea el render (174 kB con el del dashboard) y el costo de estilos de Tailwind 4, no el JS de la landing, que bajó de 991 a 702 kB.
- Rutas: las públicas salen ◐. El criterio se ajustó durante la implementación: lo único dinámico es la isla de sesión del header, y `getRepoStars` queda dentro del shell.
- Se corrigió un bug que ya existía: en escritorio el hero pintaba el póster vertical del móvil.
- Speed Insights: lo activa el dueño del proyecto en Vercel. El paso 11 (resumen de 7 días de métricas de campo) va en un PR de documentación aparte.

## Decisiones

- **Sí:** re-codificar desde los masters con FFmpeg. Mismos fotogramas, sin Docker ni el stack demo.
- **No:** re-renderizar con Hyperframes. Más lento y no cambia el resultado.
- **Sí:** clips a 1280 × 720. La tarjeta no pasa de ~800 px; 1080p era peso que nadie veía.
- **No:** bajar la resolución del demo. Se ve a pantalla grande al dar play.
- **Sí:** montar las `<source>` al acercarse. `preload="none"` ya evita la descarga, pero algunos navegadores igual piden los metadatos.
- **No:** mover los videos a Vercel Blob o un CDN aparte. Otra URL e infraestructura que mantener por una ganancia que ya da el CDN de Vercel.
- **Sí:** `max-age` de una semana sin `immutable`. Los nombres no llevan hash; un video re-codificado con el mismo nombre se actualiza en días, no en un año.
- **Sí:** Vercel Speed Insights. Da Web Vitals de usuarios reales, que Lighthouse no mide.
- **Sí:** `beforeSend` que quita ids y query strings. Las URLs del dashboard no deben salir con ids de espacios ni filtros.
- **Sí:** actualizar el documento de privacidad. Es un script de un tercero nuevo; el usuario debe saberlo.
- **No:** Vercel Web Analytics u otra analítica. Mide comportamiento, no rendimiento; si llega, va en su propio spec.
- **Sí:** metas numéricas duras. Mismas que 56b.
- **Sí:** subir a 0.4.0 al cerrar la serie. Cambio interno grande (RLS, compilador, carga diferida) sin romper nada: minor.

## Riesgos

| Riesgo                                                       | Mitigación                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| La re-codificación deja artefactos visibles                  | Comparar a tamaño real contra el actual antes de reemplazar. Si se nota, bajar el CRF.                            |
| Los masters locales no están o no coinciden con lo publicado | Verificar duración y fotogramas contra los archivos de `public/videos`. Si falta un master, ese video no se toca. |
| Un video viejo queda en caché del navegador una semana       | Es aceptable: mismo contenido, solo más pesado.                                                                   |
| Speed Insights envía una URL con datos del usuario           | `beforeSend` con test. Revisar en el panel de Vercel las primeras rutas recibidas.                                |
| Speed Insights baja el puntaje de Lighthouse                 | El script es pequeño y se carga diferido. Se mide en el "Después".                                                |

## Lo que **no** entra en este spec

- Servidor, base de datos y sesión (SPEC 56a).
- Bundle y render del dashboard (SPEC 56b).
- CDN aparte para los videos.
- Cambios de contenido o diseño de la landing.
- Analítica de comportamiento.

Cada uno, si llega, va en su propio spec.
