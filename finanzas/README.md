# Personal Finance Web Platform

Full-stack web platform for personal and household finance management, designed to be deployed on Oracle Cloud Infrastructure (OCI) Free Tier.

## 🚀 Features

- **Multi-user & Households:** Manage personal accounts or share a household with a partner.
- **Transactions:** Manual entry, Excel/CSV import, and automatic email receipt processing.
- **Proportional Distribution:** Automatically calculate how to split household expenses based on each member's income.
- **AI Integration:** Uses Groq (Llama 3) to extract transaction data from bank emails.
- **Telegram Bot:** Get summaries and classify transactions on the go.
- **Modern Dashboard:** Visualize your financial health with interactive charts.

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL + Prisma ORM
- **AI:** Groq SDK
- **Bot:** Telegraf

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL database
- Mailgun account (for inbound emails)
- Groq API Key
- Telegram Bot Token

## ⚙️ Setup

1. Clone the repository.
2. Install dependencies: \`npm install\`
3. Set up your \`.env\` file (see \`.env.example\`).
4. Initialize the database: \`npx prisma migrate dev\`
5. Seed initial categories: \`npx prisma db seed\`
6. Run the development server: \`npm run dev\`

## ☁️ Deployment on OCI (Oracle Cloud)

### 1. Compute Instance
- Create an ARM Ampere or AMD instance in OCI Free Tier.
- Install Docker and Docker Compose.

### 2. Database
- You can use an **Oracle Autonomous Database** (requires configuration for Prisma) or run **PostgreSQL** in a Docker container on your instance.

### 3. Deploy with Docker
- Build the image: \`docker build -t finance-app .\`
- Run: \`docker run -p 3000:3000 --env-file .env finance-app\`

---

## 🇪🇸 Resumen en Español

Plataforma web de finanzas personales diseñada para parejas y hogares.

### Funcionalidades Clave:
- **Gestión de Hogares:** Permite invitar a tu pareja y gestionar cuentas compartidas.
- **Reparto Proporcional:** Calcula cuánto debe aportar cada uno a los gastos comunes según su sueldo.
- **Captura Automática:** Procesa correos de bancos usando IA (Groq) e importa archivos Excel con un asistente de mapeo.
- **Deduplicación:** Evita registros dobles entre el banco, los correos y las entradas manuales.
- **Bot de Telegram:** Envía resúmenes diarios y permite clasificar gastos rápidamente.

### Configuración Rápida:
1. Copia \`.env.example\` a \`.env\` y llena tus llaves.
2. Ejecuta \`npm install\`.
3. Prepara la base de datos con \`npx prisma migrate dev\`.
4. Corre \`npm run dev\`.
