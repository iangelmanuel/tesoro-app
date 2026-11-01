# UI de Tesoro

Guía de diseño del dashboard. Se completa en el paso 17 de
[SPEC 14](../specs/14-ui-polish-with-impeccable.md).

## Impeccable

[Impeccable](https://github.com/pbakaus/impeccable) es el skill de diseño del
proyecto. Vive versionado en `.claude/skills/impeccable/`, con sus subagentes en
`.claude/agents/impeccable-*.md`. No se instala como plugin.

| Pieza | Versión |
| ----- | ------- |
| Skill | 4.8.0   |
| Motor | 0.1.18  |

- El motor es un binario por plataforma. No se versiona
  (`.claude/skills/impeccable/scripts/bin/` está en `.gitignore`): el launcher
  lo descarga la primera vez y lo verifica contra
  `scripts/engine-checksums.txt`.
- La copia versionada difiere del upstream 4.8.0 solo en formato: pasó una vez
  por Prettier antes de excluirla en `.prettierignore`. La lógica es la misma.
  La próxima reinstalación la deja idéntica.
- Para actualizar, reinstala con `npx skills add pbakaus/impeccable`,
  revisa el diff y actualiza esta tabla.

## Contraste

Pares verificados con los tokens de `src/styles/globals.css` (WCAG 2.x,
OKLCH → sRGB). Mínimos: 4.5:1 texto, 3:1 gráficos y foco.

| Par                                     | Claro | Oscuro |
| --------------------------------------- | ----- | ------ |
| `foreground` / `background`             | 16.49 | 18.96  |
| `muted` / `surface`                     | 6.00  | 6.74   |
| `muted` / `default`                     | 4.96  | 5.66   |
| `income` / `surface`                    | 5.56  | 5.03   |
| `expense` / `surface`                   | 5.35  | 5.06   |
| `balance` / `surface`                   | 8.16  | 5.89   |
| `danger` / `background`                 | 5.07  | 6.84   |
| `accent-foreground` / `accent` Personal | 4.84  | 7.19   |
| `accent-foreground` / `accent` Empresa  | 4.94  | 6.13   |
| `accent` / `background` Personal (foco) | 3.41  | 8.03   |
| `accent` / `background` Empresa (foco)  | 3.34  | 6.84   |
| `text-brand` / `background`             | 5.10  | 11.08  |
| `--chart-*` / `surface` (mínimo)        | 4.77  | 3.72   |

Las series de dinero (`--income`, `--expense`, `--balance`) también pasan el
validador de paletas del skill `dataviz` en claro y oscuro: banda de
luminosidad, croma, ΔE ≥ 10 entre todos los pares con protanopía y
deuteranopía, y ΔE ≥ 21 con visión normal. Entre sí casi no difieren en
luminancia, así que las gráficas nunca dependen solo del color: llevan
leyenda, orden fijo de series y el monto en el tooltip y en la tabla
`sr-only`.
