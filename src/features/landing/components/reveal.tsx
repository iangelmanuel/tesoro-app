// Revelado de la landing (SPEC 24): marcado sin JS de React. Los elementos
// llevan `data-reveal` y `reveal-observer.tsx` (un único IntersectionObserver)
// marca con `data-pending` los que arrancan fuera de pantalla y quita la marca
// al entrar, una sola vez. La animación es CSS en globals.css (una curva
// expo.out, 0,7 s y subida de 24 px; las listas escalonan 80 ms por ítem). Sin
// JS o con reduced motion todo se ve en su estado final. Motion queda solo para
// lo interactivo (reproductor, recorrido de funciones), con sus funciones
// cargadas aparte.

type RevealProps = {
  children: React.ReactNode
  className?: string
}

const join = (...classes: (string | undefined)[]) =>
  classes.filter(Boolean).join(" ")

export function Reveal({ children, className }: RevealProps) {
  return (
    <div
      className={className}
      data-reveal=""
    >
      {children}
    </div>
  )
}

// Lista cuyos `RevealItem` entran escalonados
export function RevealList({
  children,
  className,
  as = "ul"
}: RevealProps & { as?: "ul" | "ol" }) {
  const Tag = as
  return (
    <Tag
      className={className}
      data-reveal-list=""
    >
      {children}
    </Tag>
  )
}

export function RevealItem({ children, className }: RevealProps) {
  return (
    <li
      className={className}
      data-reveal-item=""
    >
      {children}
    </li>
  )
}

// Cortina ligada al scroll (animation-timeline: view()): descubre su contenido
// de izquierda a derecha sin deformarlo, así las proporciones nunca mienten
export function ScrollWipe({ children, className }: RevealProps) {
  return <div className={join("scroll-wipe", className)}>{children}</div>
}

// Contenedor que se acomoda con el scroll: de un poco más chico a su tamaño
export function ScrollSettle({ children, className }: RevealProps) {
  return <div className={join("scroll-settle", className)}>{children}</div>
}
