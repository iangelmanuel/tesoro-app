# SPEC 53 — Empresa, cuenta, auth y públicas en shadcn, y retiro de HeroUI

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 09, SPEC 10, SPEC 11, SPEC 12, SPEC 22, SPEC 34, SPEC 40, SPEC 50, SPEC 51, SPEC 52a, SPEC 52b, SPEC 52c
> **Fecha:** 2026-11-20
> **Objetivo:** Migrar a shadcn (Base UI) todo lo que aún usa HeroUI (Empresa, cuenta, auth, OAuth y públicas) y retirar HeroUI y React Aria del proyecto.

## Por qué existe este spec

Es el cierre de la migración que empezó en SPEC 51 y siguió en SPEC 52a, 52b y 52c. Tras 52c, Personal y el shell del dashboard ya no cargan HeroUI. Quedan ~55 archivos y ~6.000 líneas con `@heroui/react`, `react-aria` o `react-aria-components`. Unos 15 de ellos solo importan `cn`.

Lo que el prompt original listaba para SPEC 52 (`DetailSheet` modal, `ExportButton`, `TutorialHelpButton`, `BusinessSwitcher`) y el borrado de `src/components/dashboard/heroui-compat.ts` ya quedaron hechos en 52c. Este spec solo comprueba que siguen así.

Va en un solo spec porque el retiro final exige que todo esté migrado. Partirlo dejaría un PR intermedio con HeroUI aún instalado y sin pantallas que lo justifiquen.

El criterio de cierre es absoluto: **cero imports de `@heroui/*`, `react-aria`, `react-aria-components` y `@internationalized/date` en el repo**, y esos paquetes fuera de `package.json` y del lockfile.

## Alcance

**Entra:**

### 1. Empresa (`app/dashboard/business/**`)

- **Estado vacío** (`app/dashboard/business/page.tsx`): crear empresa con `Button` de `ui/`. `BusinessDeleted` y `RestoreBusinessButton` (toast de sonner).
- **Resumen** (`business/[id]/page.tsx`): `BusinessSummaryCards` con `StatCard` y superficies de `surface.ts`, más las gráficas y listas que ya comparte con Personal.
- **Movimientos** (`business/[id]/transactions/page.tsx`): sale el `Skeleton` de HeroUI. Usa los `…Skeleton` de las piezas compartidas con Personal (`TransactionsTable`, `TransactionsTotals`, `TransactionsFilters`).
- **Cuentas** (`business/[id]/accounts/page.tsx`): sale el `Skeleton` de HeroUI. Usa `AccountsGridSkeleton` y los de las piezas compartidas.
- **Flujo de caja** (`business/[id]/cash-flow/page.tsx`):
  - `CashFlowTable`: `Table` de `ui/` dentro de `ScrollTable`, con `RowContextMenu` por fila (ver §5);
  - `AccountBalancesList`: `cn` de `@/libs/cn`, filas con `RowContextMenu` (ver §5);
  - cada pieza exporta su `…Skeleton`.
- **Ajustes** (`business/[id]/settings/page.tsx`): `BusinessDialog` con `FormDialog` y piezas de `forms/`; `DeleteBusinessDialog` con `AlertDialog` de `ui/`.
- `business/[id]/layout.tsx` y las páginas de Empresa dejan `CardSkeleton`.
- Reportes y Recomendaciones de Empresa ya están en shadcn (52c); solo reciben su `loading.tsx`.

### 2. Cuenta (`app/dashboard/account/**`)

