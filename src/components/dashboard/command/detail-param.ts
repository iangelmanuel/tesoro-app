// Abrir el panel de detalle de una entidad desde la paleta de comandos.
// Si la página ya está abierta, la paleta avisa con un evento; si no, navega
// con `?detalle=<id>` y la tarjeta lo lee al montarse (useDetailFromUrl)

/** Parámetro de búsqueda con el id de la entidad a abrir */
export const DETAIL_PARAM = "detalle"

/** Evento de ventana con `{ id }` para abrir un panel ya montado */
export const OPEN_DETAIL_EVENT = "tesoro:open-detail"
