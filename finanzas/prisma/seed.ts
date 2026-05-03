import { PrismaClient, TransactionType, AccountType, TransactionSource, TransactionStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding data...')

  // 1. Categories
  const categoriesData = [
    { name: 'luz', icon: 'zap', color: '#F59E0B' },
    { name: 'agua', icon: 'droplets', color: '#3B82F6' },
    { name: 'gas', icon: 'flame', color: '#EF4444' },
    { name: 'internet', icon: 'wifi', color: '#8B5CF6' },
    { name: 'Celular', icon: 'smartphone', color: '#10B981' },
    { name: 'supermercado', icon: 'shopping-basket', color: '#14B8A6' },
    { name: 'Almacen', icon: 'store', color: '#F97316' },
    { name: 'veguita', icon: 'carrot', color: '#84CC16' },
    { name: 'salir a comer', icon: 'utensils', color: '#F43F5E' },
    { name: 'delivery', icon: 'truck', color: '#EC4899' },
    { name: 'Antojos', icon: 'ice-cream', color: '#D946EF' },
    { name: 'Bencina', icon: 'fuel', color: '#64748B' },
    { name: 'PEAJES', icon: 'road', color: '#6B7280' },
    { name: 'uber', icon: 'car', color: '#000000' },
    { name: 'Medico', icon: 'heart-pulse', color: '#E11D48' },
    { name: 'farmacia', icon: 'pill', color: '#0EA5E9' },
    { name: 'streaming', icon: 'tv', color: '#6366F1' },
    { name: 'Conciertos', icon: 'ticket', color: '#A855F7' },
    { name: 'vacaciones', icon: 'plane', color: '#FBBF24' },
    { name: 'Tarjeta titular', icon: 'credit-card', color: '#475569' },
    { name: 'Credito', icon: 'landmark', color: '#0F172A' },
    { name: 'Seguros', icon: 'shield-check', color: '#334155' },
    { name: 'Regalos', icon: 'gift', color: '#E879F9' },
    { name: 'bubi', icon: 'heart', color: '#FDA4AF' },
    { name: 'choquito', icon: 'paw-print', color: '#8B5CF6' },
    { name: 'Gatos', icon: 'cat', color: '#F59E0B' },
    { name: 'Ropa', icon: 'shirt', color: '#EC4899' },
    { name: 'Imprevistos', icon: 'help-circle', color: '#94A3B8' },
    { name: 'sueldo', icon: 'banknote', color: '#22C55E' }
  ]

  await prisma.category.deleteMany({
    where: { isDefault: true }
  })

  const categories = []
  for (const cat of categoriesData) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        isDefault: true,
      },
    })
    categories.push(created)
  }

  // 2. Users (upsert = safe to run multiple times)
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

  // 3. Household (only create if it doesn't exist)
  let household = await prisma.household.findFirst({
    where: { name: 'Hogar Demo' }
  })

  if (!household) {
    household = await prisma.household.create({
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

    // 4. Accounts (only create if household was just created)
    const accA = await prisma.account.create({
      data: { name: 'Cuenta Personal A', type: 'CHECKING', currency: 'CLP', userId: userA.id, balance: 500000 }
    })

    const accB = await prisma.account.create({
      data: { name: 'Cuenta Personal B', type: 'CHECKING', currency: 'CLP', userId: userB.id, balance: 300000 }
    })

    const accShared = await prisma.account.create({
      data: { name: 'Cuenta Compartida', type: 'CHECKING', currency: 'CLP', householdId: household.id, balance: 150000 }
    })

    // 5. Incomes
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

    // 6. Household Transactions (demo data)
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
        userId: userA.id,
        userId_internal: i % 2 === 0 ? userA.id : userB.id,
        status: i === 0 ? 'PENDING_REVIEW' : 'CONFIRMED' as TransactionStatus,
        source: 'MANUAL' as TransactionSource
      })
    }
    await prisma.transaction.createMany({ data: txs })
    console.log('Demo data created.')
  } else {
    console.log('Demo data already exists, skipping creation.')
  }

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
