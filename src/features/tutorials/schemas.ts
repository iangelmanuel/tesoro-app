import { z } from "zod"
import { TUTORIAL_SECTIONS } from "@/config/tutorials"

/** Sección con tutorial guiado */
export const tutorialSectionSchema = z.enum(TUTORIAL_SECTIONS)
