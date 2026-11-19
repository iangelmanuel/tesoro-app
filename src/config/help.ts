// Textos de ayuda en contexto (ícono (i) de HelpHint). Una o dos frases en
// tuteo, sin jerga: qué es y cuándo está bien. Se reusan en todas las
// pantallas; si cambia una definición en docs/producto.md, se cambia aquí
export const HELP = {
  score:
    "Un puntaje de 0 a 100 que resume la salud de tus finanzas. Mira tu ahorro, tus deudas, tu colchón, tus presupuestos, tus metas y qué tan seguido registras. Desde 60 es Bueno y desde 80, Excelente.",
  utilization:
    "Cuánto de tu cupo de tarjetas estás usando. Por debajo del 30 % está bien; cerca del 100 % pesa en tu score.",
  savingsRate:
    "La parte de tus ingresos que te quedó después de gastar. Si es negativa, gastaste más de lo que entró. Un 20 % o más es una meta sana.",
  accumulatedBalance:
    "Todo lo que te ha entrado menos todo lo que has gastado desde tu primer registro. No es el saldo de tus cuentas: no cuenta traspasos ni saldos iniciales.",
  maintenanceFee:
    "Lo que el banco le suma cada mes al saldo de tu tarjeta. Tesoro lo registra solo el día de cobro y no toca tus cuentas: lo pagas dentro del pago de la tarjeta.",
  reconciliation:
    "Compara el saldo que ves en tu banco o billetera con el que calcula Tesoro en esa fecha y crea un ajuste por la diferencia. Con una fecha pasada, el saldo de hoy también cambia por los movimientos posteriores.",
  upcomingIncomes:
    "Lo que esperas recibir este mes, más lo que no te llegó en los dos meses anteriores. Atrasado quiere decir que ya pasó el día de pago y no has registrado el ingreso.",
  noFixedDate:
    "Para proyectos o inversiones que pagan cuando pagan. No tienen fechas ni estados: Tesoro suma lo que registras con ellos en el mes y en el año.",
  frequency:
    "Cada cuánto se repite. Tesoro crea un periodo por cada vez (cada mes, cada quincena, cada año…) para que marques si ya se pagó o se recibió.",
  installment:
    "La parte fija que pagas o cobras cada periodo. Al marcar una cuota, Tesoro registra el movimiento y baja el saldo pendiente.",
  multipleReceipts:
    "Un ingreso puede llegarte en varias partes. Cada movimiento que registras suma a su periodo hasta completarlo; mientras falte algo, queda como parcial.",
  cardInstallments:
    "Cada compra a cuotas suma su parte (monto entre cuotas) a los pagos de los meses siguientes. El pago del mes es el mayor entre tu pago mínimo y esa suma. Es una estimación sin intereses: si tu extracto dice otra cosa, sube el pago mínimo."
} as const

export type HelpKey = keyof typeof HELP

/** Nombre corto de cada concepto, para la etiqueta accesible del (i) */
export const HELP_LABELS: Record<HelpKey, string> = {
  score: "el score",
  utilization: "la utilización de tarjetas",
  savingsRate: "la tasa de ahorro",
  accumulatedBalance: "el balance acumulado",
  maintenanceFee: "la cuota de manejo",
  reconciliation: "la conciliación",
  upcomingIncomes: "los próximos ingresos",
  noFixedDate: "los ingresos sin fecha fija",
  frequency: "la frecuencia",
  installment: "la cuota",
  multipleReceipts: "los cobros en varias partes",
  cardInstallments: "las compras a cuotas"
}

