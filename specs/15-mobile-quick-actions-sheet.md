# SPEC 15 — Experiencia móvil: hoja de acciones rápidas, tab de espacio y barra inferior

> **Estado:** Implementado
> **Depende de:** SPEC 13, SPEC 14
> **Fecha:** 2026-11-01
> **Objetivo:** Que en el teléfono Tesoro se use como una app: al entrar se abre una hoja de acciones rápidas para registrar al instante, un tab fijo arriba cambia entre Personal y Empresa y una barra inferior reemplaza al aside.

## Por qué existe este spec

SPEC 14 dejó el shell pensado para escritorio.
En el teléfono el aside es un Drawer detrás de una hamburguesa y los accesos rápidos son un botón de ícono en el header.
El uso real en el teléfono es registrar rápido: un gasto en la tienda, el pago de la tarjeta, el arriendo del mes.

El trabajo se parte en dos specs, igual que 14:

- **15 (este):** hoja de acciones rápidas, tab superior Personal / Empresa, barra inferior, manifest instalable, áreas táctiles y teclado numérico en montos.
- **15b:** formularios a pantalla completa, tablas convertidas en tarjetas, gráficas legibles en pantallas angostas y Lighthouse móvil ≥ 90.

## Alcance

**Entra:**

- **Corte móvil:** todo lo de este spec aplica solo a anchos `< 768 px`, el mismo corte `md` que ya usa el sidebar.
  - `useIsMobile` y `MOBILE_QUERY` salen de `src/components/dashboard/sidebar/sidebar.tsx` a `src/hooks/use-is-mobile.ts` para reusarlos.
  - Tablet y escritorio quedan como en SPEC 14.
- **Hoja de acciones rápidas** (`src/components/dashboard/mobile/quick-sheet.tsx`):
  - `Drawer` de HeroUI con `placement="bottom"`, con asa visual arriba;
  - se cierra deslizando hacia abajo, tocando el fondo, con un botón "Cerrar" o con Escape;
  - solo existe en rutas de un espacio: `/dashboard/personal/**` y `/dashboard/business/[id]/**`;
  - **Personal**, cinco acciones fijas en este orden:
    1. **Gasto**: abre `TransactionDialog` con tipo gasto;
    2. **Ingreso**: abre `TransactionDialog` con tipo ingreso;
    3. **Aporte a meta**: abre `ContributionDialog` con `Select` de metas activas; sin metas, navega a `/dashboard/personal/goals`;
    4. **Pago de deuda o tarjeta**: abre `PaymentDialog` con `Select` de deudas activas; sin deudas, navega a `/dashboard/personal/debts`;
    5. **Marcar gasto fijo pagado**: abre `PayOccurrenceDialog` (nuevo) con `Select` de ocurrencias pendientes y vencidas; al elegir una, abre `TransactionDialog` prellenado y enlazado, igual que `PayOccurrenceButton`; sin pendientes, navega a `/dashboard/personal/budgets?tab=recurring`;
  - **Empresa**, dos acciones fijas: **Venta** y **Costo o gasto**, ambas con `TransactionDialog` y el tipo preseleccionado;
  - el traspaso no es una acción de la hoja: se registra desde el diálogo de movimiento (opción "Traspaso"), como dice `CLAUDE.md`;
  - al tocar una acción la hoja se cierra y se abre el diálogo directo, sin cambiar de página;
  - al pie, un `Switch` "Abrir al entrar" que controla la apertura automática en ese dispositivo.
- **Apertura automática** (`src/components/dashboard/mobile/use-quick-sheet-auto-open.ts`):
  - se abre sola en cada carga completa de una ruta de espacio (entrar, recargar, reabrir la app instalada);
  - se abre sola cuando la pestaña vuelve a ser visible (`visibilitychange`) tras 5 minutos o más oculta;
  - la navegación entre páginas del dashboard no la abre;
  - no se abre si el switch "Abrir al entrar" está apagado, si hay un diálogo abierto o si la ruta no es de un espacio;
  - no se abre en `>= 768 px`.