- **General**: `ProfileForm` con `useActionState` + `TextInputField`; `AvatarUploader` con `Avatar` y `Button` de `ui/` y sonner. El correo de solo lectura de la página sale de `TextField` de HeroUI a `Input` de `ui/` con `readOnly` y `FieldLabel`.
- **Preferencias**: `CurrencyForm` con `SelectField`; `TutorialsSettings` con `Button` y `Badge` de `ui/`.
- **Privacidad**: `HideAmountsSwitch` con `Switch` de `ui/`. Misma cookie y mismo comportamiento de SPEC 22.
- **Seguridad**: `PasswordForm` con `useActionState` + `TextInputField`; `DeleteAccountDialog` con `AlertDialog` (o `FormDialog` si pide confirmación escrita, como hoy).
- **Agentes**: `ConnectionsList` (`Select` → `SelectField`, revocar con `AlertDialog`), `OperationsList` (`Chip` → `Badge`, revertir con `Button`), `McpUrlField` (`Input` de `ui/` de solo lectura) y `CopyButton` (`Button` de `ui/` y sonner). Filas con `RowContextMenu` (ver §5).
- `AccountNav` y `AccountSection` con `cn` de `@/libs/cn`.
- Sale `app/dashboard/account/layout.tsx` como montaje del `ToastProvider` de HeroUI. El layout queda solo si aún aporta algo más; si no, se borra.

### 3. Auth, OAuth y `/account-deleted`

- **Sign-in y sign-up** (`app/(auth)/sign-in`, `app/(auth)/sign-up`): solo migración, misma UI y mismo copy.
  - `SignInForm` y `SignUpForm` con `useActionState` + `TextInputField` y `Button` de `ui/`;
  - `src/features/auth/components/form-field.tsx` se borra; sus consumidores pasan a `TextInputField`;
  - `OAuthButtons` con `Button` de `ui/`;
  - mismas actions, esquemas y redirecciones.
- **`/account-deleted`**: `AccountDeletedActions` con `Button` de `ui/` y sonner.
- **Consentimiento OAuth** (`app/oauth/consent/page.tsx`): `ConsentForm` con `Tabs` y `Button` de `ui/`. Mismo flujo de aprobar y rechazar del servidor OAuth de Supabase.

### 4. Públicas en claro (`app/(public)/**`)

Solo migración: misma UI, mismo copy, mismo tema claro forzado (SPEC 40).

- **Header y footer públicos**: `SiteHeaderSession` con `buttonVariants` de `ui/`; `GithubStars` con `cn` de `@/libs/cn`.
- **Menú móvil**: `MobileNavDrawer` deja el `Drawer` de HeroUI y usa el `Sheet` o el `Drawer` de `ui/` (el mismo que la hoja móvil del dashboard), modal, con foco atrapado y Escape.
- **Landing**: `Hero`, `FinalCta`, `AgentsSection`, `ScoreVisual` y `SectionHeading` con `buttonVariants` de `ui/` y `cn` de `@/libs/cn`.
- **Legales** (`legal/[slug]`): se revisan; no importan HeroUI hoy.
- **`/mcp`** (`app/(public)/mcp/page.tsx`): `buttonVariants` de `ui/`; `ClientGuides` con `Tabs` de `ui/`; `AgentClients`, `AgentDemoVideo` y `CopyButton` sin HeroUI.
- `src/components/brand/ai-logos.tsx` con `cn` de `@/libs/cn`.
- **Logo de SPEC 50**: el header, el footer y el menú móvil usan `Logo` de `src/components/brand/logo`. Se comprueba, no se cambia.

### 5. Menú contextual de fila (`RowContextMenu`)

Con la misma lista de acciones que `RowActions` (clic derecho y pulsación larga):

- **Agentes / Conexiones**: "Revocar conexión" (destructiva, con la misma confirmación que el botón).
- **Agentes / Operaciones**: "Revertir operación" (misma action `undo` que el botón; deshabilitada si ya se revirtió o expiró).
- **Flujo de caja / tabla por mes**, solo navegación a Movimientos de Empresa con filtros de `src/features/transactions/filters.ts`:
  - "Ver movimientos del mes" (`?month=YYYY-MM`);
  - "Ver entradas del mes" (`?month=YYYY-MM&type=income`);
  - "Ver salidas del mes" (`?month=YYYY-MM&type=expense`).
- **Flujo de caja / Saldos de cuentas**, solo navegación:
  - "Ver movimientos de la cuenta" (Movimientos de Empresa con `?account=<id>`);
  - "Ir a Cuentas" (lista de Cuentas de Empresa; no hay parámetro para abrir el detalle).
- Los valores exactos de `type` y el formato de `month` se toman de `filters.ts`, no se inventan.

