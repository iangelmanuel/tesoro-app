# SPEC 19 — Landing renovada: demo en video con Hyperframes, escena Three.js y Motion

> **Estado:** Aprobado
> **Depende de:** SPEC 07, SPEC 12, SPEC 14, SPEC 18
> **Fecha:** 2026-11-01
> **Objetivo:** Que la landing se vea profesional y sin patrones genéricos de IA, con un video demo estilo producto (cursor sobre la app real, en modo claro) hecho con Hyperframes, una escena Three.js en el hero y animaciones con Motion, todo pulido con Impeccable.

## Por qué existe este spec

SPEC 12 entregó una landing completa pero con mockups JSX interinos (`hero-visual.tsx`, `score-visual.tsx`) y dejó los videos como "spec futuro (HyperFrame)". Hoy la landing:

1. **Se siente genérica.** Íconos en cuadros, tarjetas iguales en grilla y visuales de relleno: el aspecto típico de una página generada con IA.
2. **No muestra el producto real.** Un mockup con datos fijos no vende lo que Tesoro hace.
3. **No tiene movimiento ni profundidad.** Todo es estático.

El usuario pidió un video al estilo de la presentación de ChatGPT Atlas de OpenAI: un cursor que interactúa con la interfaz real, con animaciones y zooms. La UI del video debe ser **idéntica a la app** y mostrarse en **modo claro** (más comercial). El video no enseña a registrar un movimiento (eso es básico): vende el **estilo de vida** de tener las finanzas en orden, para que quien lo vea quiera manejar su dinero así.

Es un spec grande (diseño, video, 3D, motion). Se ordena en etapas que se pueden commitear por separado; si durante la implementación pesa demasiado, las etapas 2–5 (video) pueden pasar a un 19b sin afectar a las demás.

## Alcance

**Entra:**

- **Dependencias y skills** (versiones exactas, sin `^`):
  - skill de Hyperframes: `npx skills add heygen-com/hyperframes`, verificando que quede en `.claude/skills/` (si queda en `.agents/skills/`, se mueve o se enlaza). Las skills de Hyperframes quedan instaladas solo en local, git-ignoradas. CLI `hyperframes` por `npx`; requiere FFmpeg en la máquina;
  - `motion` (import desde `motion/react`);
  - `three` y `@react-three/fiber` (sin `drei`, salvo que algo concreto lo exija);
  - `@types/three` y `playwright` como `devDependencies`.
- **Datos demo y grabación de la app real** (solo desarrollo, nada de esto llega al bundle). Los scripts viven **solo en local** y están git-ignorados; no se suben al repositorio:
  - `scripts/seed-demo.mjs`: crea contra **Supabase local** (`supabase start`) un usuario demo con Personal completo (movimientos de varios meses, presupuestos, metas, deudas y tarjeta, cuentas) y una empresa con flujo de caja. Usa `service_role` solo desde variable de entorno local y **se niega a correr** si la URL no es `localhost` / `127.0.0.1`;
  - `scripts/record-demo.mjs`: Playwright con viewport 1920×1080, tema **claro** (`localStorage.theme = "light"`), inicia sesión con el usuario demo y ejecuta tomas guionizadas (scroll, hover, clics). Cada toma produce un `.webm` y un `.json` con la trayectoria del cursor y los clics por tiempo, porque el cursor del sistema no sale en la grabación;
  - `scripts/prepare-demo-video.mjs`: convierte las tomas para Hyperframes (`video/assets/takes/`) y genera `video/assets/cursor-data.js`, que usan las composiciones;
  - los `.webm` crudos van en `video/raw/` (git-ignorado).
