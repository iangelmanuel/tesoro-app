import { cn } from "@/libs/cn"

// Bloque de carga. Con prefers-reduced-motion queda estático, sin pulso.
// Los …Skeleton de cada componente usan el mismo contenedor que el
// componente y solo cambian el contenido por estos bloques (SPEC 51 §6)
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "rounded-xl bg-highlight motion-safe:animate-pulse",
        className
      )}
      {...props}
    />
  )
}

/**
 * Región que está cargando: `aria-busy` y un texto solo para lector de
 * pantalla. Envuelve los skeletons de un `loading.tsx` o de un `Suspense`;
 * los skeletons por dentro van ocultos al lector
 */
function LoadingRegion({
  label = "Cargando…",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      data-slot="loading-region"
      aria-busy="true"
      className={className}
      {...props}
    >
      <span
        role="status"
        className="sr-only"
      >
        {label}
      </span>
      {children}
    </div>
  )
}

export { LoadingRegion, Skeleton }
