# SPEC 12 — Landing, páginas legales y assets de marca

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 07
> **Fecha:** 2026-10-31
> **Objetivo:** Que el sitio público presente Tesoro con una landing completa, páginas legales propias y todos los assets de marca y SEO que la metadata ya referencia.

## Por qué existe este spec

`app/page.tsx` sigue siendo el placeholder de la v0.1.0, aunque la app ya tiene auth, dashboard, score y Empresa.
`SITE` y la metadata apuntan a cinco assets que no existen (`/opengraph-image.png`, `/brand/logo.png`, `/apple-touch-icon.png`, `/icons/icon-192.png`, `/icons/icon-512.png`).
`SITE.legal` declara Privacidad y Términos, pero no hay páginas.
No hay identidad visual definida: este spec la crea (isotipo SVG + wordmark en Geist, acento emerald de `--income`).
Los visuales de la landing son **mockups JSX interinos**. Un spec futuro los reemplaza por videos (skill HyperFrame).

## Alcance

**Entra:**

- Identidad de marca:
  - isotipo SVG propio (moneda/cofre simple) y wordmark "Tesoro" en Geist;
  - acento de marca = `--income` (emerald) ya existente, sin paleta nueva;
  - componente `Logo` reutilizable (isotipo inline + wordmark), con variante solo isotipo.
- Assets generados desde SVG fuente con un script sharp y commiteados:
  - `public/opengraph-image.png` (1200×630);
  - `public/brand/logo.png` (512×512);
  - `public/apple-touch-icon.png` (180×180);
  - `public/icons/icon-192.png` y `public/icons/icon-512.png`;
  - `app/favicon.ico` (16, 32 y 48) reemplaza el actual;
  - `app/icon.svg` nuevo para navegadores modernos.
- Grupo de rutas `app/(public)/` con layout de header y footer públicos, que envuelve `/` y `/legal/*`.
- Header público:
  - `Logo` a `/`, enlaces de `SITE.navigation.main`;
  - toggle de tema claro/oscuro (next-themes);
  - botones de sesión en una isla dentro de `<Suspense>`: con sesión "Ir al dashboard"; sin sesión "Iniciar sesión" y "Crear cuenta". El fallback es el estado sin sesión;
  - en móvil, menú en `Sheet`.
- Footer público: `Logo`, slogan, enlaces a legales (`SITE.legal`), repo, issues, redes de `SITE.social`, licencia MIT, versión y "Hecho por" `SITE.author`.
- Landing `/` completa, en este orden:
  1. Hero (`id` ninguno): título, `SITE.info.slogan`, CTA "Crear cuenta" + secundario "Ver en GitHub", visual `LandingHeroVisual`.
  2. Funciones (`#funciones`): grilla con los 6 ítems de `SITE.features`, cada uno con ícono lucide.
  3. Cómo funciona (`#como-funciona`): 3 pasos (Registra → Visualiza → Mejora).
  4. Score (`#score`): explicación del score de 0 a 100, los 7 factores con sus pesos de `docs/producto.md`, las 4 bandas y `LandingScoreVisual`.
  5. Personal y Empresa: los dos espacios de `SITE.workspaces.types`.
  6. Código abierto (`#open-source`): MIT, enlace al repo, a issues y a `CONTRIBUTING`.
  7. CTA final a `/sign-up`.
- Visuales interinos JSX con datos ficticios fijos, aislados en su propio archivo:
  - `LandingHeroVisual`: mini-dashboard (tarjetas de ingresos/gastos/balance y barras de 6 meses) en SVG/HTML puro;
  - `LandingScoreVisual`: medidor del score con banda y 3 recomendaciones de ejemplo.
- Páginas legales en `/legal/privacy` y `/legal/terms`:
  - una ruta dinámica `app/(public)/legal/[slug]/page.tsx` con `generateStaticParams` desde `SITE.legal`;
  - slug desconocido → `notFound()`;
  - contenido en TSX por documento, con layout común: título, "Última actualización" desde `SITE.legal[].updatedAt`, índice de secciones con anclas y cuerpo;
  - metadata con `buildMetadata` y JSON-LD `buildBreadcrumbSchema`.