- **Datos de la hoja:** el loader de `src/components/dashboard/quick-actions.tsx` ya carga espacios, categorías, cuentas, metas y deudas.
  - Se le agrega `getUpcomingPayments(personal.id)` filtrado a ocurrencias sin pagar.
  - Header y hoja comparten esos datos con un contexto cliente (`QuickActionsProvider`), sin una segunda carga.
- **Tab superior Personal / Empresa** (`src/components/dashboard/mobile/mobile-workspace-tabs.tsx`):
  - fila sticky bajo el header, tabs pill a todo el ancho, visible en todas las rutas del dashboard;
  - reutiliza la lógica de `workspace-tabs.tsx` (destino y estado activo), sin duplicarla;
  - **Personal** lleva a `/dashboard/personal`;
  - **Empresa** lleva a `/dashboard/business/[id]` de la primera empresa sin marca de borrado; sin empresa, al estado vacío `/dashboard/business`;
  - el primario cambia solo por la ruta, con `WorkspaceThemeRoot` (verde en Personal, naranja en Empresa); no se pasa color por props;
  - el cambio entre varias empresas sigue en el switcher del Drawer.
- **Header móvil:** título de la página (o saludo en el Resumen) y accesos rápidos de SPEC 14.
  - A la izquierda del título, un botón de menú de 44 × 44 px abre el Drawer del aside con la navegación completa, Ayuda, tema y usuario.
- **Barra inferior** (`src/components/dashboard/mobile/bottom-nav.tsx`):
  - fija abajo, con `padding-bottom: env(safe-area-inset-bottom)`;
  - cinco posiciones: dos destinos, botón central, dos destinos;
  - **Personal:** Resumen, Movimientos, **[+]**, Presupuestos, Metas;
  - **Empresa:** Resumen, Movimientos, **[+]**, Flujo de caja, Reportes;
  - **[+]** abre la hoja de acciones rápidas (el botón fijo para volver a abrirla);
  - en rutas sin espacio (`/dashboard/account`, estado vacío de Empresa) muestra los 4 destinos de Personal, sin botón central;
  - ítem activo con el primario del espacio, `aria-current="page"`;
  - los destinos se definen en `SITE.navigation.mobile` y se toman de los ítems existentes de `SITE.navigation.personal` / `.business`.
  - El `<main>` recibe padding inferior para que la barra no tape contenido.
- **Manifest instalable**, sin service worker:
  - `app/manifest.ts`: ícono `maskable` de 512 px (`public/icons/icon-maskable-512.png`, generado por `pnpm brand:assets` desde `assets/brand/mark.svg` con margen de zona segura), `id`, `orientation: "portrait"` y `start_url` a `/dashboard/personal`;
  - `app/layout.tsx`: `appleWebApp` (capaz, título, barra de estado) en la metadata y `viewportFit: "cover"` en `viewport`;
  - `public/apple-touch-icon.png` se mantiene.
- **Áreas táctiles e inputs:**
  - todo control del shell móvil (barra inferior, tab superior, hoja, header) mide 44 × 44 px o más;
  - los botones de las acciones de la hoja miden 56 px de alto o más;
  - todo campo de monto de la app usa `inputMode="decimal"`.
- **Documentación:**
  - `docs/ui.md`: sección "Móvil" con el corte, la hoja, la apertura automática, la barra inferior y el tab;
  - `CLAUDE.md` (sección "UI y tema"): una línea sobre la experiencia móvil;
  - `CHANGELOG.md` en `[Unreleased]`.

**Fuera de alcance (para specs futuros):**

- Formularios a pantalla completa, tablas convertidas en tarjetas, gráficas legibles en pantallas angostas y Lighthouse móvil ≥ 90 (**SPEC 15b**).
- Experiencia móvil en tablet (`>= 768 px`).
- Personalizar o reordenar las acciones de la hoja.
- Preferencia "Abrir al entrar" sincronizada entre dispositivos (requiere columna en `profiles`).
- Service worker, modo sin conexión y notificaciones push.
- App nativa.
- Importar y Traspaso como acciones de la hoja.

## Modelo de datos

Sin tablas ni migraciones.

