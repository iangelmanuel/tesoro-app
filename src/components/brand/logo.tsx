import { SITE } from "@/config/site"
import { cn } from "@/libs/cn"

type LogoTone = "ink" | "color"

type LogoProps = {
  variant?: "full" | "mark"
  size?: "default" | "lg"
  tone?: LogoTone
  className?: string
}

// Alto del wordmark: su versal mide un 53 % del isotipo, como en
// assets/brand/opengraph.svg
const SIZES = {
  default: { mark: "size-7", wordmark: "h-3.75" },
  lg: { mark: "size-8", wordmark: "h-4.25" }
}

// "ink" toma el color del texto que lo rodea; "color" usa el de marca
const TONES: Record<LogoTone, string> = {
  ink: "currentColor",
  color: "var(--brand)"
}

// Monograma T de assets/brand/mark.svg (SPEC 50). Si cambia el SVG fuente,
// se actualiza aquí también
const MARK_PATHS = ["M8 12h48v12H44v28H32V24H8z", "M20 32h8v20h-8z"]

// Wordmark "Tesoro" en paths (SPEC 50): no depende de la fuente de la UI
const WORDMARK_PATH =
  "M1.69 0H24V4.89H15.67V28H10.03V4.89H1.69ZM32.7 28.41Q29.48 28.41 27.15 27.1Q24.82 25.78 23.57 23.36Q22.32 20.93 22.32 17.61Q22.32 14.36 23.57 11.91Q24.82 9.47 27.09 8.1Q29.35 6.73 32.42 6.73Q35.16 6.73 37.4 7.89Q39.63 9.06 40.96 11.43Q42.28 13.79 42.28 17.38L42.28 18.96L27.91 18.96Q28 21.54 29.33 22.85Q30.67 24.17 32.79 24.17Q34.28 24.17 35.34 23.54Q36.4 22.91 36.85 21.69L41.96 22.64Q41.19 25.26 38.78 26.83Q36.36 28.41 32.7 28.41ZM27.94 15.43L36.85 15.43Q36.64 13.38 35.54 12.18Q34.43 10.97 32.47 10.97Q30.44 10.97 29.28 12.22Q28.11 13.47 27.94 15.43ZM53.73 28.41Q49.93 28.41 47.46 26.8Q44.99 25.18 44.44 22.25L49.69 21.35Q50.49 24.28 53.9 24.28Q55.51 24.28 56.44 23.67Q57.37 23.06 57.37 22.12Q57.37 20.52 54.67 19.96L51.04 19.21Q44.99 17.97 44.99 13.25Q44.99 10.22 47.41 8.48Q49.84 6.73 53.82 6.73Q57.56 6.73 59.78 8.25Q61.99 9.77 62.58 12.33L57.58 13.21Q57.24 12.14 56.34 11.45Q55.44 10.77 53.9 10.77Q52.5 10.77 51.57 11.36Q50.63 11.95 50.63 12.89Q50.63 13.68 51.24 14.23Q51.85 14.79 53.33 15.09L57.11 15.84Q63.12 17.06 63.12 21.52Q63.12 23.58 61.92 25.13Q60.72 26.68 58.59 27.55Q56.47 28.41 53.73 28.41ZM75.39 28.41Q72.24 28.41 69.92 27.05Q67.61 25.69 66.36 23.26Q65.11 20.82 65.11 17.59Q65.11 14.34 66.36 11.9Q67.61 9.45 69.92 8.09Q72.24 6.73 75.39 6.73Q78.55 6.73 80.86 8.09Q83.17 9.45 84.42 11.9Q85.67 14.34 85.67 17.59Q85.67 20.82 84.42 23.26Q83.17 25.69 80.86 27.05Q78.55 28.41 75.39 28.41ZM75.39 23.98Q77.65 23.98 78.79 22.16Q79.94 20.33 79.94 17.57Q79.94 14.79 78.79 12.98Q77.65 11.16 75.39 11.16Q73.14 11.16 72 12.98Q70.86 14.79 70.86 17.57Q70.86 20.33 72 22.16Q73.14 23.98 75.39 23.98ZM88.85 28L88.85 6.99L94.3 6.99L94.3 10.66L94.52 10.66Q95.11 8.72 96.47 7.71Q97.83 6.71 99.6 6.71Q100.56 6.71 101.42 6.9L101.42 11.93Q101.04 11.82 100.32 11.74Q99.6 11.65 98.98 11.65Q97.02 11.65 95.75 12.87Q94.49 14.09 94.49 16.05L94.49 28ZM111.85 28.41Q108.69 28.41 106.38 27.05Q104.07 25.69 102.82 23.26Q101.57 20.82 101.57 17.59Q101.57 14.34 102.82 11.9Q104.07 9.45 106.38 8.09Q108.69 6.73 111.85 6.73Q115.01 6.73 117.32 8.09Q119.63 9.45 120.88 11.9Q122.13 14.34 122.13 17.59Q122.13 20.82 120.88 23.26Q119.63 25.69 117.32 27.05Q115.01 28.41 111.85 28.41ZM111.85 23.98Q114.1 23.98 115.25 22.16Q116.4 20.33 116.4 17.57Q116.4 14.79 115.25 12.98Q114.1 11.16 111.85 11.16Q109.59 11.16 108.46 12.98Q107.32 14.79 107.32 17.57Q107.32 20.33 108.46 22.16Q109.59 23.98 111.85 23.98Z"

export function LogoMark({
  tone = "ink",
  className
}: {
  tone?: LogoTone
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      fill={TONES[tone]}
      className={cn("shrink-0", className)}
    >
      {MARK_PATHS.map((d) => (
        <path
          key={d}
          d={d}
        />
      ))}
    </svg>
  )
}

function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 123.65 28.5"
      aria-hidden="true"
      fill="currentColor"
      className={cn("w-auto shrink-0", className)}
    >
      <path d={WORDMARK_PATH} />
    </svg>
  )
}

export function Logo({
  variant = "full",
  size = "default",
  tone = "ink",
  className
}: LogoProps) {
  const sizes = SIZES[size]

  if (variant === "mark") {
    return (
      <span className={cn("inline-flex", className)}>
        <LogoMark
          tone={tone}
          className={sizes.mark}
        />
        <span className="sr-only">{SITE.info.name}</span>
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <LogoMark
        tone={tone}
        className={sizes.mark}
      />
      <Wordmark className={sizes.wordmark} />
      <span className="sr-only">{SITE.info.name}</span>
    </span>
  )
}