### 6. Retiro de HeroUI y React Aria

- Salen de `package.json` y del lockfile: `@heroui/react`, `@heroui/styles`, `react-aria`, `react-aria-components` y `@internationalized/date`.
- `src/styles/globals.css`: sale `@import "@heroui/styles"` y `@import "./heroui-bridge.css"`. Entra `@import "tw-animate-css"` (ya está en `package.json`) si las animaciones de `ui/` lo necesitan.
- Se borran:
  - `src/styles/heroui-bridge.css`;
  - `src/components/dashboard/heroui-portal-bridge.tsx` (`HeroUIPortalBridge` y `HeroUIPortalHost`);
  - `src/components/dashboard/card-skeleton.tsx` (`CardSkeleton`);
  - `src/features/auth/components/form-field.tsx`.
- `WorkspaceThemeRoot`: salen `I18nProvider`, `UNSAFE_PortalProvider` y `HeroUIPortalHost`. Queda `PortalContainerProvider`.
- `FieldLabel`: sale el `LabelContext` / `useSlottedContext` de `react-aria-components` y el envoltorio `HeroUIPortalBridge`. Los campos de `forms/`, `SelectField` y `FormDialog` dejan el puente.
- `ToastProvider` de HeroUI: sale de `app/dashboard/business/layout.tsx` y `app/dashboard/account/layout.tsx`. Si esos layouts quedan vacíos, se borran.
- `src/libs/cn.ts`: sale el comentario que menciona `@heroui/react`.
- Comentarios del código que mencionan HeroUI o "hasta SPEC 53" se reescriben o se quitan (por ejemplo el de `app/dashboard/layout.tsx` sobre React Aria y los toasts).
- Se comprueba que siguen hechos: `heroui-compat.ts` no existe y ningún `Sheet` (aside móvil, `DetailSheet`) pasa `modal={false}`.

### 7. Reglas comunes (iguales a SPEC 52c §6)

- Mismas server actions, esquemas, consultas, Route Handlers y servicios del MCP. No cambian `actions.ts`, `schemas.ts`, `queries.ts`, `app/api/**` ni `src/features/mcp/tools/**`.
- Campos con las piezas de `src/components/forms/` y `src/components/ui/`; errores del servidor con `aria-invalid` + `aria-describedby`.
- Diálogos con `FormDialog`; confirmaciones con `AlertDialog`.
- Botones con `onClick` / `disabled`; ningún archivo usa `onPress` / `isDisabled`.
- Toasts con `toast` de `@/components/ui/sonner`; errores con `toast.error`. El `Toaster` de sonner se monta en los layouts de auth y OAuth si sus pantallas lanzan toasts.
- Listas y tarjetas con `surface.ts`; KPIs con `StatCard`; vacíos con `EmptyState` / `CardEmpty`; estados con `tone.ts`.
- **Skeletons (SPEC 51 §6):** cada componente que carga datos exporta su `…Skeleton` en el mismo archivo y con el mismo contenedor.
- **`loading.tsx`** nuevo en cada ruta de Empresa y de Cuenta, dentro de `LoadingRegion` y compuesto con los skeletons de su pantalla:
  - `app/dashboard/business/`;
  - `business/[id]/` (Resumen), `transactions/`, `accounts/`, `cash-flow/`, `reports/`, `recommendations/` y `settings/`;
  - `account/general/`, `preferences/`, `privacy/`, `security/` y `agents/`.
- **Tours:** los `data-tour` que hoy existen en el DOM de estas pantallas (por ejemplo `aside-workspaces`) siguen existiendo.
- **Accesibilidad (SPEC 51):** AA en claro y oscuro, foco con `outline-ring`, 44 × 44 px de área táctil, `Amount` leído completo, reflujo sin scroll horizontal a 320 px y a 200 % de zoom, `prefers-reduced-motion`, foco atrapado en diálogos, Sheets y menú móvil público.
- **Impeccable:** `/impeccable audit` y `polish` de Empresa (cada pantalla), Cuenta (cada sección), sign-in, sign-up, consentimiento OAuth, `/account-deleted`, landing, legales y `/mcp`, en claro, oscuro (donde aplica), móvil, tablet y escritorio.
  - Los hallazgos dentro de la dirección "Señalética" de SPEC 51 se corrigen directo.
  - Un cambio grande de layout o de flujo se lista y se pregunta antes de hacerlo.

