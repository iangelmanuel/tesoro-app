import { JsonLd } from "@/components/seo/JsonLd"
import { SITE } from "@/config/site"
import { AgentsSection } from "@/features/landing/components/agents-section"
import { DemoSection } from "@/features/landing/components/demo-section"
import { Features } from "@/features/landing/components/features"
import { FinalCta } from "@/features/landing/components/final-cta"
import { Hero } from "@/features/landing/components/hero"
import { MotionProvider } from "@/features/landing/components/motion-provider"
import { OpenSource } from "@/features/landing/components/open-source"
import { RevealObserver } from "@/features/landing/components/reveal-observer"
import { ScoreSection } from "@/features/landing/components/score-section"
import { WorkspacesSection } from "@/features/landing/components/workspaces-section"
import { buildMetadata, buildVideoSchema } from "@/libs/seo"

export const metadata = buildMetadata({
  fullTitle: SITE.seo.title,
  path: "/"
})

export default function HomePage() {
  return (
    <MotionProvider>
      <RevealObserver />
      <main>
        <JsonLd schema={buildVideoSchema()} />
        <Hero />
        <DemoSection />
        <Features />
        <ScoreSection />
        <AgentsSection />
        <WorkspacesSection />
        <OpenSource />
        <FinalCta />
      </main>
    </MotionProvider>
  )
}
