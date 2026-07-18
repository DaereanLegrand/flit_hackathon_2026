export const transactions = [
  { id: 1, description: 'Nómina', category: 'Ingreso', amount: 3200, type: 'income', date: '2026-07-18' },
  { id: 2, description: 'Supermercado', category: 'Alimentación', amount: 156.50, type: 'expense', date: '2026-07-17' },
  { id: 3, description: 'Netflix', category: 'Suscripciones', amount: 15.99, type: 'expense', date: '2026-07-16' },
  { id: 4, description: 'Freelance Web', category: 'Ingreso', amount: 850, type: 'income', date: '2026-07-15' },
  { id: 5, description: 'Restaurante', category: 'Ocio', amount: 45.80, type: 'expense', date: '2026-07-14' },
  { id: 6, description: 'Gasolina', category: 'Transporte', amount: 65.00, type: 'expense', date: '2026-07-13' },
  { id: 7, description: 'Spotify', category: 'Suscripciones', amount: 9.99, type: 'expense', date: '2026-07-12' },
  { id: 8, description: 'Ropa', category: 'Personal', amount: 120.00, type: 'expense', date: '2026-07-11' },
  { id: 9, description: 'Dividendos', category: 'Ingreso', amount: 200, type: 'income', date: '2026-07-10' },
  { id: 10, description: 'Farmacia', category: 'Salud', amount: 32.50, type: 'expense', date: '2026-07-09' },
]

export const summary = {
  totalBalance: 12450.75,
  monthlyIncome: 4250,
  monthlyExpenses: 2895.28,
  savingsRate: 32,
}

export const categories = [
  'Alimentación', 'Transporte', 'Ocio', 'Salud',
  'Suscripciones', 'Personal', 'Hogar', 'Ingreso'
]

export const credits = [
  {
    id: 1,
    name: 'Tarjeta de Crédito',
    lender: 'Banco Nacional',
    totalAmount: 50000,
    remainingBalance: 32500,
    apr: 36,
    termMonths: 24,
    remainingMonths: 15,
    minimumPayment: 2650,
    nextPaymentDate: '2026-08-10',
  },
  {
    id: 2,
    name: 'Préstamo Automotriz',
    lender: 'Financiera Auto',
    totalAmount: 280000,
    remainingBalance: 185000,
    apr: 12.5,
    termMonths: 48,
    remainingMonths: 28,
    minimumPayment: 7340,
    nextPaymentDate: '2026-08-05',
  },
  {
    id: 3,
    name: 'Crédito Hipotecario',
    lender: 'Hipotecaria Nacional',
    totalAmount: 1850000,
    remainingBalance: 1420000,
    apr: 9.8,
    termMonths: 240,
    remainingMonths: 186,
    minimumPayment: 15280,
    nextPaymentDate: '2026-08-01',
  },
  {
    id: 4,
    name: 'Préstamo Personal',
    lender: 'Banco del Sur',
    totalAmount: 75000,
    remainingBalance: 22000,
    apr: 22,
    termMonths: 18,
    remainingMonths: 6,
    minimumPayment: 4250,
    nextPaymentDate: '2026-08-15',
  },
]
