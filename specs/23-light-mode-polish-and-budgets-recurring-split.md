# SPEC 23 — Pulido de los modos claro y oscuro y Presupuestos / Gastos fijos como pantallas separadas

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 14, SPEC 18, SPEC 20
> **Fecha:** 2026-11-03
> **Objetivo:** Que el modo claro se vea más minimal y elegante (colores, sombras y superficies), que el modo oscuro gane profundidad y elevación sin alejarse del lenguaje del claro, y que Gastos fijos y Presupuestos sean dos ítems separados del aside, con Gastos fijos primero y como pestaña por defecto en el teléfono.

## Por qué existe este spec

- El modo claro quedó menos cuidado que el oscuro (por defecto): sombras y superficies no tienen la misma calidad y el color primario no juega bien con los grises.
- Presupuestos y Gastos fijos viven hoy en una sola ruta con tabs (`/dashboard/personal/budgets?tab=...`). El usuario usa Gastos fijos casi siempre y el presupuesto es informativo, así que el tab por defecto es el equivocado y los dos temas pesan distinto en el aside.

Es el cuarto de cuatro specs que salen del mismo pedido (ver SPEC 20).

## Alcance

**Entra:**

- **Pulido del modo claro con Impeccable** (guía `docs/ui.md`, contexto `PRODUCT.md`, comandos `critique`, `polish`, `audit`):
  - Revisar los tokens claros de `src/styles/globals.css`: fondo, `--surface`, `--overlay`, `--default`, `--muted`, `--field-*`, `--brand`, `--income`, `--expense`, `--balance`, `--category-*` y `--chart-*`.
  - Superficies: en claro, tarjetas blancas sobre un fondo gris suave, **sin borde** (consistente con el oscuro) y con una sombra sutil en capas (sombra ambiental muy difusa + contacto fino), nunca negra pura.
  - Primario por espacio (`data-workspace`: emerald en Personal, naranja en Empresa, neutro fuera): afinar luminosidad y saturación en claro para texto, botones y estados de foco.
  - Radios, espaciado y jerarquía tipográfica sin cambios de estructura; el estilo "más minimal" sale de menos ruido (menos relleno de color, más aire, sombras suaves), no de una rediseño.
  - Gráficas: colores y rejilla en claro con contraste AA (3:1 gráficos).
  - Verificar contraste y actualizar la tabla de contraste de `docs/ui.md`.
  - El resultado del claro ya está aprobado: no se vuelve a tocar salvo ajustes compartidos, que se revisan en ambos temas.
- **Mejora del modo oscuro con Impeccable** (`critique`, `polish`, `audit`), para un producto más interesante **sin alejarse del lenguaje visual del claro** (mismas estructuras, radios, sin bordes, mismo primario por espacio):
  - **Más profundo / OLED:** fondo más negro y neutro, tarjetas más neutras (menos tinte azulado/zinc), para un aspecto más premium y minimal.
  - **Elevación y superficies:** más separación fondo/tarjeta y entre niveles (`--surface`, `--surface-secondary`, `--overlay`, `--field-*`), sin bordes. Equivalente oscuro de la sombra del claro: brillo sutil superior (`inset` 1 px de baja opacidad) y/o sombra ambiental muy suave bajo diálogos y menús. `--surface-shadow` y `--overlay-shadow` oscuros se redefinen; un solo nivel por pila de tarjetas.
  - Revisar `--muted`, `--border`, `--separator`, estados, categorías, gráficas y primario por espacio en oscuro, solo si hace falta para mantener AA tras el cambio de fondo y superficies.
  - Verificar contraste AA (4.5:1 texto, 3:1 gráficos y foco) y actualizar la columna oscura de la tabla de `docs/ui.md`.