- Textos legales redactados en español por Claude según lo que la app hace de verdad (ver "Contenido legal").
- Aviso en `/sign-up`, bajo el formulario y los botones OAuth: "Al crear tu cuenta aceptas los Términos y Condiciones y la Política de Privacidad", con enlaces.
- `sitemap.ts`: agregar `/legal/privacy` y `/legal/terms`.
- `docs/producto.md`: mapa de rutas con `/legal/[slug]`, sección "Landing" ampliada y nueva sección "Marca".
- `CLAUDE.md`: quitar los assets de "Pendientes conocidos".
- `CHANGELOG.md` en `[Unreleased]`.
- Lighthouse móvil ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en `/`, `/legal/privacy` y `/legal/terms`.

**Fuera de alcance (para specs futuros):**

- Videos de la landing (HyperFrame); reemplazan los mockups JSX.
- Capturas reales del dashboard.
- Blog, precios o planes.
- Multidioma.
- Checkbox de aceptación o registro en BD de la versión aceptada de los términos.
- Banner de cookies (no hay cookies de terceros ni analítica).
- Analítica, pixel o métricas de visitas.
- Contador de estrellas de GitHub u otra llamada a APIs externas.
- Formulario de contacto o newsletter.
- Página "Acerca de" o de contribuidores.
- Revisión legal profesional de los textos.

## Modelo de datos

Sin tablas ni migraciones. Cambios en `src/config/site.ts`:

```ts
routes: {
  // ...existentes
  legal: "/legal"
},

legal: [
  { slug: "privacy", title: "Política de Privacidad", updatedAt: "2026-10-31" },
  { slug: "terms", title: "Términos y Condiciones", updatedAt: "2026-10-31" }
],

navigation: {
  main: [
    { name: "Inicio", href: "/" },
    { name: "Funciones", href: "/#funciones" },
    { name: "Cómo funciona", href: "/#como-funciona" },
    { name: "Score", href: "/#score" },
    { name: "Código abierto", href: "/#open-source" }
  ],
  // ...resto igual
}
```

- La URL de un legal es `${SITE.routes.legal}/${slug}`. Helper `legalHref(slug)` en `src/config/site.ts` o `src/libs/seo.ts`, no se arma a mano en componentes.
- `updatedAt` se actualiza a mano cada vez que cambia el texto.

Archivos nuevos:

```text
assets/brand/
  mark.svg              # isotipo, fuente de íconos y favicon
  logo.svg              # isotipo + wordmark, fuente de brand/logo.png
  opengraph.svg         # 1200×630, fuente de opengraph-image.png
scripts/generate-brand-assets.mjs
app/(public)/layout.tsx
app/(public)/page.tsx                 # movido desde app/page.tsx
app/(public)/legal/[slug]/page.tsx
app/icon.svg
src/components/brand/logo.tsx
src/components/site/site-header.tsx
src/components/site/site-header-session.tsx
src/components/site/site-footer.tsx
src/components/site/mobile-nav.tsx
src/components/theme/theme-toggle.tsx
src/features/landing/components/
  hero.tsx
  hero-visual.tsx
  features.tsx
  how-it-works.tsx
  score-section.tsx
  score-visual.tsx
  workspaces-section.tsx
  open-source.tsx
  final-cta.tsx
src/features/legal/components/legal-document.tsx
src/content/legal/privacy.tsx
src/content/legal/terms.tsx
```

Cada documento legal exporta su contenido con esta forma:

```ts
export type LegalSection = {
  id: string // ancla kebab-case
  title: string
  content: React.ReactNode
}
```

Script de assets:

- `sharp` como `devDependency` con versión exacta.
- Comando `pnpm brand:assets` en `package.json` → `node scripts/generate-brand-assets.mjs`.
- El `.ico` se arma en el script con entradas PNG (formato ICO con PNG embebido), sin dependencia extra.
- Los textos de `opengraph.svg` van convertidos a trazos (paths), para no depender de que el sistema tenga Geist al rasterizar.
- Los PNG generados se commitean. El CI no corre el script.

## Contenido legal

Responsable: Angel De La Torre, persona natural, Colombia. Contacto: `SITE.contact.email`. Servicio gratuito y de código abierto. Edad mínima 18 años. Marco: Ley 1581 de 2012 y Decreto 1377 de 2013.

**Política de Privacidad** (secciones):