Persistencia solo en el navegador:

| Clave                             | Almacén          | Valor                                        | Por defecto |
| --------------------------------- | ---------------- | -------------------------------------------- | ----------- |
| `tesoro:quick-sheet:auto-open:v1` | `localStorage`   | `"true"` / `"false"`                         | `"true"`    |
| `tesoro:quick-sheet:hidden-at:v1` | `sessionStorage` | marca de tiempo (ms) de la última vez oculta | sin valor   |

Si el almacenamiento falla (modo privado, bloqueado), se usa un valor en memoria y la hoja se comporta como si el switch estuviera encendido.

Estructuras de presentación:

```ts
// src/config/site.ts
navigation: {
  mobile: {
    personal: ["/dashboard/personal", "/dashboard/personal/transactions",
               "/dashboard/personal/budgets", "/dashboard/personal/goals"],
    business: ["", "/transactions", "/cash-flow", "/reports"] // segmentos
  }
}

// src/components/dashboard/mobile/quick-sheet.tsx
type QuickSheetAction =
  | "expense" | "income" | "contribution" | "payment" | "recurring" // Personal
  | "sale" | "cost"                                                  // Empresa

// src/components/dashboard/mobile/use-quick-sheet-auto-open.ts
const HIDDEN_THRESHOLD_MS = 5 * 60 * 1000
```

`TransactionDialog` recibe el tipo inicial (gasto / ingreso) en `initialValues`; si hoy no lo acepta, se agrega como campo opcional.

## Plan de implementación

1. Extraer `useIsMobile` y `MOBILE_QUERY` a `src/hooks/use-is-mobile.ts` y usarlos desde el sidebar. `pnpm check` pasa.
2. Agregar `inputMode="decimal"` a todos los campos de monto (`grep` de los campos `amount`/monto en `src/features/**`).
3. Crear `QuickActionsProvider` y mover los datos del loader de `quick-actions.tsx` al contexto. Agregar `getUpcomingPayments` filtrado a pendientes. El header de SPEC 14 sigue igual.
4. Aceptar el tipo inicial en `TransactionDialog` (`initialValues`).
5. Crear `PayOccurrenceDialog` en `src/features/recurring-expenses/components/` con `Select` de pendientes y el `TransactionDialog` prellenado.
6. Crear `quick-sheet.tsx` con las acciones de Personal y Empresa, sus diálogos y los destinos de respaldo sin metas, deudas o pendientes.
7. Crear `use-quick-sheet-auto-open.ts` con carga, `visibilitychange`, umbral de 5 min, switch en `localStorage` y fallback en memoria.
8. Agregar `SITE.navigation.mobile` y crear `bottom-nav.tsx` con [+] (abre la hoja) (abre la hoja). Padding inferior en `<main>`.
9. Crear `mobile-workspace-tabs.tsx` reusando la lógica de `workspace-tabs.tsx`. Montarlo bajo el header en `app/dashboard/layout.tsx` y dejar el botón de menú del header como único acceso al Drawer del aside en `< 768 px`.
10. Generar `icon-maskable-512.png` en `scripts/generate-brand-assets.mjs` y actualizar `app/manifest.ts` y la metadata/viewport de `app/layout.tsx`.
11. Revisar a 360 y 390 px los tamaños táctiles del shell móvil y la hoja.
12. Escribir la sección "Móvil" de `docs/ui.md`, actualizar `CLAUDE.md` y `CHANGELOG.md`.

## Criterios de aceptación