// Ayuda de cada campo (ícono ? de FieldLabel). Una frase corta en tuteo,
// con ejemplo si ayuda. Clave: "<formulario>.<campo>" o "common.<campo>".
// Los mínimos y formatos se verifican contra los esquemas de Zod
export const FIELD_HELP = {
  // Comunes
  "common.amount": "El valor, sin signo de pesos. Ej.: 150.000.",
  "common.date": "El día en que pasó. Por defecto, hoy.",
  "common.time": "Opcional. Ordena los movimientos de un mismo día.",
  "common.note": "Un detalle para recordar después. Solo lo ves tú.",
  "common.description":
    "El texto que verás en la lista de movimientos. Ej.: Mercado del mes.",
  "common.account": "La cuenta de donde sale o a donde entra el dinero.",
  "common.category": "Agrupa el movimiento en reportes y presupuestos.",
  "common.from": "Primer día que se tiene en cuenta.",
  "common.until": "Último día. Déjalo vacío si no tiene fin.",
  "common.frequency": "Cada cuánto se repite.",
  "common.defaultAccount":
    "La cuenta que se elige sola al registrar. Puedes cambiarla cada vez.",
  "common.period": "El rango de fechas que se muestra.",
  "common.icon": "Cómo la reconoces de un vistazo en listas y gráficas.",
  "common.color": "El color con que aparece en listas y gráficas.",

  // Categoría
  "category.name":
    "Cómo la verás en movimientos y reportes. Ej.: Mercado, Transporte.",

  // Movimiento
  "transaction.type":
    "Entrada: dinero que te llega. Salida: dinero que sale. Traspaso: mueves dinero entre tus cuentas.",
  "transaction.invoice": "Número de la factura, si quieres buscarla después.",
  "transaction.counterparty":
    "A quién le vendiste o a quién le pagaste. Opcional.",

  // Traspaso
  "transfer.from": "La cuenta de donde sale el dinero.",
  "transfer.to": "La cuenta a donde llega.",
  "transfer.amount": "Cuánto mueves. No cuenta como entrada ni salida.",
  "transfer.before":
    "Si a la cuenta no le alcanza, mueve primero dinero desde otra de tus cuentas.",

  // Cuenta
  "account.name": "Cómo la reconoces. Ej.: Ahorros Banco, Efectivo.",
  "account.type":
    "Banco, efectivo o billetera digital. Solo cambia el ícono y cómo se agrupa.",
  "account.openingBalance":
    "El dinero que tenía la cuenta cuando empezaste a usar Tesoro.",
  "account.openingBalanceDate":
    "El día de ese saldo. Los movimientos anteriores no lo cambian.",

  // Conciliar y actualizar saldo
  "balance.real": "El saldo que ves hoy en tu banco, billetera o extracto.",
  "balance.date":
    "El día de ese saldo. Tesoro crea un ajuste por la diferencia.",

  // Deuda
  "debt.kind":
    "Tarjeta: tiene cupo y la usas para comprar. Préstamo: recibiste un monto y lo pagas en cuotas.",
  "debt.name": "Cómo la reconoces. Ej.: Tarjeta Visa, Crédito del carro.",
  "debt.institution": "El banco o la persona a quien le debes.",
  "debt.currentBalance":
    "Lo que debes hoy. Aparece en tu extracto o en la app del banco.",
  "debt.creditLimit":
    "Lo máximo que el banco te deja gastar con la tarjeta. Aparece en tu extracto o en la app del banco.",
  "debt.monthlyInstallment": "Lo que pagas cada mes por el préstamo.",
  "debt.interestRate":
    "La tasa que cobra el banco. Escríbela como sale en el contrato o el extracto. Ej.: 28,5.",
  "debt.rateType":
    "E.A.: efectiva anual. M.V.: mes vencido (mensual). Elige la que diga tu banco.",
  "debt.dueDay": "El último día del mes para pagar sin mora.",
  "debt.minimumPayment":
    "Lo mínimo que debes pagar en el mes para no quedar en mora. Aparece en tu extracto.",
  "debt.cutoffDay":
    "El día en que el banco cierra el extracto. Lo que compres después pasa al mes siguiente.",
  "debt.feeAmount": "Lo que cobra el banco cada mes por tener la tarjeta.",
  "debt.feeDay": "El día del mes en que el banco cobra la cuota de manejo.",
  "debt.originalAmount":
    "El monto que te prestaron al inicio. Sirve para ver cuánto llevas pagado.",
  "debt.termMonths": "En cuántos meses lo pagas en total.",
  "debt.defaultAccount":
    "La cuenta de donde sueles pagar esta deuda. Se elige sola al registrar.",

  // Movimiento de deuda
  "debtEntry.debt": "La tarjeta o el préstamo al que pertenece.",
  "debtEntry.type": "Elige qué pasó. Debajo ves si sube o baja el saldo.",
  "debtEntry.installments":
    "En cuántas cuotas difieres la compra o el avance. Vacío: una sola.",
  "debtEntry.createTransaction":
    "Además, crea el movimiento en tu cuenta para que el saldo cuadre.",
  "debtEntry.direction":
    "Sube: el saldo aumenta (intereses, cargos). Baja: el saldo disminuye.",

  // Me deben
  "receivable.name": "Qué te deben. Ej.: Préstamo a Ana.",
  "receivable.debtor": "Quién te debe.",
  "receivable.mode":
    "Una vez: te pagan todo junto. Mes a mes: te pagan una cuota cada mes.",
  "receivable.amount": "Lo que te deben en total.",
  "receivable.monthlyAmount": "Lo que te pagan cada mes.",
  "receivable.installments": "Cuántas cuotas faltan por cobrar.",
  "receivable.expectedDate": "Cuándo esperas que te paguen. Opcional.",
  "receivable.collectAccount": "La cuenta donde recibes el dinero.",
  "receivable.collectHow":
    "Abono: una parte. Pago completo: todo lo que falta. Una cuota: un mes. Varios meses: llenas varias cuotas de una vez.",
  "receivable.dueDay": "El día del mes en que te pagan la cuota.",
  "receivable.select": "Lo que te deben y vas a cobrar.",
  "receivable.period": "El mes de la cuota que te pagan.",

  // Meta y aporte
  "goal.name": "Para qué ahorras. Ej.: Viaje, Fondo de emergencia.",
  "goal.target": "Cuánto quieres juntar.",
  "goal.targetDate": "Para cuándo. Opcional: sin fecha no hay ritmo sugerido.",
  "contribution.goal": "La meta a la que sumas o de la que sacas.",
  "contribution.type": "Aporte: sumas a la meta. Retiro: sacas de ella.",

  // Presupuesto
  "budget.category": "La categoría de salida que quieres limitar.",
  "budget.amount": "Lo máximo que quieres gastar en el mes en esa categoría.",

  // Gasto fijo
  "recurringExpense.name": "Qué pagas. Ej.: Arriendo, Internet.",
  "recurringExpense.amount": "Lo que pagas cada vez.",
  "recurringExpense.day": "El día en que vence cada mes.",
  "recurringExpense.month": "El mes en que vence, si es anual.",

  // Ingreso fijo
  "recurringIncome.name": "De dónde viene. Ej.: Salario, Arriendo.",
  "recurringIncome.expected": "Lo que esperas recibir cada vez.",
  "recurringIncome.day": "El día del mes en que te pagan.",
  "recurringIncome.month": "El mes en que te pagan, si es anual.",
  "recurringIncome.secondDay":
    "Para quincenas: el otro día del mes en que te pagan.",
  "recurringIncome.weekday": "El día de la semana en que te pagan.",
  "recurringIncome.everyDays": "Cada cuántos días llega. Ej.: 10.",
  "recurringIncome.source":
    "El ingreso fijo al que corresponde esta entrada, si aplica.",

  // Empresa
  "business.name": "El nombre de tu negocio.",
  "business.taxId": "El NIT de la empresa. Opcional.",
  "business.sector": "A qué se dedica. Ajusta las recomendaciones.",

  // Importar
  "import.file": "Un .xlsx o .csv exportado de tu banco o de otra app.",
  "import.headerRow": "La fila donde están los nombres de las columnas.",
  "import.firstColumn": "Desde y hasta qué columna leer.",
  "import.lastColumn": "Desde y hasta qué columna leer.",
  "import.dateFormat": "Cómo vienen las fechas en el archivo.",
  "import.amountSign":
    "Una columna: el signo dice si es entrada o salida. Dos columnas: una para cada una.",
  "import.alsoRegister":
    "Además de la deuda o la meta, crea el movimiento en tus cuentas.",

  // Exportar
  "export.format": "Excel o CSV para tus datos; PDF para leer o imprimir.",
  "export.period": "Qué rango de fechas incluye.",
  "export.inkSaver": "Fondo blanco y menos color para imprimir.",
  "export.orientation": "Cómo se imprime la hoja.",
  "export.size": "Cómo se imprime la hoja.",

  // Cuenta de usuario y auth
  "profile.name": "Cómo te saluda Tesoro.",
  "password.current": "La que usas hoy para entrar.",
  "password.new": "Mínimo 8 caracteres.",
  "currency.code":
    "Solo cambia cómo se muestran los montos. No convierte valores.",
  "confirm.typeToDelete":
    "Escríbelo igual para confirmar. No se puede deshacer.",
  "auth.email": "El correo con el que entras.",
  "auth.password": "Mínimo 8 caracteres.",

  // Filtros y periodos
  "filters.search": "Busca en la descripción y la nota.",
  "filters.type": "Muestra solo entradas, salidas o traspasos.",
  "verify.account": "La cuenta cuyos movimientos vas a revisar.",
  "occurrence.select": "El periodo del gasto fijo que estás pagando.",

  // MCP (conexiones)
  "mcp.access":
    "Qué puede hacer el agente: solo leer, o también registrar y editar."
} as const

export type FieldHelpKey = keyof typeof FIELD_HELP