1. Responsable del tratamiento.
2. Datos que se recogen: email, nombre y avatar (perfil), datos de proveedores OAuth (Google, GitHub: email, nombre, foto), registros financieros que el usuario introduce (movimientos, cuentas, presupuestos, metas, deudas, empresas, importaciones), preferencias (moneda, tema).
3. Finalidad: prestar el servicio, calcular gráficas, score y recomendaciones dentro de la cuenta, enviar emails de autenticación. Los datos financieros no se venden, no se comparten con fines publicitarios y no se usan para entrenar modelos.
4. Encargados: Supabase (base de datos, auth y Storage) y el proveedor de hosting de la app. Transferencia internacional a sus servidores.
5. Cookies y almacenamiento local: solo cookies de sesión de Supabase y la preferencia de tema. Sin analítica ni cookies de terceros.
6. Seguridad: RLS por usuario y espacio, HTTPS, la clave `service_role` nunca llega al navegador.
7. Conservación y borrado: borrado de cuenta con periodo de gracia de `SITE.accountDeletionGraceDays` días y purga automática; empresas con `SITE.workspaceDeletionGraceDays` días.
8. Derechos del titular (conocer, actualizar, rectificar, suprimir, revocar) y cómo ejercerlos por email; plazos de la Ley 1581 (10 días hábiles consultas, 15 reclamos). Queja ante la SIC.
9. Menores de edad: no se permite el registro de menores de 18.
10. Instancias propias: quien despliegue su propia copia (MIT) es responsable de los datos de esa instancia.
11. Cambios a la política.

**Términos y Condiciones** (secciones):

1. Aceptación (al crear cuenta).
2. Descripción del servicio: herramienta de organización; **no es asesoría financiera, contable, tributaria ni legal**. Score y recomendaciones son orientativos.
3. Cuenta: mayor de 18, datos veraces, custodia de la contraseña.
4. Uso aceptable: prohibido uso ilegal, abuso de la infraestructura, acceso a datos ajenos.
5. Contenido del usuario: los registros son del usuario; licencia limitada solo para prestar el servicio.
6. Gratuidad y disponibilidad: servicio gratuito, sin SLA, puede cambiar o suspenderse.
7. Código abierto: el código está bajo MIT; estos términos rigen la instancia oficial, no los forks.
8. Sin garantías y limitación de responsabilidad, en la medida que permita la ley colombiana.
9. Terminación y borrado de cuenta.
10. Ley aplicable: Colombia.
11. Cambios a los términos y contacto.

Los textos se escriben en lenguaje claro, en segunda persona ("tú"), como el resto de la UI.

## Plan de implementación

1. **SITE.** Cambiar slugs de `SITE.legal` a `privacy`/`terms`, `updatedAt` a `2026-10-31`, agregar `SITE.routes.legal`, `legalHref` y "Cómo funciona" en `navigation.main`. `pnpm check` pasa.
2. **SVG de marca.** Crear `assets/brand/mark.svg`, `logo.svg` y `opengraph.svg`. Crear `app/icon.svg` (copia de `mark.svg`).
3. **Script de assets.** Agregar `sharp` exacto como devDependency y `pnpm brand:assets`. El script genera los 5 PNG de `public/` y `app/favicon.ico`. Correrlo y commitear la salida. Abrir `/opengraph-image.png` y `/icons/icon-512.png` en el navegador y verlos.
4. **Logo y tema.** Crear `src/components/brand/logo.tsx` y `src/components/theme/theme-toggle.tsx`. Usar `Logo` en `app/(auth)/layout.tsx`.
5. **Layout público.** Crear `app/(public)/layout.tsx` con `SiteHeader` y `SiteFooter`. Mover `app/page.tsx` a `app/(public)/page.tsx` sin cambiar su contenido. `/` sigue respondiendo.
6. **Isla de sesión.** `site-header-session.tsx` lee el usuario con el cliente de servidor de Supabase dentro de `<Suspense>`. Verificar que `pnpm build` marca `/` como estática con hueco dinámico (PPR) y no como dinámica completa.
7. **Menú móvil.** `mobile-nav.tsx` con `Sheet`, mismos enlaces y botones.
8. **Secciones de texto.** Hero (sin visual), Funciones, Cómo funciona, Personal y Empresa, Código abierto y CTA final en `src/features/landing/components/`. `app/(public)/page.tsx` las compone.
9. **Sección Score.** `score-section.tsx` con factores, pesos y bandas. Los pesos se copian de `docs/producto.md` como constantes de presentación, con comentario que apunta a `src/features/score/`.
10. **Visuales.** `hero-visual.tsx` y `score-visual.tsx` con datos ficticios, montos en COP con `src/libs/format.ts`, colores con los tokens `--income`, `--expense`, `--balance` y de banda. Decorativos con `aria-hidden`, más un texto alternativo visible solo a lectores.
11. **Legales: estructura.** `legal-document.tsx` (título, fecha, índice, secciones) y `app/(public)/legal/[slug]/page.tsx` con `generateStaticParams`, `generateMetadata` con `buildMetadata` y breadcrumb JSON-LD. Slug inválido → 404.
12. **Legales: contenido.** Redactar `src/content/legal/privacy.tsx` y `terms.tsx` según "Contenido legal".
13. **Footer y sign-up.** Enlaces legales en el footer. Aviso de aceptación con enlaces en `app/(auth)/sign-up/page.tsx`, debajo de `SignUpForm`.
14. **Sitemap.** Agregar las dos rutas legales a `STATIC_ROUTES` (`yearly`, prioridad 0.3).
15. **Docs.** `docs/producto.md` (mapa de rutas, Landing, Marca), `CLAUDE.md` (pendientes), `CHANGELOG.md`.
16. **Lighthouse.** `pnpm build && pnpm start`, correr Lighthouse móvil en las 3 rutas y corregir lo que baje de 90.

