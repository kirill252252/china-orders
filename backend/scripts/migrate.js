import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

/**
 * Получает список Applied (имен) миграций из БД.
 */
async function getAppliedMigrations() {
  try {
    const result = await query('SELECT name FROM schema_migrations ORDER BY id');
    return new Set(result.rows.map(r => r.name));
  } catch (err) {
    console.warn('⚠️  Could not read schema_migrations table:', err.message);
    return new Set();
  }
}

/** Получает пары (up/down) из каталога миграций. */
function getMigrationPairs() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.up.sql') || f.endsWith('.down.sql'))
    .sort();

  const migrations = new Map();

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.(up|down)\.sql$/);
    if (!match) {
      console.warn(`⚠️  Skipping invalid migration filename: ${file}`);
      continue;
    }
    const [, num, name, direction] = match;
    const key = `${num}_${name}`;
    if (!migrations.has(key)) {
      migrations.set(key, { number: parseInt(num, 10), name: key, up: null, down: null });
    }
    const m = migrations.get(key);
    m[direction] = file;
  }

  return Array.from(migrations.values()).sort((a, b) => a.number - b.number);
}

/** Применяет одну миграцию (up). */
async function applyUpMigration(migration) {
  if (!migration.up) throw new Error(`Missing .up.sql for ${migration.name}`);

  const filepath = path.join(MIGRATIONS_DIR, migration.up);
  const sql = fs.readFileSync(filepath, 'utf-8');

  console.log(`📄 Applying migration: ${migration.up}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
    await client.query('COMMIT');
    console.log(`✅ Applied: ${migration.up}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to apply ${migration.up}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/** Откатывает одну миграцию (down). */
async function applyDownMigration(migration) {
  if (!migration.down) throw new Error(`Missing .down.sql for ${migration.name}`);

  const filepath = path.join(MIGRATIONS_DIR, migration.down);
  const sql = fs.readFileSync(filepath, 'utf-8');

  console.log(`📄 Rolling back migration: ${migration.down}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE name = $1', [migration.name]);
    await client.query('COMMIT');
    console.log(`✅ Rolled back: ${migration.down}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to rollback ${migration.down}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

/** Запуск: применить все pending миграции. */
export async function migrateUp() {
  await ensureMigrationsTable();

  const migrations = getMigrationPairs();
  const applied = await getAppliedMigrations();
  const pending = migrations.filter(m => !applied.has(m.name));

  console.log(`📦 Found ${pending.length} pending migration(s)`);

  if (pending.length === 0) {
    console.log('✅ No pending migrations');
    return;
  }

  for (const migration of pending) {
    await applyUpMigration(migration);
  }
  console.log('🎉 All migrations applied');
}

/** Запуск: откатить последнюю примененную миграцию. */
export async function migrateDown() {
  await ensureMigrationsTable();

  const migrations = getMigrationPairs();
  const applied = await getAppliedMigrations();
  const appliedList = migrations.filter(m => applied.has(m.name));

  if (appliedList.length === 0) {
    console.log('❌ No migrations to rollback');
    return;
  }

  const lastMigration = appliedList[appliedList.length - 1];
  console.log(`⏪ Rolling back last migration: ${lastMigration.name}`);

  await applyDownMigration(lastMigration);
}

/** Статус: какие миграции applied, а какие pending. */
export async function migrateStatus() {
  await ensureMigrationsTable();

  const migrations = getMigrationPairs();
  const applied = await getAppliedMigrations();

  console.log('\n📋 Migration Status:');
  console.log('─'.repeat(60));
  for (const m of migrations) {
    const status = applied.has(m.name) ? '✅ Applied' : '⏳ Pending';
    console.log(`${status}  ${m.name} [${m.up ? '↑' : '✗'} ${m.down ? '↓' : '✗'}]`);
  }
  console.log('─'.repeat(60));
}

/** Создание таблицы отслеживания (idempotent). */
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ schema_migrations table ready');
}

const command = process.argv[2];

switch (command) {
  case 'up':
    await migrateUp().catch((e) => { console.error('❌ migrate up error:', e); process.exit(1); });
    break;
  case 'down':
    await migrateDown().catch((e) => { console.error('❌ migrate down error:', e); process.exit(1); });
    break;
  case 'status':
    await migrateStatus().catch((e) => { console.error('❌ migrate status error:', e); process.exit(1); });
    break;
  default:
    console.log('Usage: node migrate.js [up|down|status]');
    process.exit(1);
}

await pool.end();