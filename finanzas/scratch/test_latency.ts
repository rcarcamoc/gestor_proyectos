import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Measuring network latency to TiDB Cloud...");
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const end = performance.now();
    console.log(`Ping ${i + 1}: ${(end - start).toFixed(2)} ms`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