- **Composiciones Hyperframes** en `video/` (estructura final según `npx hyperframes init`; todo `video/` vive solo en local y está git-ignorado, al repo solo llega el resultado en `public/videos/`): toman los `.webm` como fuente y dibujan encima cursor, clics, zooms, resaltados y texto en pantalla en español. Se renderizan a `public/videos/`.
  - **Estilo escritorio macOS**: toda la composición se ve como una Mac, no como una página web suelta. La app real grabada va dentro de una ventana de macOS (esquinas redondeadas, sombra, botones de semáforo rojo/amarillo/verde y barra de título con la URL de Tesoro) sobre un escritorio con fondo propio, barra de menú superior (reloj, íconos de estado, nombre de la app) y Dock con íconos genéricos. El cursor es la flecha estilo macOS, con animación de clic. La ventana se abre, se mueve y se maximiza con animaciones (zoom, escala) al estilo del sistema.
    - Sin logo de Apple, sin íconos de apps de Apple ni fondos de pantalla de Apple (marca y derechos): fondo de escritorio original en degradado de la marca, íconos de Dock genéricos y propios.
    - Sin SF Pro (licencia): la barra de menú y el Dock usan Inter; la app grabada ya usa Inter.
    - El escritorio, la barra, el Dock y el marco son parte de las composiciones Hyperframes (`video/`), no de la grabación; la grabación solo contiene la app real.
  - **Video principal** (~45–60 s, sin audio), con este guion:
    1. Resumen: "Tu mes, de un vistazo".
    2. Presupuestos: cada peso con destino.
    3. Metas: el avance hacia lo que quieres.
    4. Deudas y tarjetas: saber cuánto debes y cuándo.
    5. Score y recomendaciones: tu salud financiera en un número y qué hacer después.
    6. Empresa: cambio de espacio desde el aside, flujo de caja del negocio.
    7. Cierre: isotipo, slogan de `SITE.info.slogan` y CTA.
  - **5 clips cortos** (5–8 s) para las funciones de `SITE.features` que tienen UI: Registros como punto de partida, Gráficas claras, Recomendaciones, Score financiero, Personal y Empresa. "Código abierto" queda sin clip: no tiene pantalla que grabar.
  - Tono de los textos: tuteo, frases cortas, tranquilo con las cifras, sin jerga ni alarmismo (ver `PRODUCT.md`). Sin mencionar IA generativa ni inventar métricas, clientes o testimonios. Una nota "Datos de ejemplo" visible en el video.
  - Cada video exporta MP4 (H.264) y WebM, más un póster WebP, en 1920×1080 optimizado para web (codificación en dos pasadas, `faststart`). Presupuesto: principal ≤ 8 MB por formato, cada clip ≤ 1.5 MB por formato, total en `public/videos/` ≤ 25 MB.
- **Sección de demo** (`#demo`) justo después del hero:
  - el video principal (que ya trae el escritorio macOS dentro) en un contenedor con esquinas redondeadas y sombra sutil, sin marco extra, siempre en claro aunque la página esté en oscuro;
  - póster hasta que el usuario pulsa play; controles de reproducir/pausar y silencio no aplica (sin audio); `preload="none"`, `playsInline`, dimensiones reservadas para evitar CLS;
  - texto alternativo accesible (descripción del recorrido) y `prefers-reduced-motion` desactiva cualquier autoplay;
  - JSON-LD `VideoObject` del video principal con un builder nuevo en `src/libs/seo.ts`.
- **Clips por función** en la grilla de `features.tsx`: reproducción en loop, silenciada y solo mientras la tarjeta está en pantalla (`IntersectionObserver`); en pausa con póster si `prefers-reduced-motion` o `saveData`.
- **Escena Three.js en el hero**:
  - escena 3D abstracta de marca (cofre/monedas del isotipo o barras de ingresos y gastos) con `@react-three/fiber`, colores desde los tokens `--brand`, `--income`, `--expense`;
  - carga diferida: `dynamic` con `ssr: false` en un componente cliente, tras `requestIdleCallback`, y solo cuando el hero está visible;
  - se activa únicamente en `>= 768 px`, sin `prefers-reduced-motion` y sin `saveData`; en el resto se queda `hero-visual.tsx` como fallback estático;
  - respuesta suave al puntero (parallax) y pausa del render loop fuera de pantalla (`frameloop="demand"` o `invalidate`);
  - `dpr` limitado (máx. 2) y sin sombras costosas.
- **Motion en toda la landing** (`motion/react`, con `LazyMotion` + `domAnimation` y componentes `m` para recortar bundle; `MotionConfig reducedMotion="user"`):
  - revelado de títulos y tarjetas al entrar en pantalla, una sola vez (`whileInView`, `viewport.once`);
  - hero: entrada escalonada de título, subtítulo y CTAs; header que gana fondo/borde al hacer scroll; hover y press de CTAs;
  - Score y Funciones: barras y medidor del score ligados al scroll (`useScroll`/`useTransform`);
  - transición póster → video en la demo y en los clips.
  - Un componente `Reveal` compartido en `src/features/landing/components/reveal.tsx`; nadie duplica la configuración de animación.