- [ ] A 390 px, al cargar `/dashboard/personal` la hoja de acciones rápidas está abierta con Gasto, Ingreso, Aporte a meta, Pago de deuda o tarjeta y Marcar gasto fijo pagado, en ese orden. _(implementado; pendiente de prueba en navegador)_
- [ ] A 390 px, al cargar `/dashboard/business/[id]` la hoja muestra solo Venta y Costo o gasto. _(implementado; pendiente de prueba en navegador)_
- [ ] A 1024 px la hoja no se abre sola, no hay barra inferior ni tab superior móvil, y el shell es el de SPEC 14. _(implementado; pendiente de prueba en navegador)_
- [ ] Navegar entre páginas del dashboard no abre la hoja. _(implementado; pendiente de prueba en navegador)_
- [ ] Ocultar la pestaña menos de 5 minutos y volver no abre la hoja; 5 minutos o más sí. _(implementado; pendiente de prueba en navegador)_
- [ ] Con el switch "Abrir al entrar" apagado, recargar no abre la hoja y el switch sigue apagado tras recargar. _(implementado; pendiente de prueba en navegador)_
- [ ] En `/dashboard/account` la hoja no se abre sola y la barra inferior no tiene botón central. _(implementado; pendiente de prueba en navegador)_
- [ ] La hoja se cierra deslizando hacia abajo, con "Cerrar", tocando el fondo y con Escape. _(implementado; pendiente de prueba en navegador)_
- [ ] El botón [+] de la barra inferior vuelve a abrir la hoja. _(implementado; pendiente de prueba en navegador)_
- [ ] Cada acción abre su diálogo sin cambiar la URL, y al guardar el registro aparece en la página correspondiente. _(implementado; pendiente de prueba en navegador)_
- [ ] "Gasto" e "Ingreso" abren el diálogo con ese tipo ya elegido; "Venta" y "Costo o gasto" igual en Empresa. _(implementado; pendiente de prueba en navegador)_
- [ ] Sin metas, "Aporte a meta" navega a `/dashboard/personal/goals`; sin deudas, "Pago de deuda o tarjeta" navega a `/dashboard/personal/debts`; sin pendientes, "Marcar gasto fijo pagado" navega a `/dashboard/personal/budgets?tab=recurring`. _(implementado; pendiente de prueba en navegador)_
- [ ] Marcar un gasto fijo pagado desde la hoja crea el movimiento enlazado a la ocurrencia y la ocurrencia pasa a pagada en Gastos fijos. _(implementado; pendiente de prueba en navegador)_
- [ ] El tab superior está visible en todas las rutas del dashboard a 390 px; Personal pinta el primario verde y Empresa el naranja. _(implementado; pendiente de prueba en navegador)_
- [ ] Sin empresa, el tab Empresa lleva al estado vacío para crearla. _(implementado; pendiente de prueba en navegador)_
- [ ] La barra inferior muestra Resumen, Movimientos, [+], Presupuestos, Metas en Personal y Resumen, Movimientos, [+], Flujo de caja, Reportes en Empresa, sin desborde horizontal a 360 px; el destino activo tiene `aria-current="page"`. _(implementado; pendiente de prueba en navegador)_
- [ ] El botón de menú del header abre el Drawer con la navegación completa, Ayuda, tema y usuario. _(implementado; pendiente de prueba en navegador)_
- [ ] La barra inferior no tapa el último elemento de ninguna página. _(implementado; pendiente de prueba en navegador)_
- [ ] Todo control de la barra inferior, el tab superior, el header y la hoja mide 44 × 44 px o más a 360 px; las acciones de la hoja, 56 px de alto o más. _(implementado; pendiente de prueba en navegador)_
- [x] Todo campo de monto de la app tiene `inputMode="decimal"`.
- [ ] El manifest servido tiene un ícono `maskable` de 512 px, `display: "standalone"` y `start_url` `/dashboard/personal`; Chrome Android ofrece "Instalar app" y en iOS "Agregar a inicio" abre sin barra del navegador. _(manifest servido verificado con `next start`: ícono `maskable` 512, `standalone`, `start_url` correcto, meta `apple-mobile-web-app-*`; falta probar la instalación en Chrome Android e iOS)_
- [x] `grep -r "data-workspace" src app` solo devuelve `workspace-theme-root.tsx` y `globals.css`.
- [x] `docs/ui.md` tiene la sección "Móvil" y `CHANGELOG.md` la entrada en `[Unreleased]`.
- [x] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [x] No hay migraciones nuevas en `supabase/migrations/`.

## Decisiones

