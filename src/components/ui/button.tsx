import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/libs/cn"

// Botón de Tesoro sobre Base UI (estilo Maia). Pill, 44 px de alto por
// defecto y foco con contorno de 2 px en --ring (≥ 3:1). El primario toma el
// color del espacio por CSS (data-workspace), nunca por props. Hover más
// oscuro: con texto blanco, aclarar bajaría el contraste. Los tamaños
// pequeños e íconos suman un área táctil invisible de 44 px (touch-hitbox)
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,black)]",
        outline:
          "border-border bg-transparent hover:bg-highlight hover:text-foreground aria-expanded:bg-highlight aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-highlight aria-expanded:bg-highlight",
        ghost:
          "hover:bg-highlight hover:text-foreground aria-expanded:bg-highlight aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:outline-destructive dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-foreground underline decoration-2 decoration-[color-mix(in_oklab,var(--ring)_45%,transparent)] underline-offset-4 hover:decoration-ring"
      },
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "touch-hitbox h-7 gap-1 px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "touch-hitbox h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-xs": "touch-hitbox size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "touch-hitbox size-9",
        "icon-lg": "size-12"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