- **Separar Gastos fijos y Presupuestos:**
  - Nueva ruta `/dashboard/personal/recurring` (Gastos fijos: lista, próximos pagos, diálogo de gasto fijo) y `/dashboard/personal/budgets` solo para Presupuestos.
  - En `SITE.navigation.personal`, dos ítems: **Gastos fijos** primero y **Presupuestos** después, en el aside de escritorio y móvil. Se agrega `SITE.routes` para la nueva ruta y se actualiza `sitemap.ts`/`robots` si aplica (ya bloqueado bajo `/dashboard/`).
  - `/dashboard/personal/budgets?tab=recurring` redirige a `/dashboard/personal/recurring` (compatibilidad con enlaces antiguos, recomendaciones y notificaciones).
  - **Móvil:** la barra inferior mantiene una sola entrada (Presupuestos, de SPEC 20) que abre la pantalla combinada con tabs **Gastos fijos | Presupuestos**, y el tab por defecto es **Gastos fijos**. Es un `BudgetsTabs` reorganizado: el orden de tabs pasa a `["recurring", "budgets"]` y `parseBudgetsTab` cae por defecto a `recurring`.
    - La pantalla combinada es una sola pieza reutilizable (`BudgetsAndRecurringTabs`) que escritorio no usa (allí son dos páginas).
    - **Implementación:** cada tab es su propia ruta (`/recurring` y `/budgets`), no un `?tab=` sobre `/recurring`; el selector aparece en las dos pantallas y la entrada de la barra inferior se marca activa en ambas. `parseBudgetsTab` se eliminó por innecesario (el tab sale de la ruta).
    - Aclaración de rutas: la entrada de la barra inferior apunta a `/dashboard/personal/recurring` en móvil y esa pantalla muestra los dos tabs; en `≥ 768 px` el tab de arriba se oculta y el aside separa las dos pantallas.
  - Revisar los enlaces internos (`/dashboard/personal/budgets` con `tab`) y los textos de ayuda (`src/config/help.ts`).
- Documentar en `docs/producto.md` y `docs/ui.md` (tema claro, navegación); anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Rediseño de la landing o de la estructura/layout del modo oscuro (solo se refinan tokens y elevación).
- Cambios de datos de gastos fijos o presupuestos.
- Un tema claro/oscuro por espacio o selector de acento por usuario.
- Tablas, menús de acción y barra inferior (SPEC 20).

## Modelo de datos

No introduce datos nuevos ni migraciones. Cambia configuración de navegación (`SITE.navigation.personal`, `SITE.navigation.mobile.personal`, `SITE.routes`), rutas de `app/` y tokens de `globals.css`.

## Plan de implementación

