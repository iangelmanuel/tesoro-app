// Genera el CSV sintético de la línea base de rendimiento (SPEC 56a): unos
// 1.950 movimientos en 12 meses, con categorías, métodos y montos genéricos.
// La semilla es fija: con el mismo mes final, el archivo sale igual.
// Se carga con el asistente de Importar en el espacio Personal de la cuenta
// de pruebas. La salida va a tmp/ (git-ignorado); solo el script se versiona.
//
// Uso: node scripts/generate-perf-csv.mjs [AAAA-MM]
//   AAAA-MM: último mes del rango (por defecto, el mes actual)
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUTPUT = path.join(ROOT, "tmp/perf-movimientos.csv")

const SEED = 56
const MONTHS = 12
// El asistente acepta hasta 2.000 filas (MAX_ROWS); se deja margen
const TARGET_ROWS = 1950

const METHODS = ["Efectivo", "Cuenta de ahorros", "Tarjeta de crédito"]

// [categoría, descripciones, monto mínimo, monto máximo, peso]
const EXPENSES = [
  [
    "Mercado",
    ["Supermercado", "Tienda de barrio", "Plaza de mercado"],
    15_000,
    280_000,
    22
  ],
  [
    "Restaurantes",
    ["Almuerzo", "Café", "Cena", "Domicilio"],
    8_000,
    95_000,
    18
  ],
  [
    "Transporte",
    ["Bus", "Taxi", "Gasolina", "Parqueadero"],
    3_000,
    120_000,
    18
  ],
  ["Servicios", ["Energía", "Agua", "Internet", "Celular"], 35_000, 220_000, 6],
  ["Vivienda", ["Arriendo", "Administración"], 350_000, 1_800_000, 2],
  ["Salud", ["Farmacia", "Consulta", "Exámenes"], 12_000, 250_000, 5],
  [
    "Entretenimiento",
    ["Cine", "Suscripción", "Concierto", "Libro"],
    10_000,
    180_000,
    9
  ],
  ["Compras", ["Ropa", "Hogar", "Tecnología", "Regalo"], 20_000, 650_000, 8],
  ["Educación", ["Curso en línea", "Materiales"], 25_000, 400_000, 3]
]

// [categoría, descripción, monto mínimo, monto máximo, veces al mes]
const INCOMES = [
  ["Salario", "Pago de nómina", 3_800_000, 3_800_000, 2],
  ["Trabajo independiente", "Proyecto", 300_000, 2_500_000, 1],
  ["Otros ingresos", "Reembolso", 20_000, 200_000, 1]
]

/** Generador pseudoaleatorio con semilla (mulberry32) */
function createRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = createRandom(SEED)
const pick = (list) => list[Math.floor(random() * list.length)]
const between = (min, max) => min + random() * (max - min)
// Montos redondeados a centenas, como en un extracto en COP
const amount = (min, max) => Math.round(between(min, max) / 100) * 100

function pickWeighted(list) {
  const total = list.reduce((sum, item) => sum + item[4], 0)
  let roll = random() * total
  for (const item of list) {
    roll -= item[4]
    if (roll <= 0) return item
  }
  return list.at(-1)
}

function parseEndMonth(arg) {
  if (!arg) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const match = /^(\d{4})-(\d{2})$/.exec(arg)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new Error(`Mes inválido: "${arg}". Usa AAAA-MM.`)
  }
  return { year: Number(match[1]), month: Number(match[2]) }
}

function monthsBack({ year, month }, count) {
  const list = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1))
    list.push({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 })
  }
  return list
}

const daysIn = ({ year, month }) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()
const pad = (value) => String(value).padStart(2, "0")
const formatDate = ({ year, month }, day) => `${pad(day)}/${pad(month)}/${year}`

function csvCell(value) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function buildRows(months) {
  const rows = []
  const incomeRows =
    INCOMES.reduce((sum, item) => sum + item[4], 0) * months.length
  const expensesPerMonth = Math.round(
    (TARGET_ROWS - incomeRows) / months.length
  )

  for (const month of months) {
    const days = daysIn(month)

    for (const [category, description, min, max, times] of INCOMES) {
      for (let time = 0; time < times; time++) {
        const day =
          times === 2
            ? time === 0
              ? 15
              : days
            : 1 + Math.floor(random() * days)
        rows.push({
          date: formatDate(month, day),
          sortKey: `${month.year}-${pad(month.month)}-${pad(day)}`,
          description,
          category,
          method: "Cuenta de ahorros",
          type: "Ingreso",
          amount: amount(min, max)
        })
      }
    }

    for (let index = 0; index < expensesPerMonth; index++) {
      const [category, descriptions, min, max] = pickWeighted(EXPENSES)
      const day = 1 + Math.floor(random() * days)
      rows.push({
        date: formatDate(month, day),
        sortKey: `${month.year}-${pad(month.month)}-${pad(day)}`,
        description: pick(descriptions),
        category,
        method: pick(METHODS),
        type: "Gasto",
        amount: amount(min, max)
      })
    }
  }

  return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

async function main() {
  const months = monthsBack(parseEndMonth(process.argv[2]), MONTHS)
  const rows = buildRows(months)

  const header = [
    "Fecha",
    "Descripción",
    "Categoría",
    "Método",
    "Tipo",
    "Monto"
  ]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.date,
        row.description,
        row.category,
        row.method,
        row.type,
        row.amount
      ]
        .map(csvCell)
        .join(",")
    )
  ]

  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${lines.join("\n")}\n`, "utf8")

  const first = months[0]
  const last = months.at(-1)
  console.log(
    `${rows.length} movimientos de ${pad(first.month)}/${first.year} a ${pad(last.month)}/${last.year} → ${path.relative(ROOT, OUTPUT)}`
  )
}

await main()