## Criterios de aceptación

- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `pnpm build` reporta `/`, `/legal/privacy` y `/legal/terms` como prerenderizadas (estáticas o PPR), no dinámicas completas.
- [ ] `GET` de `/opengraph-image.png`, `/brand/logo.png`, `/apple-touch-icon.png`, `/icons/icon-192.png` y `/icons/icon-512.png` responde 200 con las dimensiones 1200×630, 512×512, 180×180, 192×192 y 512×512.
- [ ] `/favicon.ico` contiene 16, 32 y 48 px y muestra el isotipo nuevo; `/icon.svg` responde 200.
- [ ] Borrar los PNG y correr `pnpm brand:assets` los regenera idénticos en tamaño.
- [ ] La landing muestra, en orden: hero, funciones (6 ítems de `SITE.features`), cómo funciona (3 pasos), score (7 factores, 4 bandas), Personal y Empresa, código abierto y CTA final.
- [ ] Los enlaces del header llevan a `#funciones`, `#como-funciona`, `#score` y `#open-source`, y esos `id` existen.
- [ ] Sin sesión, el header muestra "Iniciar sesión" y "Crear cuenta"; con sesión, "Ir al dashboard" a `/dashboard`.
- [ ] El toggle de tema cambia entre claro y oscuro y la preferencia persiste al recargar.
- [ ] En 375 px de ancho no hay scroll horizontal y el menú móvil abre y cierra con teclado.
- [ ] `/legal/privacy` y `/legal/terms` muestran título, "Última actualización" con la fecha de `SITE.legal`, índice con anclas funcionales y todas las secciones de "Contenido legal".
- [ ] `/legal/otra-cosa` responde 404.
- [ ] Cada página pública tiene canonical propio y `<title>` con `titleTemplate`; las legales incluyen JSON-LD `BreadcrumbList`.
- [ ] `sitemap.xml` incluye `/legal/privacy` y `/legal/terms`.
- [ ] El footer enlaza a ambos legales, al repo y a issues.
- [ ] `/sign-up` muestra el aviso de aceptación con enlaces a ambos legales.
- [ ] Ningún componente arma a mano una URL legal ni duplica textos de marca: todo sale de `SITE`.
- [ ] Ninguna página pública hace peticiones a dominios externos al cargar (salvo Supabase en la isla de sesión).
- [ ] Lighthouse móvil ≥ 90 en Rendimiento, Accesibilidad, Buenas prácticas y SEO en `/`, `/legal/privacy` y `/legal/terms`, sobre `pnpm start`.
- [ ] `CLAUDE.md` ya no lista assets pendientes; `docs/producto.md` y `CHANGELOG.md` actualizados.

## Decisiones

