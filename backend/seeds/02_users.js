import { hashPassword } from '../src/utils/password.js';
import { query } from '../src/config/db.js';

const SEED_PASSWORD = process.env.SEED_PASSWORD || 'Test1234!';
const PASSWORD_HASH = await hashPassword(SEED_PASSWORD);

async function seedUsers() {
  console.log('🌱 Seeding users...');

  const users = [
    { email: 'customer@test.local', full_name: 'Иван Иванов', phone: '+7 900 111 22 33', role: 'customer' },
    { email: 'manager@test.local', full_name: 'Петр Менеджеров', phone: '+7 900 222 33 44', role: 'manager' },
    { email: 'admin@test.local', full_name: 'Админ Админов', phone: '+7 900 333 44 55', role: 'admin' },
    { email: 'customer2@test.local', full_name: 'Сергей Смирнов', phone: '+7 900 444 55 66', role: 'customer' },
    { email: 'customer3@test.local', full_name: 'Анна Петрова', phone: '+7 900 555 66 77', role: 'customer' },
  ];

  for (const u of users) {
    const roleRes = await query('SELECT id FROM roles WHERE name = $1', [u.role]);
    const roleId = roleRes.rows[0].id;

    const userRes = await query(`
      INSERT INTO users (email, password_hash, full_name, phone, role_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, [u.email, PASSWORD_HASH, u.full_name, u.phone, roleId]);

    const userId = userRes.rows[0]?.id;
    if (!userId) {
      // уже есть — берём id
      const existing = await query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (existing.rows[0]) {
        // корзина уже есть? если нет — создаём
        const cartCheck = await query('SELECT 1 FROM carts WHERE user_id = $1', [existing.rows[0].id]);
        if (cartCheck.rows.length === 0) {
          await query('INSERT INTO carts (user_id) VALUES ($1)', [existing.rows[0].id]);
        }
        continue;
      }
      continue;
    }

    // корзина для нового пользователя
    await query('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  }

  // адреса — для первых 3х customer
  const addresses = [
    { email: 'customer@test.local', is_default: true, city: 'Москва', street: 'ул. Ленина', building: '10', apartment: '5', postal_code: '101000' },
    { email: 'customer@test.local', is_default: false, city: 'Москва', street: 'ул. Пушкина', building: '20', apartment: '15', postal_code: '101001' },
    { email: 'customer2@test.local', is_default: true, city: 'Санкт-Петербург', street: 'Невский пр.', building: '50', apartment: '100', postal_code: '190000' },
    { email: 'customer3@test.local', is_default: true, city: 'Казань', street: 'ул. Баумана', building: '30', apartment: '7', postal_code: '420000' },
  ];

  for (const a of addresses) {
    const userRes = await query('SELECT id FROM users WHERE email = $1', [a.email]);
    if (!userRes.rows[0]) continue;
    const userId = userRes.rows[0].id;

    await query(`
      INSERT INTO addresses (user_id, type, city, street, building, apartment, postal_code, is_default)
      VALUES ($1, 'delivery', $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, type, country, city, street, building, apartment, postal_code) DO NOTHING
    `, [userId, a.city, a.street, a.building, a.apartment, a.postal_code, a.is_default]);
  }

  console.log('✅ Users, carts, addresses seeded');
}

export { seedUsers };