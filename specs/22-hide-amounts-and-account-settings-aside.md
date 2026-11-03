# SPEC 22 — Ocultar cifras con el ojo del header y aside interno de Cuenta

> **Estado:** Aprobado
> **Depende de:** SPEC 09, SPEC 20, SPEC 21
> **Fecha:** 2026-11-03
> **Objetivo:** Que el usuario pueda ocultar saldos y totales con un botón de ojo en el header de todas las páginas, con el estado guardado en la base de datos, y que la sección Cuenta se organice en un aside interno (General, Seguridad, Privacidad, Preferencias).

## Por qué existe este spec

Los bancos reemplazan los números por asteriscos para poder mirar la app en público. Tesoro muestra saldos y totales por todas partes y no tiene forma de ocultarlos. Además, la página de Cuenta es una sola columna con Perfil, Contraseña, Moneda y Borrar cuenta; al añadir privacidad y futuras configuraciones se vuelve difícil de recorrer.

Es el tercero de cuatro specs que salen del mismo pedido (ver SPEC 20). Se agrupan porque el ajuste de privacidad vive en la página de Cuenta y su estado en `profiles`.

## Alcance

**Entra:**

- **Botón del ojo en el header** (`DashboardTitle` / acciones del header), en todas las páginas del dashboard y en Cuenta:
  - Ícono ojo abierto (`Eye`) cuando se ven las cifras y ojo cerrado (`EyeOff`) cuando están ocultas.
  - `aria-pressed` y `aria-label` ("Ocultar cifras" / "Mostrar cifras"), `isIconOnly`, 44 px o más en móvil.
  - Un clic alterna y guarda en la base de datos; el estado aplica a Personal y Empresa y a todos los dispositivos del usuario.
- **Qué se oculta (saldos y totales):**
  - Saldos de cuentas y saldo programado, patrimonio y deuda total.
  - KPIs (`StatCard`) y totales de Movimientos, Resumen, Reportes, Flujo de caja, Presupuestos, Metas y Deudas.
  - Valores de las gráficas: etiquetas, ejes en moneda y tooltips (las formas y proporciones se mantienen).
  - El monto de cada fila de Movimientos **sí se ve**: el usuario necesita registrar y verificar. Los formularios y diálogos de edición siempre muestran el valor real.
- **Máscara:** `***` en lugar del número, con `aria-label="Monto oculto"` para lectores de pantalla y misma anchura reservada para no mover el diseño.
- **Componente `Amount`** (`src/components/dashboard/amount.tsx`): único punto de formato de montos mostrados; lee el estado desde un contexto (`HideAmountsProvider`) y respeta `tabular-nums`.
  - Variante para gráficas: función `formatChartAmount` que devuelve la máscara cuando está oculto (en `src/components/charts/chart-format.ts`).
- **Estado en la base de datos:** columna `profiles.hide_amounts boolean not null default false` (migración versionada). RLS existente de `profiles` ya cubre lectura y actualización del propio perfil.
  - Se lee en el layout del dashboard (dentro de `Suspense`, compatible con `cacheComponents`) y se entrega al `HideAmountsProvider` para que el primer render ya salga oculto, sin parpadeo.
  - Action `setHideAmountsAction` con Zod, que actualiza el perfil del usuario autenticado, con `useOptimistic` para respuesta inmediata.
- **Aside interno de Cuenta** (`/dashboard/account/...`):
  - Subrutas: `/dashboard/account/general` (perfil, avatar, email), `/dashboard/account/security` (contraseña), `/dashboard/account/privacy` (ocultar cifras y, a futuro, sesiones y datos), `/dashboard/account/preferences` (moneda y, a futuro, otros) y una sección de zona peligrosa (borrar cuenta) dentro de **Seguridad**.
  - `/dashboard/account` redirige a `/dashboard/account/general`.
  - Aside de navegación dentro del contenido (lista vertical con ícono y texto), con el ítem activo marcado (`aria-current="page"`). En móvil (`< 768 px`) se muestra como lista horizontal con scroll o selector en la parte superior del contenido.
  - Las secciones reutilizan `AccountSection` y los formularios existentes; solo se reubican.
  - Un solo título por pantalla desde el header; sin `<h1>` repetido. La configuración vive en `SITE` (`SITE.account.sections`) para que añadir una sección sea una línea.
- Documentar en `docs/producto.md` y `docs/ui.md`; anotar en `[Unreleased]` del `CHANGELOG.md` (en inglés).

**Fuera de alcance (para otros specs):**

- Ocultar los montos de cada movimiento en la lista (decisión: se ven).
- Bloqueo con PIN o desenfoque automático al inactivar la sesión.
- Gestión de sesiones, dispositivos y exportación de datos (solo queda el espacio en Privacidad).
- Preferencias nuevas (idioma, formato de fecha, tema por usuario).
- Pulido del modo claro y separación de Presupuestos / Gastos fijos (SPEC 23).

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_profiles_hide_amounts.sql
alter table public.profiles
  add column hide_amounts boolean not null default false;
