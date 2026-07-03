import { defineConfig } from 'prisma/config';
import fs from 'fs';
import path from 'path';

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
      if (match) {
        dbUrl = match[1];
      }
    }
  } catch (e) {}
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: dbUrl || '',
  },
});
