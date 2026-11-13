# SPEC 40 — Hero tipográfico sin Three.js

> **Estado:** Aprobado
> **Depende de:** SPEC 12, SPEC 24
> **Fecha:** 2026-11-13
> **Objetivo:** Reemplazar la escena 3D y el mockup del hero de la landing por un hero solo de texto, sin Three.js, que se pinte completo y estable en la primera carga.

## Por qué existe este spec

SPEC 24 puso en el hero una escena 3D (React Three Fiber) que se carga después del HTML, con el mockup `hero-visual.tsx` como fallback. En la primera carga se ve el mockup o un hueco y luego salta a la escena: el primer vistazo se ve roto.

El video demo (SPEC 24) ya muestra el producto más abajo. El hero solo tiene que decir qué es Tesoro y llevar al registro. Se quita la escena, el mockup y las dependencias de Three.js.

Es el quinto de cinco specs del mismo pedido (SPEC 36 a 40). El diseño se guía con Impeccable (`PRODUCT.md`, `DESIGN.md`, `.claude/skills/impeccable/`).

## Alcance

**Entra:**

- **Hero solo tipográfico** en `src/features/landing/components/hero.tsx`:
  - una columna, sin visual a la derecha;
  - título (`SITE.info.slogan`), subtítulo, CTA principal (**Crear cuenta** / `SITE.navigation.cta`), CTA secundario **Ver la demo** (`#demo`) y promesas (Gratis, Sin conectar bancos, Código abierto);
  - jerarquía, tamaños, alineación (centrada o a la izquierda), ancho de línea y espacio vertical se definen con `/impeccable shape` sobre el hero antes de escribir código, y se documentan en `DESIGN.md`;
  - el texto de título y subtítulo se puede reescribir en ese paso si Impeccable lo propone; cambios del slogan van en `SITE.info.slogan`;
  - solo tokens existentes (`--accent`, `--brand`, `--income`, `--muted`…); sin gradientes de texto ni efectos decorativos que Impeccable marque como antipatrón;
  - se conserva la entrada escalonada `hero-enter` solo si no causa desplazamiento de layout; respeta `prefers-reduced-motion`.
- **Sin salto en la primera carga:** todo el hero es componente de servidor y se pinta en el HTML inicial. Ningún elemento del hero depende de JavaScript del cliente para su tamaño final.
- **Quitar Three.js:**
  - borrar `hero-scene.tsx`, `hero-scene-loader.tsx` y `hero-visual.tsx`;
  - quitar `three`, `@react-three/fiber` y `@types/three` de `package.json` y sincronizar `pnpm-lock.yaml` (`pnpm install`);
  - quitar cualquier configuración que solo exista para ellos (`next.config.ts`, CSS de la escena en `globals.css`).
- **Móvil (< 768 px):** el hero cabe en la primera pantalla de 390 × 844 con título, subtítulo y CTA principal visibles sin desplazar; CTA de 44 px o más.
- **Documentación:** quitar la escena y el mockup de `docs/producto.md`, `docs/ui.md`, `PRODUCT.md` y `DESIGN.md`, y describir el hero nuevo; `CHANGELOG.md` en `[Unreleased]` (en inglés).

**Fuera de alcance (para otros specs):**

- Cambios en otras secciones de la landing (demo, funciones, score, agentes, código abierto, CTA final).
- Imagen o banner estático en el hero.
- Nuevo video o clip para el hero.
- Cambios en metadata, Open Graph o la imagen OG.
- Rediseño de la navegación de la landing.

## Modelo de datos

Este spec no introduce datos. Solo cambia componentes de la landing, dependencias y documentación.

Archivos:

```text
src/features/landing/components/hero.tsx              (cambia)
src/features/landing/components/hero-scene.tsx        (se borra)
src/features/landing/components/hero-scene-loader.tsx (se borra)
src/features/landing/components/hero-visual.tsx       (se borra)
src/styles/globals.css                                (se limpia si hay estilos de la escena)
package.json, pnpm-lock.yaml                          (sin three, @react-three/fiber, @types/three)
docs/producto.md, docs/ui.md, PRODUCT.md, DESIGN.md   (cambian)
```

## Plan de implementación

1. **Dirección con Impeccable.** Correr `/impeccable shape` sobre el hero con `PRODUCT.md` como contexto. Resultado: jerarquía, alineación, tamaños y textos aprobados por el usuario antes de tocar código.
2. **Hero nuevo.** Reescribir `hero.tsx` en una columna con la dirección del paso 1. Quitar los imports de la escena y el mockup.
3. **Borrar la escena.** Eliminar los tres archivos y estilos asociados. `pnpm remove three @react-three/fiber @types/three`.
4. **Pulido.** `/impeccable polish` y `/impeccable audit` sobre el hero en claro y oscuro, escritorio y 390 px.
5. **Docs y CHANGELOG.**
6. **Verificación.** `pnpm check`, `pnpm eslint`, `pnpm prettier:check`, `pnpm build`; Lighthouse de `/` en móvil.

## Criterios de aceptación

- [ ] `grep -r "three" src app package.json` no encuentra imports ni dependencias de Three.js.
- [ ] `hero-scene.tsx`, `hero-scene-loader.tsx` y `hero-visual.tsx` no existen.
- [ ] El hero no tiene visual a la derecha: solo título, subtítulo, dos CTA y promesas.
- [ ] Con JavaScript deshabilitado, el hero se ve completo e igual que con JavaScript.
- [ ] Lighthouse móvil de `/` da CLS ≤ 0,02 en el hero y ningún cambio visible del hero tras la carga.
- [ ] A 390 × 844, título, subtítulo y CTA principal se ven sin desplazar.
- [ ] Con `prefers-reduced-motion: reduce` no hay animación de entrada.
- [ ] Todo par texto/fondo del hero da AA en claro y oscuro.
- [ ] `pnpm-lock.yaml` está sincronizado (`pnpm install --frozen-lockfile` pasa).
- [ ] `pnpm check`, `pnpm eslint`, `pnpm prettier:check` y `pnpm build` pasan.

## Decisiones

- **Sí:** quitar la escena 3D y Three.js (decisión del usuario). Motivo: el salto en la primera carga se ve mal.
- **Sí:** hero solo tipográfico, sin mockup ni banner (decisión del usuario). El video demo ya muestra el producto.
- **No:** conservar el mockup CSS como visual fijo. Descartado por el usuario.
- **No:** banner o captura estática. Descartado por el usuario.
- **Sí:** dirección visual definida con Impeccable antes de codificar (pedido del usuario).
- **Sí:** hero como componente de servidor. Motivo: se pinta en el HTML inicial y no salta.

## Riesgos

| Riesgo                                                    | Mitigación                                                                                     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| El hero de texto se ve vacío o genérico                   | Paso 1 con `/impeccable shape` y aprobación del usuario; `/impeccable critique` si hace falta. |
| Otro componente importa la escena o Three.js              | `grep` en el paso 3 y `pnpm build` antes de cerrar.                                            |
| La fuente Inter carga tarde y cambia el tamaño del título | Ya se usa `next/font` con `display` adecuado; verificar CLS en Lighthouse.                     |

## Qué **no** entra en este spec

- Otras secciones de la landing.
- Imagen, banner o video en el hero.
- Metadata y OG.
- Lo de SPEC 36 a 39.