1. **Auditoría del modo claro.** Ejecutar Impeccable `critique` y `audit` sobre Resumen, Movimientos, Cuentas y Presupuestos en claro; anotar los hallazgos en `docs/ui.md`.
2. **Tokens de claro.** Ajustar fondo, superficies, sombras en capas, primario por espacio y colores de estado/gráficas; verificar AA; ejecutar `polish`.
3. **Componentes con sombra propia.** Revisar `surface.ts`, `StatCard`, `ChartCard` y diálogos para que usen las sombras nuevas sin bordes.
4. **Nueva ruta de Gastos fijos.** Crear `app/dashboard/personal/recurring/page.tsx` con el contenido del tab actual (`buildMetadata`, `noindex` si aplica, sin `<h1>`).
5. **Presupuestos solo presupuestos.** Quitar el tab de la página de Presupuestos en escritorio y redirigir `?tab=recurring` a la nueva ruta.
6. **Navegación.** `SITE.navigation.personal` con Gastos fijos antes de Presupuestos (ícono propio, por ejemplo `CalendarClock`); revisar `nav.ts` (`isActive`) para que las dos rutas no se marquen activas a la vez.
7. **Móvil.** Tabs **Gastos fijos | Presupuestos** con Gastos fijos por defecto en la pantalla a la que apunta la barra inferior; en escritorio se oculta el tab.
8. **Revisión de enlaces y ayudas.** Buscar usos de `BUDGETS_PATH` y `?tab=` y actualizar.
9. **Docs y CHANGELOG.**
10. **Auditoría del modo oscuro.** `critique` y `audit` sobre Resumen, Movimientos, Cuentas y Presupuestos en oscuro; anotar los hallazgos en `docs/ui.md`.
11. **Tokens de oscuro.** Fondo más profundo, superficies escalonadas, elevación sutil (brillo superior / sombra de overlay) y ajustes de color; verificar AA en ambos temas; `polish`.
12. **Componentes en oscuro.** Revisar `surface.ts`, `StatCard`, `ChartCard`, diálogos, menús y campos con los tokens nuevos; sin bordes.
13. **Docs y CHANGELOG del oscuro.** `docs/ui.md` (tema oscuro, contraste), `docs/producto.md` y `[Unreleased]`.
14. **Verificación final.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] En claro, tarjetas y superficies se ven sin borde, con sombra sutil en capas y fondo suave; el resultado se revisa pantalla por pantalla (Resumen, Movimientos, Cuentas, Presupuestos, Reportes). _(revisión visual pendiente)_
- [x] Todos los pares texto/fondo nuevos o cambiados dan AA (4.5:1 texto, 3:1 gráficos y foco) en claro y oscuro; la tabla de `docs/ui.md` queda actualizada.
- [ ] El modo oscuro no tiene regresiones visibles (comparación antes/después de las mismas pantallas). _(revisión visual pendiente; los tokens oscuros no cambian)_
- [x] El aside de Personal muestra **Gastos fijos** antes de **Presupuestos** en escritorio y en el Drawer móvil.
- [x] `/dashboard/personal/recurring` muestra Gastos fijos y `/dashboard/personal/budgets` solo Presupuestos en escritorio.
- [x] `/dashboard/personal/budgets?tab=recurring` redirige a `/dashboard/personal/recurring`.
- [x] En móvil, la entrada de la barra inferior abre una pantalla con tabs **Gastos fijos | Presupuestos** y **Gastos fijos** es el tab por defecto.
- [x] Las dos rutas no se marcan activas a la vez en el aside ni en la barra inferior.
- [x] Ningún enlace interno, recomendación o ayuda apunta a la ruta/tab antiguos.
- [x] Un solo título por pantalla desde el header; controles de 44 px o más en móvil.
- [x] `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [x] `docs/producto.md`, `docs/ui.md` y `[Unreleased]` (en inglés) documentan el cambio.
- [ ] En oscuro, el fondo es más profundo y las tarjetas y niveles se separan mejor, sin bordes y sin desviarse del lenguaje del claro; se revisa pantalla por pantalla. _(revisión visual pendiente)_
- [x] Los pares texto/fondo nuevos o cambiados del oscuro dan AA y la tabla de `docs/ui.md` queda actualizada.
- [x] El claro no tiene regresiones por los cambios del oscuro: los pasos 11 y 12 solo tocan `.dark` y `themeColor`, y el diff del claro no cambia.
- [x] Los pasos 10 a 13 están documentados y la verificación final del paso 14 pasa.

## Decisiones

- **Sí:** Gastos fijos primero en el aside y por defecto en móvil (decisión del usuario): es lo que más se usa y el presupuesto es informativo.
- **Sí:** mantener el tab en móvil con una sola entrada en la barra inferior, para no quitar otro destino a la barra (la barra ya cedió Metas a Cuentas en SPEC 20).
- **Sí:** redirección de las URL antiguas. Motivo: recomendaciones y marcadores existentes siguen funcionando.
- **Sí:** el modo claro se refina con tokens y sombras, no con rediseño de estructura. Motivo: el pedido es "más minimal y elegante", no cambiar el layout.
- **Sí:** reabrir este spec para el modo oscuro (decisión del usuario, tras aprobar el claro). Motivo: un solo PR y un tema coherente; el oscuro hereda el lenguaje del claro (sin bordes, mismo primario).
- **Sí:** el oscuro se refina con tokens y elevación sutil, no con rediseño de estructura. Motivo: "más interesante" sin salirse del diseño del claro.
- **No:** introducir bordes en claro para compensar. Rompe la guía de superficies sin borde del proyecto.
- **Descartado:** dejar el tab también en escritorio. El usuario pidió separarlos en el sidebar.

## Riesgos

- **Tokens compartidos entre temas:** un cambio en claro puede alterar el oscuro; revisar capturas de ambos.
- **Sombras sobre tarjetas anidadas:** pueden acumularse y ensuciar; limitar sombras a un nivel de elevación.
- **Redirecciones y `typedRoutes`:** la nueva ruta debe existir antes de usarla en `Link`; correr `pnpm next typegen` antes de `check`.
- **Oscuro más negro vs legibilidad:** un fondo muy negro puede hacer vibrar el primario y fatigar; revisar AA y comodidad de lectura, no solo el contraste numérico.
- **Elevación en oscuro:** las sombras casi no se ven sobre negro; un brillo superior excesivo ensucia. Medir en capturas y limitar a un nivel.
- **Estado activo del aside:** si `isActive` compara por prefijo, `/budgets` y `/recurring` no colisionan, pero conviene probarlo.