### 8. Documentación

- `CLAUDE.md`: sin menciones de HeroUI, React Aria, `HeroUIPortalBridge`, `heroui-bridge.css`, `CardSkeleton` ni "hasta SPEC 53". Las reglas de UI quedan solo con shadcn + Base UI.
- `docs/ui.md`: sin HeroUI; toda la app en shadcn; sale la sección del puente de portales y la tabla de estado de migración queda cerrada.
- `PRODUCT.md`: sin la mención de HeroUI.
- `README.md` (stack) y `docs/producto.md`: sin HeroUI, para que no queden desactualizados.
- `CHANGELOG.md` en `[Unreleased]` (en inglés): migración de Empresa, cuenta, auth y públicas, y retiro de HeroUI y React Aria.

**Fuera de alcance (para otros specs):**

- Re-render de los videos de la landing con la UI y el logo nuevos (spec propio después).
- Rediseño de auth, landing, legales o `/mcp`; solo se migran.
- Tours de Empresa (pedirían ampliar el `check` de `tutorial_progress` con una migración).
- Acciones que escriben desde Flujo de caja (editar o conciliar cuentas, exportar el mes).
- Abrir el detalle de una cuenta por parámetro de URL.
- Cambios en server actions, esquemas Zod, consultas, Route Handlers, servicios del MCP o tablas.
- Pruebas automatizadas en navegador (Playwright, Lighthouse en CI).
- Subir de versión (`package.json`, `SITE.info.version`, `SECURITY.md`).

## Modelo de datos

Este spec no agrega tablas, columnas ni migraciones. Reusa el modelo de SPEC 09, 10, 11, 22 y 34.

Las APIs públicas de los componentes compartidos no cambian:

```ts
// src/features/business/components/business-dialog.tsx — mismas props
// src/features/cash-flow/components/cash-flow-table.tsx — mismas props (+ workspaceId si el menú lo necesita para armar la ruta)
// src/features/cash-flow/components/account-balances-list.tsx — mismas props (+ workspaceId)
// src/components/forms/field-label.tsx — mismas props, sin LabelContext
```

Dependencias que salen de `package.json`:

```json
"@heroui/react", "@heroui/styles", "react-aria", "react-aria-components", "@internationalized/date"
```

## Plan de implementación

