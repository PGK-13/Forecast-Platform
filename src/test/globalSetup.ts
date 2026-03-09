import path from 'path';
import { execSync } from 'child_process';

// Jest globalSetup must export a function.
// This function prepares a dedicated SQLite test database using Prisma.
export default async function globalSetup() {
  const testDbPath = path.join(__dirname, '../../prisma/test.db');
  const dbUrl = `file:${testDbPath}`;

  process.env.DATABASE_URL = dbUrl;

  // Sync Prisma schema to the test database
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
}