- **Pasada con Impeccable sobre toda la landing** (hero, demo, funciones, cómo funciona, score, espacios, código abierto, CTA, header, footer):
  - `critique` primero, `polish` y `audit` al final, usando `PRODUCT.md` y `docs/ui.md` como contexto;
  - eliminar patrones genéricos de IA: íconos en cuadros de color, tarjetas idénticas en grilla de 3, gradientes de relleno, titulares en fórmula y texto de relleno;
  - rediseñar `score-visual.tsx` (se queda como mockup, mejorado con Motion);
  - registrar el resultado en `DESIGN.md` con el flujo de Impeccable (el documenter);
  - detalle fino: espaciado, jerarquía tipográfica, estados hover/focus, contraste AA en claro y oscuro.
- **Config en `SITE`** para la demo y los clips (ver "Modelo de datos"); los componentes no arman rutas de video a mano.
- **Documentación:** `docs/ui.md` (sección Landing y animación), `docs/producto.md` (Landing), `CLAUDE.md` (comandos y pipeline de video), `PRODUCT.md` ("Evidence on Hand"), nota en SPEC 12 de que los videos pasaron a SPEC 19, `.env.example` y `CHANGELOG.md` en `[Unreleased]` (en inglés).
- Lighthouse móvil ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en `/`.

**Fuera de alcance (para otros specs):**

- Audio, música o locución en los videos.
- Subtítulos `.vtt` (el texto va incrustado en pantalla).
- Video para "Código abierto" y videos de las páginas legales.
- Capas de IA o cualquier promesa de IA generativa en textos.
- Cambios en la app (dashboard, auth, esquema); solo se agregan scripts de desarrollo.
- Escenas 3D fuera del hero (Score, fondo global).
- Multidioma, blog, precios, testimonios, analítica.
- Automatizar el re-render de videos en el CI (los videos van commiteados).
- Mejorar la landing en móvil más allá de no romperla y cumplir Lighthouse.

## Modelo de datos

Sin tablas ni migraciones. El seed demo escribe en una base **local** con el esquema existente.

Nuevo bloque en `src/config/site.ts` (`as const`):

```ts
landing: {
  demo: {
    title: "Tesoro en acción",
    description: "Un recorrido por el resumen, los presupuestos, las metas, las deudas, el score y el espacio Empresa.",
    uploadDate: "2026-11-01",
    durationSeconds: 52,
    sources: {
      mp4: "/videos/demo.mp4",
      webm: "/videos/demo.webm",
      poster: "/videos/demo-poster.webp"
    }
  },
  clips: [
    { feature: "Registros como punto de partida", slug: "registros", sources: { mp4, webm, poster } },
    { feature: "Gráficas claras", slug: "graficas", sources: { /* ... */ } },
    { feature: "Recomendaciones", slug: "recomendaciones", sources: { /* ... */ } },
    { feature: "Score financiero", slug: "score", sources: { /* ... */ } },
    { feature: "Personal y Empresa", slug: "espacios", sources: { /* ... */ } }
  ]
}
```

- `clips[].feature` debe coincidir con un `title` de `SITE.features`; un clip se asocia a su tarjeta por ese título.
- `durationSeconds` es el real del render; se actualiza a mano al re-renderizar.

Archivos nuevos (nombres finales de `video/` según `hyperframes init`):

```text
scripts/seed-demo.mjs                 # local, git-ignorado
scripts/record-demo.mjs               # local, git-ignorado
scripts/prepare-demo-video.mjs        # local, git-ignorado
scripts/demo/                         # local, git-ignorado: tomas guionizadas (un archivo por toma)
video/                                # local, git-ignorado: composiciones Hyperframes (fuente)
video/raw/                            # .webm y .json crudos
public/videos/                        # demo, 5 clips y pósters (commiteados)
src/features/landing/components/
  demo-section.tsx
  demo-player.tsx                     # cliente: play/pausa, póster, reduced-motion
  feature-clip.tsx                    # cliente: loop al entrar en pantalla
  hero-scene.tsx                      # cliente: escena R3F
  hero-scene-loader.tsx               # cliente: dynamic + condiciones de activación
  reveal.tsx                          # cliente: Reveal con Motion
  motion-provider.tsx                 # cliente: LazyMotion + MotionConfig
src/components/seo/                   # sin cambios; el builder va en src/libs/seo.ts
```

