import { readFileSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runSeedFile(filename) {
  const filepath = join(__dirname, '../seeds', filename);
  if (filename.endsWith('.sql')) {
    const sql = readFileSync(filepath, 'utf-8');
    await query(sql);
  } else if (filename.endsWith('.js')) {
    const mod = await import(filepath);
    if (mod.seedUsers) await mod.seedUsers();
    if (mod.seedProducts) await mod.seedProducts();
    if (mod.seedOrders) await mod.seedOrders();
  }
}

async function seed() {
  console.log('🌱 Running seed...');

  await runSeedFile('01_reference.sql');
  console.log('✅ Reference data seeded');

  await runSeedFile('02_users.js');
  console.log('✅ Users seeded');

  await runSeedFile('03_products.js');
  console.log('✅ Products seeded');

  await runSeedFile('04_orders.js');
  console.log('✅ Orders seeded');

  console.log('🌱 Seed completed');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});