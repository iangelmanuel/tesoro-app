import { type ComponentType, lazy } from "react"

/**
 * Componente diferido con precarga (SPEC 56b). `Component` va dentro de un
 * `Suspense`; `preload` se llama en `onPointerEnter` / `onFocus` del
 * disparador para que, al abrir, el chunk ya esté. La descarga es una sola
 * y la comparten los dos; si falla (red caída), se olvida para que el
 * siguiente intento la pida de nuevo.
 *
 * ```tsx
 * const Form = lazyWithPreload(() =>
 *   import("./transaction-form").then((m) => m.TransactionForm)
 * )
 * ```
 */
export function lazyWithPreload<P extends object>(
  load: () => Promise<ComponentType<P>>
) {
  let promise: Promise<{ default: ComponentType<P> }> | undefined

  function get() {
    promise ??= load()
      .then((component) => ({ default: component }))
      .catch((error: unknown) => {
        promise = undefined
        throw error
      })
    return promise
  }

  return {
    Component: lazy(get),
    preload() {
      get().catch(() => {})
    }
  }
}
