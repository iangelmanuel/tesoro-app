import { cacheLife } from "next/cache"
import { SITE } from "@/config/site"

// Estrellas del repositorio para el header de la landing (SPEC 24). Se piden
// en el servidor y se cachean por horas: el navegador nunca llama a GitHub,
// así la landing no hace peticiones externas. Si la API falla o limita, se
// devuelve null y el header muestra solo el logo.
export async function getRepoStars(): Promise<number | null> {
  "use cache"
  cacheLife("hours")

  const repo = new URL(SITE.repository.url).pathname.replace(/^\/|\/$/g, "")

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(4000)
    })
    if (!response.ok) return null
    const data = (await response.json()) as { stargazers_count?: unknown }
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null
  } catch {
    return null
  }
}
