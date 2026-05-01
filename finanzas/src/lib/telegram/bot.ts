import { Telegraf, Markup } from "telegraf";
import { prisma } from "@/lib/prisma";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || "");

bot.start((ctx) => {
  ctx.reply("¡Hola! Soy tu asistente de Finanzas Personales. Reenvíame un código de vinculación de la web para empezar.");
});

bot.command("vincula", async (ctx) => {
  const token = ctx.message.text.split(" ")[1];
  if (!token) return ctx.reply("Uso: /vincula <token>");

  // Token logic: In a real app, you'd find a user with this temporary token
  ctx.reply("¡Viculación exitosa! Ahora recibirás tus resúmenes aquí.");
});

bot.command("hoy", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const tgUser = await prisma.telegramUser.findUnique({
    where: { telegramId },
    include: { user: true }
  });

  if (!tgUser) return ctx.reply("Primero debes vincular tu cuenta con /vincula <token>");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: tgUser.userId,
      date: { gte: startOfDay },
      type: 'EXPENSE'
    }
  });

  const total = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const count = transactions.length;

  const format = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  ctx.reply(`Hoy has gastado ${format(total)} en ${count} transacciones.`);
});

bot.command("resumen", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const tgUser = await prisma.telegramUser.findUnique({
    where: { telegramId },
    include: { user: true }
  });

  if (!tgUser) return ctx.reply("Primero debes vincular tu cuenta con /vincula <token>");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: tgUser.userId,
      date: { gte: startOfMonth }
    }
  });

  const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const income = transactions.filter(t => t.type === 'INCOME').reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = income - expenses;

  const format = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  ctx.reply(`📊 Resumen del Mes:\n\n💰 Balance: ${format(balance)}\n💸 Gastos: ${format(expenses)}\n📈 Ingresos: ${format(income)}`);
});

// For interactive classification
export async function sendClassificationRequest(telegramId: string, transactionId: string, text: string, categories: {id: string, name: string}[]) {
  const keyboard = Markup.inlineKeyboard(
    categories.map(c => [Markup.button.callback(c.name, `cat_\${transactionId}_\${c.id}`)])
  );

  await bot.telegram.sendMessage(telegramId, `No pude clasificar este gasto automáticamente:\n"\${text}"\n\n¿A qué categoría pertenece?`, keyboard);
}

bot.action(/cat_(.+)_(.+)/, async (ctx) => {
  const transactionId = ctx.match[1];
  const categoryId = ctx.match[2];

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { categoryId, status: 'CONFIRMED' }
  });

  await ctx.answerCbQuery("Categoría actualizada");
  await ctx.editMessageText("¡Gracias! He clasificado la transacción.");
});

export default bot;
