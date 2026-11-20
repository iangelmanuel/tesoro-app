"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/libs/cn"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-4xl text-sm font-medium whitespace-nowrap transition-colors outline-none cursor-pointer hover:bg-highlight hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-pressed:bg-highlight aria-pressed:text-foreground data-pressed:bg-highlight [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border bg-transparent hover:bg-highlight"
      },
      size: {
        default:
          "h-11 min-w-11 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "touch-hitbox h-9 min-w-9 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-12 min-w-12 px-5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
