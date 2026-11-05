import { z } from "zod"
import { TUTORIAL_SECTIONS } from "@/config/tutorials"

export const tutorialSectionSchema = z.enum(TUTORIAL_SECTIONS)