1. Reemplazar los imports de solo `cn` por `@/libs/cn` (`ai-logos`, `github-stars`, `account-nav`, `account-balances-list`, `score-visual`, `section-heading`, `agent-clients`, `agent-demo-video`) y quitar el comentario de `src/libs/cn.ts`.
2. Públicas: `SiteHeaderSession`, `Hero`, `FinalCta`, `AgentsSection` y `/mcp` con `buttonVariants` de `ui/`. Comprobar el `Logo` de SPEC 50 en header, footer y menú móvil.
3. Menú móvil público: `MobileNavDrawer` con el `Sheet` o `Drawer` de `ui/`, modal.
4. `/mcp`: `ClientGuides` con `Tabs` de `ui/`; `CopyButton` con `Button` de `ui/` y sonner.
5. Auth: `SignInForm`, `SignUpForm` y `OAuthButtons` con `TextInputField` y `Button` de `ui/`; borrar `form-field.tsx`. Montar el `Toaster` de sonner donde haga falta.
6. `/account-deleted` y consentimiento OAuth (`ConsentForm` con `Tabs` y `Button` de `ui/`).
7. Cuenta / General y Privacidad: `ProfileForm`, `AvatarUploader`, campo de correo y `HideAmountsSwitch`.
8. Cuenta / Preferencias y Seguridad: `CurrencyForm`, `TutorialsSettings`, `PasswordForm` y `DeleteAccountDialog`.
9. Cuenta / Agentes: `McpUrlField`, `ConnectionsList` y `OperationsList`, con `RowContextMenu`.
10. Cuenta: `…Skeleton` de cada sección y `loading.tsx` de cada ruta; sale `CardSkeleton` de sus páginas.
11. Empresa / estado vacío, `BusinessDeleted`, `RestoreBusinessButton` y Ajustes (`BusinessDialog`, `DeleteBusinessDialog`).
12. Empresa / Resumen: `BusinessSummaryCards` con skeletons; `loading.tsx`.
13. Empresa / Movimientos y Cuentas: skeletons compartidos en vez de `Skeleton` de HeroUI y `CardSkeleton`; `loading.tsx`.
14. Empresa / Flujo de caja: `CashFlowTable` con `Table` de `ui/`, `AccountBalancesList`, `RowContextMenu` en ambos y skeletons; `loading.tsx`.
15. Empresa: `loading.tsx` de `business/`, `reports/`, `recommendations/` y `settings/`; `business/[id]/layout.tsx` sin `CardSkeleton`.
16. Quitar el `ToastProvider` de HeroUI de los layouts de Empresa y Cuenta; borrar los layouts que queden vacíos.
17. Puente de portales: `FieldLabel` sin `LabelContext` ni `HeroUIPortalBridge`; campos de `forms/` y `FormDialog` sin el puente; `WorkspaceThemeRoot` sin `I18nProvider`, `UNSAFE_PortalProvider` ni `HeroUIPortalHost`; borrar `heroui-portal-bridge.tsx`.
18. Estilos: quitar `@heroui/styles` y `heroui-bridge.css` de `globals.css`, agregar `tw-animate-css` si hace falta y borrar `heroui-bridge.css`. Revisar en claro y oscuro que ningún token quedó colgando.
19. Borrar `card-skeleton.tsx` y desinstalar `@heroui/react`, `@heroui/styles`, `react-aria`, `react-aria-components` y `@internationalized/date` con pnpm 12.16.1 (lockfile sincronizado).
20. Limpiar comentarios que mencionan HeroUI o "hasta SPEC 53" en el código.
21. `/impeccable audit` y `polish` de todas las pantallas de §1–§4; corregir.
22. Documentación (`CLAUDE.md`, `docs/ui.md`, `PRODUCT.md`, `README.md`, `docs/producto.md`, `CHANGELOG.md`).

## Criterios de aceptación

Verificables en código o con `check`, `eslint`, `prettier:check` y `build`:

- [ ] `grep -rE "@heroui|react-aria|@internationalized/date" src app` no devuelve resultados.
- [ ] `package.json` y `pnpm-lock.yaml` no contienen `@heroui/react`, `@heroui/styles`, `react-aria`, `react-aria-components` ni `@internationalized/date` como dependencia directa.
- [ ] No existen `src/styles/heroui-bridge.css`, `src/components/dashboard/heroui-portal-bridge.tsx`, `src/components/dashboard/card-skeleton.tsx`, `src/components/dashboard/heroui-compat.ts` ni `src/features/auth/components/form-field.tsx`.
- [ ] `src/styles/globals.css` no importa `@heroui/styles` ni `heroui-bridge.css`.
- [ ] Ningún layout monta `ToastProvider` de HeroUI.
- [ ] `WorkspaceThemeRoot` no usa `I18nProvider`, `UNSAFE_PortalProvider` ni `HeroUIPortalHost`.
- [ ] `FieldLabel` no importa `react-aria-components` ni `HeroUIPortalBridge`.
- [ ] `src/libs/cn.ts` no menciona `@heroui/react`.
- [ ] Ningún archivo de `src/` ni `app/` usa `CardSkeleton`, `onPress`, `isDisabled` ni `modal={false}`.
- [ ] Cada componente migrado que carga datos exporta su `…Skeleton` en el mismo archivo.
- [ ] Existe `loading.tsx` con `LoadingRegion` en `business/`, `business/[id]/`, `business/[id]/{transactions,accounts,cash-flow,reports,recommendations,settings}/` y `account/{general,preferences,privacy,security,agents}/`.
- [ ] `CashFlowTable`, `AccountBalancesList`, `ConnectionsList` y `OperationsList` usan `RowContextMenu` con las acciones de §5.
- [ ] Los enlaces de los menús de Flujo de caja usan los parámetros que lee `src/features/transactions/filters.ts`.
- [ ] `actions.ts`, `schemas.ts`, `queries.ts`, `app/api/**` y `src/features/mcp/tools/**` no cambian.
- [ ] `CLAUDE.md`, `docs/ui.md`, `PRODUCT.md`, `README.md` y `docs/producto.md` no mencionan HeroUI ni React Aria.
- [ ] `CHANGELOG.md` tiene la entrada en `[Unreleased]`.
- [ ] Todo par texto/fondo nuevo queda en la tabla de contraste de `docs/ui.md` y pasa AA en claro y oscuro.
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan, con el lockfile sincronizado (`pnpm install --frozen-lockfile`).