```

```ts
// SITE
account: {
  sections: [
    { name: "General", href: "/dashboard/account/general", icon: "User" },
    { name: "Seguridad", href: "/dashboard/account/security", icon: "ShieldCheck" },
    { name: "Privacidad", href: "/dashboard/account/privacy", icon: "Eye" },
    { name: "Preferencias", href: "/dashboard/account/preferences", icon: "SlidersHorizontal" }
  ]
}
```

Regenerar `src/types/database.ts` y pasarle Prettier. Sin cambios en RLS (la política de actualización del propio perfil ya existe; verificar que no limite columnas).

## Plan de implementación

1. **Migración y tipos.** `profiles.hide_amounts`, `supabase db push`, regenerar `database.ts` + Prettier.
2. **Estado.** `getAccount` / query del layout devuelven `hideAmounts`; `HideAmountsProvider` y hook `useHideAmounts`; action `setHideAmountsAction`.
3. **`Amount` y `formatChartAmount`.** Crear y probar en un KPI.
4. **Botón del ojo en el header.** Integrarlo en el header del dashboard (incluida la cuenta) con `useOptimistic`.
5. **Aplicar `Amount`** en saldos, KPIs y totales: cuentas, resumen, reportes, flujo de caja, presupuestos, metas y deudas. Un feature por commit.
6. **Gráficas.** Máscara en etiquetas, ejes y tooltips.
7. **Aside de Cuenta.** Layout `app/dashboard/account/layout.tsx` con el aside, subrutas, redirección de `/dashboard/account`, y mover los formularios existentes (perfil, contraseña, moneda, borrar cuenta). Añadir `SITE.account.sections`.
8. **Privacidad.** Pantalla con el interruptor de ocultar cifras (mismo estado que el ojo) y espacio para futuras opciones.
9. **Sitemap y robots.** `robots.ts` ya bloquea `/dashboard/`; confirmar `noindex` en las subrutas.
10. **Docs y CHANGELOG.**
11. **Verificación final.** `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`.

## Criterios de aceptación

- [ ] El ojo aparece en el header de todas las páginas del dashboard y de Cuenta, abierto si se ven las cifras y cerrado si están ocultas.
- [ ] Al pulsarlo, los saldos y totales pasan a `***` de inmediato (sin recargar) y el estado se guarda en `profiles.hide_amounts`.
- [ ] Al recargar o abrir otra sesión, el estado persiste y el primer render ya sale oculto (sin parpadear mostrando números).
- [ ] El estado aplica igual en Personal y en Empresa.
- [ ] Con cifras ocultas: saldos de cuentas, patrimonio, KPIs, totales, presupuestos, metas, deudas y valores de gráficas (etiquetas, ejes, tooltips) muestran la máscara.
- [ ] Con cifras ocultas, el monto de cada fila de Movimientos y los campos de los diálogos de edición siguen visibles.
- [ ] La máscara tiene `aria-label="Monto oculto"` y no deja pasar el número al lector de pantalla.
- [ ] El botón tiene `aria-pressed`, `aria-label` y mide 44 px o más en móvil; contraste AA en claro y oscuro.
- [ ] Un usuario no puede leer ni cambiar `hide_amounts` de otro (RLS y action autenticada).
- [ ] `/dashboard/account` redirige a `/dashboard/account/general`; las cuatro subrutas existen, tienen `noindex` y marcan el ítem activo con `aria-current="page"`.
- [ ] Perfil, contraseña, moneda y borrar cuenta funcionan igual que antes en sus nuevas secciones.
- [ ] En móvil el aside de Cuenta se ve como lista horizontal o selector, con controles de 44 px o más.
- [ ] Añadir una sección nueva solo requiere una entrada en `SITE.account.sections` y su ruta.
- [ ] `pnpm next typegen`, `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.
- [ ] `docs/producto.md`, `docs/ui.md` y `[Unreleased]` (en inglés) documentan el cambio.

## Decisiones

- **Sí:** se ocultan saldos y totales, no el monto de cada movimiento (decisión del usuario). Motivo: se necesita ver y verificar al registrar.
- **Sí:** un solo valor global en `profiles`, no por espacio (decisión del usuario). Motivo: simple y coherente en todas las pantallas.
- **Sí:** `Amount` como único punto de formato, para que ocultar sea un solo cambio y no un `if` en cada componente.
- **Sí:** el estado se resuelve en el servidor y se pasa por contexto, para evitar mostrar números antes de ocultarlos.
- **Sí:** subrutas para el aside de Cuenta (decisión del usuario): cada sección se puede enlazar y cargar por separado.
- **Sí:** Borrar cuenta dentro de Seguridad como zona peligrosa; es el lugar esperado y evita una sección con un solo botón.
- **No:** ocultar con CSS (`blur`) en cliente solamente: el número seguiría en el DOM y llegaría a lectores de pantalla.
- **Descartado:** `localStorage` para el estado. Se perdería entre dispositivos y el usuario pidió la base de datos.

## Riesgos

- **Cobertura incompleta:** un monto formateado sin pasar por `Amount` quedaría visible. Revisar con búsqueda de los formateadores de moneda y tener una lista de pantallas probadas.
- **Gráficas Recharts:** los tooltips y etiquetas se formatean fuera del árbol React normal; hay que enmascarar en las funciones de formato, no solo en los componentes.
- **`cacheComponents`:** leer el perfil en el layout hace dinámica la parte que lo consume; mantener `Suspense` y un esqueleto sin números.
- **Redirección y enlaces antiguos a `/dashboard/account`:** actualizar los enlaces del menú de usuario y comprobar el sitemap/robots.
