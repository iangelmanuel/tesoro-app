import {
  Baby,
  Banknote,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Coins,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  type LucideIcon,
  Megaphone,
  Package,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  Smartphone,
  Store,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  Wrench,
  Zap
} from "lucide-react"

// Set curado de iconos: la BD guarda la clave y la UI resuelve el componente
// sin imports dinámicos. Las claves de la semilla del sistema deben existir.
export const CATEGORY_ICONS = {
  "home": House,
  "utensils": Utensils,
  "car": Car,
  "bus": Bus,
  "fuel": Fuel,
  "briefcase": Briefcase,
  "laptop": Laptop,
  "coins": Coins,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  "landmark": Landmark,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  "gamepad": Gamepad2,
  "shopping-bag": ShoppingBag,
  "shirt": Shirt,
  "receipt": Receipt,
  "zap": Zap,
  "smartphone": Smartphone,
  "wrench": Wrench,
  "coffee": Coffee,
  "plane": Plane,
  "gift": Gift,
  "baby": Baby,
  "paw-print": PawPrint,
  "dumbbell": Dumbbell,
  "tag": Tag,
  "banknote": Banknote,
  "wallet": Wallet,
  "store": Store,
  "package": Package,
  "users": Users,
  "megaphone": Megaphone
} as const satisfies Record<string, LucideIcon>

// Paleta fija con variante dark, legible en claro y oscuro. Las clases van
// completas para que Tailwind las detecte.
export const CATEGORY_COLORS = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  lime: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  orange:
    "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  indigo:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
} as const

export type CategoryIconKey = keyof typeof CATEGORY_ICONS
export type CategoryColorKey = keyof typeof CATEGORY_COLORS

// Color de cada categoría en las gráficas. Las variables cambian por tema en
// globals.css (tono 500 en claro, 400 en oscuro) y coinciden con el badge.
export const CATEGORY_CHART_COLORS = {
  emerald: "var(--category-emerald)",
  teal: "var(--category-teal)",
  lime: "var(--category-lime)",
  amber: "var(--category-amber)",
  orange: "var(--category-orange)",
  rose: "var(--category-rose)",
  pink: "var(--category-pink)",
  violet: "var(--category-violet)",
  indigo: "var(--category-indigo)",
  blue: "var(--category-blue)",
  sky: "var(--category-sky)",
  slate: "var(--category-slate)"
} as const satisfies Record<CategoryColorKey, string>

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as [
  CategoryIconKey,
  ...CategoryIconKey[]
]
export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS) as [
  CategoryColorKey,
  ...CategoryColorKey[]
]

export const TRANSACTION_TYPES = ["income", "expense"] as const
