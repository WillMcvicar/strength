// drizzle-kit generates migrations from src/data/schema.ts (DESIGN §4.6). The `expo` driver also
// writes `migrations.js`, which bundles the SQL for the app and for Jest alike.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/data/schema.ts',
  out: './src/data/migrations',
});
