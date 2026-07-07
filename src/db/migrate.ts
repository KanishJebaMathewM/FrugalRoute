import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';
import path from 'path';

export async function runMigrations() {
  console.log('Running migrations...');
  // We resolve the path relative to process.cwd() or similar.
  const migrationsFolder = path.resolve(process.cwd(), './src/db/migrations');
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed successfully.');
}

// In CommonJS, check if this file is run directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      pool.end();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      pool.end();
      process.exit(1);
    });
}
