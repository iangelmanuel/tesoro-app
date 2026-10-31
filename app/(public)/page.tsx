import { SITE } from "@/config/site"
import { Features } from "@/features/landing/components/features"
import { FinalCta } from "@/features/landing/components/final-cta"
import { Hero } from "@/features/landing/components/hero"
import { HowItWorks } from "@/features/landing/components/how-it-works"
import { OpenSource } from "@/features/landing/components/open-source"
import { ScoreSection } from "@/features/landing/components/score-section"
import { WorkspacesSection } from "@/features/landing/components/workspaces-section"
import { buildMetadata } from "@/libs/seo"

export const metadata = buildMetadata({
  fullTitle: SITE.seo.title,
  path: "/"
})

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <ScoreSection />
      <WorkspacesSection />
      <OpenSource />
      <FinalCta />
    </main>
  )
}
