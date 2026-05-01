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
  // Logic to fetch today's transactions for the user
  ctx.reply("Hoy has gastado $25.000 en 3 transacciones.");
});

bot.command("resumen", async (ctx) => {
  ctx.reply("Tu balance del mes es de $450.000. \nGastos: $800.000\nIngresos: $1.250.000");
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