Variables de entorno de desarrollo (solo en `.env.local`, placeholders en `.env.example`): `DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` (solo local).

## Plan de implementación

1. **Dependencias, skills y entorno de video.**
   - Instalar la skill de Hyperframes y verificar su ubicación; agregar `motion`, `three`, `@react-three/fiber`, `@types/three` y `playwright` con versión exacta.
   - Agregar `video/raw/` al `.gitignore`; placeholders en `.env.example`.
   - Queda funcional: `pnpm check` y `pnpm build` pasan, sin cambios visibles.
2. **Seed demo.**
   - `scripts/seed-demo.mjs` con la guarda de URL local. Verificar con `supabase start`: iniciar sesión con el usuario demo en `localhost:3000` y ver Personal y Empresa con datos completos.
3. **Grabación de la app real.**
   - `scripts/record-demo.mjs` y las tomas en `scripts/demo/`, tema claro, 1920×1080. Producir los `.webm` y `.json` de cursor en `video/raw/`.
4. **Video principal con Hyperframes.**
   - Composición con cursor, clics, zooms, textos y cierre; render a MP4 + WebM + póster en `public/videos/`. Revisar el resultado a mano y confirmar el presupuesto de peso.
5. **Clips por función.**
   - Las 5 composiciones cortas con el mismo estilo; render a `public/videos/`.
6. **Sección de demo y clips en la página.**
   - `SITE.landing`, `demo-player.tsx`, `demo-section.tsx` tras el hero, `feature-clip.tsx` dentro de `features.tsx`, y `buildVideoSchema` en `src/libs/seo.ts` inyectado en la landing. Anclas del header: agregar "Demo" a `SITE.navigation.main`.
7. **Capa de Motion.**
   - `motion-provider.tsx`, `reveal.tsx` y su uso en las secciones; hero escalonado, header con scroll y animaciones ligadas al scroll en Score y Funciones. Verificar con `prefers-reduced-motion` activado.
8. **Escena Three.js del hero.**
   - `hero-scene.tsx` y `hero-scene-loader.tsx` con las condiciones de activación; `hero-visual.tsx` queda como fallback. Verificar que en `< 768 px` no se descarga el chunk de three.
9. **Pasada Impeccable.**
   - `critique` de la landing, aplicar los cambios, rediseñar `score-visual.tsx`, `polish` y `audit`. Actualizar `DESIGN.md`.
10. **Docs y limpieza.**
    - `docs/ui.md`, `docs/producto.md`, `CLAUDE.md`, `PRODUCT.md`, nota en SPEC 12, `.env.example` y `CHANGELOG.md`.
11. **Medición.**
    - `pnpm build && pnpm start`, Lighthouse móvil en `/`, y revisión del peso transferido de la carga inicial; corregir lo que baje de 90.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `package.json` no tiene `^` ni `~`, y `pnpm install --frozen-lockfile` funciona.
