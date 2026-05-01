import { PrismaClient, TransactionType, AccountType, TransactionSource, TransactionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')

  // 1. Categories
  const categoriesData = [
    { name: 'Vivienda', icon: 'home', color: '#EF4444' },
    { name: 'Servicios del hogar', icon: 'zap', color: '#F59E0B' },
    { name: 'Alimentación básica (hogar)', icon: 'shopping-basket', color: '#10B981' },
    { name: 'Comida y antojos (placer)', icon: 'utensils', color: '#3B82F6' },
    { name: 'Transporte', icon: 'car', color: '#6366F1' },
    { name: 'Salud', icon: 'heart-pulse', color: '#EC4899' },
    { name: 'Ocio y entretenimiento', icon: 'ticket', color: '#8B5CF6' },
    { name: 'Deudas y productos financieros', icon: 'credit-card', color: '#6B7280' },
    { name: 'Seguros', icon: 'shield-check', color: '#14B8A6' },
    { name: 'Familia y mascotas', icon: 'paw-print', color: '#D946EF' },
    { name: 'Ropa y cuidado personal', icon: 'shirt', color: '#F43F5E' },
    { name: 'Imprevistos / misceláneos', icon: 'help-circle', color: '#94A3B8' },
  ]

  const categories = []
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { id: cat.name }, // Hack for seed
      update: {},
      create: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      },
    })
    categories.push(created)
  }

  // 2. Users
  const passwordHash = await bcrypt.hash('demo123', 10)

  const userA = await prisma.user.upsert({
    where: { email: 'user_a@example.com' },
    update: {},
    create: {
      email: 'user_a@example.com',
      name: 'Persona A',
      passwordHash,
      mainCurrency: 'CLP',
    },
  })

  const userB = await prisma.user.upsert({
    where: { email: 'user_b@example.com' },
    update: {},
    create: {
      email: 'user_b@example.com',
      name: 'Persona B',
      passwordHash,
      mainCurrency: 'CLP',
    },
  })

  // 3. Household
  const household = await prisma.household.create({
    data: {
      name: 'Hogar Demo',
      users: {
        create: [
          { userId: userA.id, role: 'ADMIN' },
          { userId: userB.id, role: 'MEMBER' },
        ]
      }
    }
  })

  // 4. Accounts
  const accA = await prisma.account.create({
    data: { name: 'Cuenta Personal A', type: 'CHECKING', currency: 'CLP', userId: userA.id, balance: 500000 }
  })

  const accB = await prisma.account.create({
    data: { name: 'Cuenta Personal B', type: 'CHECKING', currency: 'CLP', userId: userB.id, balance: 300000 }
  })

  const accShared = await prisma.account.create({
    data: { name: 'Cuenta Compartida', type: 'CHECKING', currency: 'CLP', householdId: household.id, balance: 150000 }
  })

  // 5. Incomes (for proportional calculation)
  await prisma.transaction.createMany({
    data: [
      {
        amount: 1200000, currency: 'CLP', date: new Date(), type: 'INCOME',
        description: 'Sueldo A', accountId: accA.id, userId: userA.id, userId_internal: userA.id, status: 'CONFIRMED'
      },
      {
        amount: 800000, currency: 'CLP', date: new Date(), type: 'INCOME',
        description: 'Sueldo B', accountId: accB.id, userId: userB.id, userId_internal: userB.id, status: 'CONFIRMED'
      }
    ]
  })

  // 6. Household Transactions (last 3 months)
  const txs = []
  const now = new Date()
  for (let i = 0; i < 40; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const cat = categories[Math.floor(Math.random() * categories.length)]
    txs.push({
      amount: Math.floor(Math.random() * 50000) + 5000,
      currency: 'CLP',
      date,
      type: 'EXPENSE' as TransactionType,
      description: `Gasto demo ${i}`,
      accountId: accShared.id,
      categoryId: cat.id,
      householdId: household.id,
      userId: userA.id, // Primary owner for demo
      userId_internal: i % 2 === 0 ? userA.id : userB.id,
      status: i === 0 ? 'PENDING_REVIEW' : 'CONFIRMED' as TransactionStatus,
      source: 'MANUAL' as TransactionSource
    })
  }
  await prisma.transaction.createMany({ data: txs })

  console.log('Seed completed successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
