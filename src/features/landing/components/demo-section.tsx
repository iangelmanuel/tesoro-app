import { DemoPlayer } from "./demo-player"
import { SectionHeading } from "./section-heading"

// Demo en video justo después del hero (SPEC 24): la app real grabada, con
// datos de ejemplo.
export function DemoSection() {
  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className="scroll-mt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-20 sm:px-6 sm:pb-24">
        <SectionHeading
          id="demo-title"
          title="Así se ven tus finanzas en orden"
          description="Un minuto por la app real: tu mes, tus presupuestos, tus metas, tus deudas y tu negocio. Con datos de ejemplo."
        />
        <DemoPlayer />
      </div>
    </section>
  )
}