- **Sí:** partir en 15 y 15b. Este fija el shell móvil y la hoja; 15b adapta las pantallas.
- **No:** un solo spec. Tocaría todos los diálogos, tablas y gráficas en un PR enorme.
- **Sí:** abrir en cada carga y al volver visible tras ≥ 5 minutos. Cubre "reabrir la app" sin abrirla al cambiar de app un momento.
- **No:** abrir en cada `visibilitychange`. Molesta al volver de copiar un dato.
- **No:** una vez por sesión. No cumple "aunque ya tuviera la página abierta".
- **Sí:** switch "Abrir al entrar" en `localStorage`, por dispositivo. Sin migración.
- **No:** preferencia en `profiles`. Cambio de esquema por un ajuste de presentación.
- **Sí:** solo `< 768 px`, el corte `md` existente. Un solo criterio para sidebar y shell móvil.
- **No:** incluir tablet o detectar puntero táctil. Menos predecible y más alcance.
- **Sí:** barra inferior con 4 destinos y [+] central; el Drawer del aside se abre desde el botón de menú del header. Con "Más" la barra tenía 6 posiciones y se desbordaba a 360 px.
- **No:** solo hamburguesa sin barra inferior. No se siente como app.
- **Sí:** cinco acciones fijas en Personal y dos en Empresa. Sin preferencias que guardar.
- **No:** acciones personalizables. Necesita persistir orden y selección.
- **Sí:** traspaso desde el diálogo de movimiento, no como acción. Regla de `CLAUDE.md`.
- **Sí:** "Marcar gasto fijo pagado" con `Select` de pendientes, como aporte y pago de SPEC 14. Mismo patrón; reusa `TransactionDialog` con `recurring`.
- **Sí:** manifest con ícono maskable, sin service worker. Instalable sin rozar el modo sin conexión excluido.
- **Sí:** tab superior como fila sticky bajo el header. Conserva el título de la página.
- **No:** tab dentro del header. Se pierde el título.
- **Sí:** el tab Empresa abre la primera empresa activa. Hoy el límite es 1; el switcher del Drawer queda para varias.
- **Sí:** en rutas sin espacio, barra con destinos de Personal y sin [+]. Sigue la regla de SPEC 14: fuera de un espacio no hay accesos.
- **Sí:** datos de la hoja desde el loader de `quick-actions.tsx` vía contexto. Una sola carga para header y hoja.

## Riesgos

| Riesgo                                                                      | Mitigación                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| El `Drawer` de HeroUI no trae gesto de deslizar para cerrar                 | Confirmar en la doc de HeroUI v3 en el paso 6; si no existe, arrastre con pointer events sobre el asa.          |
| La hoja aparece antes de que lleguen los datos (Suspense) y salta           | La hoja abre con las acciones visibles y deshabilitadas hasta que el contexto tenga datos.                      |
| Abrir la hoja en cada carga molesta a quien solo quiere consultar           | Switch "Abrir al entrar" en la misma hoja, visible sin scroll.                                                  |
| `visibilitychange` no se dispara igual en iOS al reabrir la app instalada   | La carga completa también abre la hoja; iOS suele recargar la PWA tras un rato en segundo plano.                |
| Hoja, diálogo y Drawer del aside abiertos a la vez                          | Un solo overlay a la vez: abrir uno cierra los otros; la apertura automática no corre con un diálogo abierto.   |
| La barra inferior tapa botones o el teclado sube y la deja encima del campo | Padding inferior en `<main>` con `safe-area-inset-bottom`; se oculta la barra mientras un diálogo está abierto. |
| Las pantallas aún no adaptadas se ven mal en el teléfono hasta 15b          | Se acepta; 15b es el siguiente spec. Este no debe empeorar ninguna pantalla.                                    |

## Lo que **no** entra en este spec

- Formularios a pantalla completa, tablas → tarjetas, gráficas angostas y Lighthouse móvil ≥ 90 (SPEC 15b).
- Experiencia móvil en tablet.
- Acciones personalizables, Importar y Traspaso en la hoja.
- Preferencia sincronizada entre dispositivos.
- Service worker, modo sin conexión, notificaciones push y app nativa.
- Cambios de esquema o migraciones.

Cada uno, si llega, va en su propio spec.
