import { SITE } from "@/config/site"
import { cn } from "@/libs/utils"

type LogoProps = {
  variant?: "full" | "mark"
  size?: "default" | "lg"
  className?: string
}

const SIZES = {
  default: { mark: "size-7", wordmark: "text-xl" },
  lg: { mark: "size-8", wordmark: "text-2xl" }
}

// Isotipo de assets/brand/mark.svg con el acento de --income, para que
// siga al tema. Si cambia el SVG fuente, se actualiza aquí también
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect
        width="64"
        height="64"
        rx="14"
        fill="var(--income)"
      />
      <path
        d="M14 30v-4a12 12 0 0 1 12-12h12a12 12 0 0 1 12 12v4z"
        fill="#fff"
      />
      <rect
        x="14"
        y="33"
        width="36"
        height="17"
        rx="3"
        fill="#fff"
      />
      <rect
        x="27"
        y="25"
        width="10"
        height="12"
        rx="2.5"
        fill="#fff"
        stroke="var(--income)"
        strokeWidth="2"
      />
      <circle
        cx="32"
        cy="30.5"
        r="1.75"
        fill="var(--income)"
      />
    </svg>
  )
}

export function Logo({
  variant = "full",
  size = "default",
  className
}: LogoProps) {
  const sizes = SIZES[size]

  if (variant === "mark") {
    return (
      <span className={cn("inline-flex", className)}>
        <LogoMark className={sizes.mark} />
        <span className="sr-only">{SITE.info.name}</span>
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={sizes.mark} />
      <span className={cn("font-semibold tracking-tight", sizes.wordmark)}>
        {SITE.info.name}
      </span>
    </span>
  )
}