Verificables en navegador (los prueba el usuario a mano):

- [ ] Sin empresa, el estado vacío invita a crearla y el diálogo la crea.
- [ ] Una empresa marcada para borrar muestra su aviso y "Restaurar" la recupera, con toast de sonner.
- [ ] Resumen, Movimientos, Cuentas, Flujo de caja, Reportes, Recomendaciones y Ajustes de Empresa se ven y funcionan como antes, con primario naranja.
- [ ] Editar y borrar la empresa desde Ajustes funciona con confirmación.
- [ ] En Flujo de caja, clic derecho o pulsación larga en un mes y elegir "Ver salidas del mes" abre Movimientos de Empresa filtrado por ese mes y tipo.
- [ ] En Saldos de cuentas, "Ver movimientos de la cuenta" abre Movimientos filtrado por esa cuenta, e "Ir a Cuentas" abre la lista.
- [ ] En Cuenta, guardar nombre, subir y quitar avatar, cambiar moneda, ocultar montos, cambiar contraseña y reiniciar tutoriales funciona como antes.
- [ ] Borrar la cuenta pide confirmación y lleva a `/account-deleted`, donde las acciones funcionan.
- [ ] En Agentes, copiar la URL del MCP, revocar una conexión y revertir una operación funcionan desde el botón y desde el menú contextual.
- [ ] Sign-in y sign-up con correo y con OAuth funcionan, y un error de Zod del servidor se muestra bajo su campo y el lector lo anuncia.
- [ ] El consentimiento OAuth de un agente aprueba y rechaza como antes.
- [ ] Landing, legales y `/mcp` se ven en claro, con el logo de SPEC 50, igual que antes.
- [ ] El menú móvil público atrapa el foco, Escape lo cierra y sus enlaces navegan.
- [ ] Las pestañas de `/mcp` y del consentimiento se manejan con teclado (flechas, Tab).
- [ ] Ningún overlay de Base UI (select, popover, diálogo) queda detrás de otro ni inerte en ninguna pantalla.
- [ ] Al pasar de skeleton a contenido, el CLS medido con Lighthouse es ≤ 0.05 en las pantallas de Empresa y Cuenta.
- [ ] Todo control interactivo de las pantallas de §1–§4 mide 44 × 44 px o más de área en móvil, tablet y escritorio.
- [ ] Ninguna pantalla de §1–§4 tiene scroll horizontal a 320 px de ancho ni a 200 % de zoom en 1280 px (las tablas se deslizan dentro de `ScrollTable`).
- [ ] `/impeccable audit` de cada pantalla no deja hallazgos críticos ni altos abiertos.

## Decisiones