- **Sí:** isotipo SVG propio + wordmark en Geist, diseñado por Claude. Desbloquea los assets ya; se reemplaza cambiando los SVG fuente y corriendo el script.
- **Sí:** acento = `--income` (emerald). Ya es el color "positivo" de la app; no se introduce paleta nueva.
- **No:** logo aportado por el usuario. Bloquearía la implementación.
- **Sí:** mockups JSX interinos. Sin imágenes pesadas, nítidos en claro y oscuro, buenos para Lighthouse.
- **No:** capturas reales. Hay que rehacerlas con cada cambio de UI; los videos del spec futuro cubren la demostración real.
- **Sí:** visuales aislados en `hero-visual.tsx` y `score-visual.tsx`, para que el spec de videos los cambie sin tocar el resto.
- **Sí:** `/legal/privacy` y `/legal/terms`, con slugs en inglés como el resto de rutas. Los slugs de `SITE.legal` cambian a `privacy`/`terms`.
- **No:** `/privacidad` en la raíz. Rompe la convención de slugs en inglés.
- **Sí:** contenido legal en TSX por documento. Sin dependencias nuevas.
- **No:** MDX. Agrega `@next/mdx` y configuración para dos documentos.
- **Sí:** textos legales redactados por Claude bajo Ley 1581, responsable persona natural en Colombia, edad mínima 18. No son asesoría legal; el autor los revisa.
- **No:** permitir menores desde 14. Exige autorización del representante y más texto.
- **Sí:** aviso de aceptación en `/sign-up` como texto con enlaces. Funciona igual para email y OAuth.
- **No:** checkbox obligatorio ni columna en BD. No aplica limpio a OAuth y no hace falta versionar la aceptación todavía.
- **Sí:** header con isla de sesión en `<Suspense>`. La página sigue prerenderizada con `cacheComponents`; solo los botones son dinámicos.
- **No:** header siempre igual. Peor experiencia para quien ya tiene sesión.
- **Sí:** toggle de tema en el header, con next-themes ya instalado.
- **Sí:** script sharp que genera PNG commiteados desde SVG fuente. Las URLs fijas de `SITE` no cambian.
- **No:** `opengraph-image.tsx` / `icon.tsx` con `ImageResponse`. Cambia las URLs (con hash) y obliga a tocar `SITE` y el manifest.
- **Sí:** textos del SVG de Open Graph convertidos a trazos. El rasterizado no depende de las fuentes del sistema.
- **Sí:** `.ico` armado en el script con PNG embebidos. Evita una dependencia solo para eso.
- **Sí:** reemplazar `app/favicon.ico` y agregar `app/icon.svg`. El favicon actual es el de Next.
- **Sí:** grupo `app/(public)/` con layout propio. Header y footer no aparecen en auth ni dashboard.
- **No:** banner de cookies. Solo hay cookies de sesión estrictamente necesarias y preferencia de tema.
- **No:** contador de estrellas de GitHub. Llamada externa que afecta rendimiento y puede fallar.

## Riesgos

| Riesgo                                                            | Mitigación                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| La isla de sesión vuelve dinámica toda la landing                 | Paso 6 verifica la salida de `pnpm build`; `connection()` y la lectura de cookies quedan solo dentro del `<Suspense>`.      |
| Salto de layout (CLS) cuando la isla resuelve                     | El fallback ocupa el mismo ancho que los botones con sesión y sin sesión.                                                   |
| Los pesos del score en la landing se desincronizan del código     | Constantes de presentación con comentario hacia `src/features/score/`; `docs/producto.md` es la referencia.                 |
| Textos legales incompletos o no válidos jurídicamente             | Se redactan sobre el comportamiento real de la app; el autor los revisa antes de aprobar; revisión profesional queda fuera. |
| sharp no compila en la máquina o en CI                            | `sharp: true` ya está en `allowBuilds`; el CI no corre el script porque los PNG van commiteados.                            |
| Cambiar los slugs de `SITE.legal` rompe enlaces existentes        | Hoy no hay páginas ni enlaces a los slugs viejos; se busca `privacidad`/`terminos` en el repo antes de cerrar.              |
| Lighthouse de Rendimiento < 90 por los mockups o el JS del header | Visuales como Server Components en SVG/HTML; solo toggle de tema y menú móvil son Client Components.                        |

## Lo que **no** entra en este spec

- Videos de la landing con HyperFrame.
- Capturas reales del dashboard.
- Blog, precios, planes o multidioma.
- Checkbox de aceptación o versión aceptada en BD.
- Banner de cookies y analítica.
- Contador de estrellas u otras APIs externas.
- Formulario de contacto, newsletter o página "Acerca de".
- Revisión legal profesional.

Cada uno, si llega, va en su propio spec.
