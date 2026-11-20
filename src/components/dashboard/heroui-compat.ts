// Convivencia de los paneles de Base UI (Sheet) con HeroUI, hasta SPEC 53.
// Dentro de un panel hay menús y diálogos de HeroUI que se montan fuera de
// él. Un panel modal de Base UI les quitaría el foco y los volvería inertes,
// así que esos paneles van con `modal={false}` y este filtro decide qué
// cierres son del panel: el clic en su fondo, Escape dentro de él y su botón
// Cerrar. Un clic, el foco o un Escape dentro de un overlay de HeroUI no lo
// cierran. Se borra junto con heroui-bridge.css

/** Si un cierre de Base UI (reason + event) viene del propio panel */
export function closesFromSheet(reason: string, event: Event | undefined) {
  if (reason === "focus-out") {
    return false
  }
  const target = event?.target
  if (!(target instanceof Element)) {
    return true
  }
  if (reason === "outside-press") {
    return target.closest("[data-slot=sheet-overlay]") !== null
  }
  if (reason === "escape-key") {
    return (
      target.closest("[data-slot=sheet-content]") !== null ||
      target === document.body
    )
  }
  return true
}

/**
 * Lo mismo para un Dialog de Base UI que aloja controles de HeroUI (el
 * diálogo de movimiento con los tabs de Deuda, Me deben, Meta y Gasto fijo,
 * hasta SPEC 52b): va con `modal={false}` y solo lo cierran su fondo,
 * Escape dentro de él y su botón Cerrar
 */
export function closesFromDialog(reason: string, event: Event | undefined) {
  if (reason === "focus-out") {
    return false
  }
  const target = event?.target
  if (!(target instanceof Element)) {
    return true
  }
  if (reason === "outside-press") {
    return target.closest("[data-slot=dialog-overlay]") !== null
  }
  if (reason === "escape-key") {
    return (
      target.closest("[data-slot=dialog-content]") !== null ||
      target === document.body
    )
  }
  return true
}