- [ ] La skill de Hyperframes está instalada en local en `.claude/skills/` (git-ignorada) y `npx hyperframes` renderiza una composición.
- [ ] `scripts/seed-demo.mjs` termina con error y sin escribir nada si `NEXT_PUBLIC_SUPABASE_URL` no es `localhost` o `127.0.0.1`.
- [ ] Tras el seed local, el usuario demo ve datos en Resumen, Presupuestos, Metas, Deudas, Score, Recomendaciones y en el espacio Empresa.
- [ ] `public/videos/` contiene `demo.mp4`, `demo.webm`, `demo-poster.webp` y, por cada uno de los 5 clips, su MP4, WebM y póster.
- [ ] El video principal dura entre 45 y 60 s, no tiene pista de audio y pesa ≤ 8 MB por formato; cada clip dura entre 5 y 8 s y pesa ≤ 1.5 MB por formato; `public/videos/` pesa ≤ 25 MB.
- [ ] En el video principal se ve un cursor que mueve, hace clic y navega por Resumen, Presupuestos, Metas, Deudas, Score, Recomendaciones y Empresa, en ese orden, y no muestra el registro de un movimiento.
- [ ] La UI del video está en modo claro y coincide con la app: tipografía, colores y componentes son los reales (grabados, no recreados).
- [ ] El video muestra la nota "Datos de ejemplo" y no contiene métricas, clientes ni testimonios inventados ni menciones a IA.
- [ ] `/` muestra la sección `#demo` inmediatamente después del hero y el header tiene un enlace "Demo" que lleva a ella.
- [ ] El video principal y los clips muestran la app dentro de una ventana macOS (semáforo, barra de título) sobre un escritorio con barra de menú y Dock, con cursor estilo macOS.
- [ ] Los videos no contienen logo de Apple, íconos de apps de Apple, fondos de pantalla de Apple ni la fuente SF Pro.
- [ ] El video principal se ve igual (en claro) con el tema claro y con el oscuro de la página.
- [ ] El video principal no descarga su archivo hasta pulsar play (`preload="none"`) y reserva su espacio sin generar CLS.
- [ ] Con `prefers-reduced-motion: reduce` ningún video hace autoplay, no hay escena 3D y los elementos aparecen sin animación.
- [ ] Cada clip de `features.tsx` reproduce solo mientras su tarjeta está en pantalla y queda en pausa al salir.
- [ ] La tarjeta "Código abierto" sigue sin clip y el resto de las tarjetas ya no son seis tarjetas idénticas.
- [ ] El HTML de `/` incluye JSON-LD `VideoObject` con `name`, `description`, `thumbnailUrl`, `uploadDate`, `duration` y `contentUrl` absolutos.
- [ ] En `>= 768 px` sin reduced-motion el hero renderiza la escena Three.js; en `< 768 px` no se descarga el chunk de `three` y se ve `hero-visual.tsx`.
- [ ] La escena 3D no renderiza cuadros con el hero fuera de pantalla.
- [ ] Los títulos y tarjetas de cada sección se animan al entrar en pantalla una sola vez, y los elementos del Score responden al scroll.
- [ ] Ningún componente de la landing arma a mano una ruta de video: todas salen de `SITE.landing`.
- [ ] La landing no contiene los patrones eliminados en el `critique` (íconos en cuadros de color, tres tarjetas idénticas, gradientes de relleno), según el informe de `audit`.
- [ ] Los pares texto/fondo nuevos cumplen AA en claro y oscuro, y todo control nuevo (play/pausa) mide 44 px o más y es operable por teclado con foco visible.
- [ ] Sin scroll horizontal en 375 px.
- [ ] La landing no hace peticiones a dominios externos al cargar (salvo Supabase en la isla de sesión).
- [ ] Lighthouse móvil ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en `/`, sobre `pnpm start`.
- [ ] `DESIGN.md`, `docs/ui.md`, `docs/producto.md`, `CLAUDE.md`, `PRODUCT.md` y `CHANGELOG.md` están actualizados; SPEC 12 apunta a este spec para los videos.

## Decisiones