- **Sí:** un solo SPEC 53. El retiro de HeroUI exige que todo esté migrado; partirlo dejaría un PR intermedio sin cierre real. ~6.000 líneas, parecido a 52c.
- **No:** 53a + 53b. Más coordinación sin reducir riesgo.
- **Sí:** auth, landing, legales y `/mcp` solo se migran (misma UI y copy). **No:** rediseñarlos ahora; suma alcance y riesgo.
- **Sí:** `RowContextMenu` en Agentes (conexiones y operaciones) y en Flujo de caja (tabla por mes y saldos de cuentas).
- **Sí:** en Flujo de caja solo acciones de navegación, con los filtros que Movimientos ya lee. **No:** editar, conciliar ni exportar desde ahí; habría que montar esos diálogos en la página.
- **Sí:** "Ir a Cuentas" lleva a la lista. **No:** abrir el detalle por URL; no existe ese parámetro y sería una función nueva.
- **No:** tours de Empresa. Pedirían ampliar el `check` de `tutorial_progress` con una migración; van en su propio spec.
- **Sí:** retirar también `react-aria-components` (solo lo usa `FieldLabel`) e `I18nProvider` / `UNSAFE_PortalProvider` de `WorkspaceThemeRoot`. Sin HeroUI no tienen consumidores.
- **Sí:** `loading.tsx` en todas las rutas de Empresa y Cuenta. **No:** en auth, OAuth, `/account-deleted` ni públicas; son estáticas o casi.
- **Sí:** borrar `form-field.tsx` de auth; `TextInputField` ya cubre su caso.
- **Sí:** limpiar también `README.md` y `docs/producto.md`, que mencionan HeroUI, aunque el prompt solo nombraba `CLAUDE.md`, `docs/ui.md` y `PRODUCT.md`. Dejarlos dañaría la meta de "sin menciones".
- **Sí:** las piezas de SPEC 52 que el prompt pedía (`DetailSheet` modal, `ExportButton`, `TutorialHelpButton`, `BusinessSwitcher`, `heroui-compat.ts`) solo se comprueban; ya se hicieron en 52c.
- **No:** subir de versión en este spec. Se decide aparte.
- **No:** re-render de los videos de la landing. Spec propio después.
- **Sí:** `/impeccable` corrige directo dentro de la dirección de SPEC 51; los cambios grandes se preguntan.
- **Sí:** los criterios de navegador los verifica el usuario a mano, como en SPEC 51 y 52.

## Riesgos

| Riesgo                                                                               | Mitigación                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Quitar `@heroui/styles` borra estilos base (reset, animaciones) que `ui/` usaba      | Paso 18 revisa en claro y oscuro; `tw-animate-css` entra directo; `globals.css` ya define los tokens de shadcn.            |
| Un token de `heroui-bridge.css` sigue referenciado en alguna clase                   | Buscar las variables del puente en `src/` y `app/` antes de borrarlo; `build` y revisión visual del paso 18.               |
| Quitar `I18nProvider` cambia el formato de fechas o números                          | Las fechas ya salen de `date-fns` con `es` y los montos de `Intl` con `es-CO`; se verifica en Movimientos y Flujo de caja. |
| Quitar el puente de portales deja inerte un overlay que aún se abre dentro de otro   | El puente se quita en el paso 17, después de migrar todos los `Modal` de HeroUI; criterio específico de overlays.          |
| Migrar auth rompe el inicio de sesión                                                | Mismas actions y redirecciones; criterio con correo y OAuth; el paso 5 se prueba antes de seguir.                          |
| Migrar el consentimiento OAuth rompe la conexión de agentes                          | Mismo envío del formulario al servidor OAuth de Supabase; criterio de aprobar y rechazar.                                  |
| El lockfile queda desincronizado y el CI falla                                       | Desinstalar con `pnpm@12.16.1` y correr `pnpm install --frozen-lockfile` antes de cerrar.                                  |
| Queda un import de HeroUI o React Aria sin detectar                                  | Criterio con `grep` sobre `src` y `app`; `build` falla si un paquete desinstalado sigue importado.                         |
| Los enlaces de Flujo de caja usan un formato de filtro distinto al que lee la página | Se toman de `filters.ts`; criterio específico.                                                                             |

## Qué no entra en este spec

- Re-render de los videos de la landing (spec propio).
- Rediseño de auth, landing, legales o `/mcp`.
- Tours de Empresa.
- Editar, conciliar o exportar desde Flujo de caja, y abrir el detalle de una cuenta por URL.
- Cambios en server actions, esquemas, consultas, Route Handlers, servicios del MCP o tablas.
- Pruebas automatizadas en navegador.
- Subir de versión.

Cada uno de esos, si llega, va en su propio spec.