- **Sí:** grabar la app real con datos demo y dibujar el cursor en Hyperframes. Es la única forma de que la UI sea idéntica a la real; reconstruirla en HTML se desfasa con cada cambio de UI.
- **No:** reconstruir las pantallas en HTML ni usar capturas estáticas. Menos fieles y más trabajo de mantenimiento.
- **Sí:** los scripts de seed, grabación y preparación del video quedan solo en local, git-ignorados (2026-11-04, decisión del usuario). `video/` (composiciones, tomas, renders y borradores) también queda solo en local. En el repo solo van los videos renderizados de `public/videos/`.
- **Sí:** el seed corre solo contra Supabase local y rechaza otras URLs. Usa `service_role`, que nunca debe tocar el proyecto remoto ni el navegador.
- **No:** cuenta demo en el proyecto remoto. Mezcla datos ficticios con los reales y deja credenciales a mano.
- **Sí:** Playwright registra la trayectoria del cursor en un `.json`. La grabación de video no dibuja el cursor del sistema, y así la animación del cursor es controlable y suave.
- **Sí:** video principal sin registro de movimientos, enfocado en el estilo de vida (orden financiero que motiva). Pedido explícito del usuario: registrar es básico y no vende.
- **Sí:** UI del video en modo claro y presentada como escritorio macOS (ventana, barra de menú, Dock, cursor). Pedido del usuario; es más comercial y no obliga a cambiar el tema por defecto de la app.
- **Sí:** el escritorio macOS se compone en Hyperframes y la grabación solo captura la app. Así se puede cambiar el entorno sin volver a grabar.
- **No:** logo, apps, fondos ni tipografía de Apple. Son marca y material con licencia; se imita la forma de la interfaz con elementos propios y genéricos.
- **No:** landing en claro por defecto. Cambiaría la identidad oscura de SPEC 14 por una decisión que solo afecta al video.
- **Sí:** 1 video principal + 5 clips. "Código abierto" no tiene pantalla que grabar; lo cubre su sección de texto.
- **Sí:** videos en `public/videos/` del repo, MP4 + WebM + póster, en 1080p y ≤ 25 MB (2026-11-04: subido de 15 MB a pedido del usuario para no bajar a 720p). Coherente con "sin peticiones externas"; el costo es que el repo crece con cada re-render.
- **No:** Supabase Storage ni YouTube/Vimeo. Añaden una petición externa y dependencias de terceros o cookies.
- **Sí:** sin audio, con texto en pantalla. Se ve bien en autoplay silencioso y evita guion, voz y licencias.
- **Sí:** Three.js solo en el hero, diferido y desactivado en móvil, reduced-motion y `saveData`. Protege Lighthouse ≥ 90; el fallback estático es el mockup actual.
- **No:** 3D en Score ni fondo global. Más JS y GPU a cambio de poco valor.
- **Sí:** `@react-three/fiber` sin `drei`. Menos dependencias; se agrega `drei` solo si una pieza concreta lo exige.
- **Sí:** Motion con `LazyMotion` + `domAnimation` y `MotionConfig reducedMotion="user"`. Menor bundle y respeto automático de la preferencia del sistema.
- **Sí:** `Reveal` compartido, no animaciones sueltas por componente. Mantiene un solo ritmo de movimiento.
- **Sí:** la skill de Impeccable aplicada a toda la landing (`critique` → `polish` → `audit`), no solo a las secciones nuevas. Un hero pulido con el resto genérico se nota.
- **Sí:** `score-visual.tsx` se queda como mockup mejorado, no se reemplaza por video: el score ya está en el video principal y en un clip.
- **Sí:** JSON-LD `VideoObject` para el video principal. Aprovecha el contenido nuevo para SEO sin costo de peso.
- **Sí:** especificación como un solo spec con etapas separables. El usuario pidió todo junto; el riesgo de tamaño se gestiona con la opción de mover las etapas 2–5 a un 19b.

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hyperframes cambia de CLI o estructura, o la skill queda en una ruta no reconocida | Paso 1 verifica la instalación y un render de prueba antes de invertir en las composiciones; la ubicación final se documenta en `CLAUDE.md`.              |
| FFmpeg no está instalado en la máquina de Windows                                  | Paso 1 lo comprueba y documenta cómo instalarlo; los videos van commiteados, así que el CI no lo necesita.                                                |
| Los videos superan el presupuesto de peso                                          | Se ajustan bitrate, resolución de salida (1280×720 si hace falta) y duración; el criterio de aceptación fija los máximos.                                 |
| Three.js y Motion bajan Lighthouse de rendimiento                                  | Carga diferida, activación condicionada, `LazyMotion`, frameloop bajo demanda y medición en el paso 11; si no llega a 90, se recorta la escena 3D.        |
| Las grabaciones quedan desfasadas cuando cambie la UI                              | `seed-demo` y `record-demo` son repetibles en la máquina que los tiene (no están en el repo); re-renderizar es correr los scripts y `hyperframes render`. |
| El usuario demo expone credenciales o se corre el seed contra producción           | Credenciales solo en `.env.local`; guarda de URL local en el script; `service_role` nunca en el repo.                                                     |
| Autoplay de video y animaciones molestan o excluyen a usuarios                     | Respeto de `prefers-reduced-motion` y `saveData`, controles con teclado y sin audio.                                                                      |
| El `critique` pide cambios que chocan con los tokens de SPEC 14                    | Los cambios se hacen dentro de los tokens existentes (`--brand`, `--income`...); cualquier token nuevo se documenta en `docs/ui.md` antes de usarse.      |
| Los datos demo se leen como cifras reales                                          | Nota "Datos de ejemplo" visible en el video y ningún dato de usuarios reales en el seed.                                                                  |

## Lo que **no** entra en este spec

- Audio, música, locución o subtítulos `.vtt`.
- Video de "Código abierto" y de las páginas legales.
- Cualquier promesa o capa de IA generativa.
- Cambios en dashboard, auth o esquema de base de datos.
- Escenas 3D fuera del hero.
- Re-render de videos en el CI.
- Multidioma, blog, precios, testimonios y analítica.

Cada uno, si llega, va en su propio spec.
