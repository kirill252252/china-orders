import { query } from '../src/config/db.js';

async function seedProducts() {
  console.log('🌱 Seeding products...');

  // Get marketplace IDs
  const mpRes = await query('SELECT id, code FROM marketplaces ORDER BY id');
  const marketplaces = mpRes.rows;

  const products = [
    // Taobao (6 товаров)
    { marketplace: 'taobao', items: [
      { external_id: 'TB001', name: 'Женская футболка базовая хлопок', price_cny: 89, weight_kg: 0.2, attrs: { color: ['белый', 'черный', 'серый'], size: ['S','M','L','XL'] } },
      { external_id: 'TB002', name: 'Мужские джинсы классические', price_cny: 199, weight_kg: 0.6, attrs: { color: ['синий', 'черный'], size: ['28','30','32','34','36'] } },
      { external_id: 'TB003', name: 'Беспроводные наушники TWS', price_cny: 159, weight_kg: 0.15, attrs: { color: ['белый', 'черный'] } },
      { external_id: 'TB004', name: 'Кроссовки беговые легкие', price_cny: 299, weight_kg: 0.8, attrs: { color: ['серый', 'синий', 'красный'], size: ['39','40','41','42','43','44'] } },
      { external_id: 'TB005', name: 'Рюкзак городской 20Л', price_cny: 129, weight_kg: 0.5, attrs: { color: ['черный', 'серый', 'зеленый'] } },
      { external_id: 'TB006', name: 'Чехол для телефона силикон', price_cny: 25, weight_kg: 0.05, attrs: { color: ['прозрачный', 'черный', 'синий', 'розовый'] } },
    ]},
    // Tmall (6 товаров)
    { marketplace: 'tmall', items: [
      { external_id: 'TM001', name: 'Умные часы серии 5', price_cny: 1299, weight_kg: 0.1, attrs: { color: ['черный', 'серебро', 'золото'], size: ['40мм','44мм'] } },
      { external_id: 'TM002', name: 'Пылесос робот с влажной уборкой', price_cny: 1899, weight_kg: 3.5, attrs: { color: ['белый'] } },
      { external_id: 'TM003', name: 'Фен ионный профессиональный', price_cny: 299, weight_kg: 0.6, attrs: { color: ['белый', 'розовый'] } },
      { external_id: 'TM004', name: 'Клавиатура механическая RGB', price_cny: 399, weight_kg: 1.2, attrs: { color: ['черный', 'белый'], switch: ['red','blue','brown'] } },
      { external_id: 'TM005', name: 'Монитор 27" 144Hz IPS', price_cny: 1599, weight_kg: 4.8, attrs: { resolution: '2560x1440' } },
      { external_id: 'TM006', name: 'Набор посуды керамическая 12 шт', price_cny: 259, weight_kg: 2.5, attrs: { color: ['белый', 'бежевый'] } },
    ]},
    // 1688 (6 товаров)
    { marketplace: '1688', items: [
      { external_id: '1688-001', name: 'Ткань хлопковая 100% на рулоне 50м', price_cny: 450, weight_kg: 12, attrs: { color: ['белый', 'натуральный'] } },
      { external_id: '1688-002', name: 'Пластиковая упаковка для еды 1000 шт', price_cny: 180, weight_kg: 5, attrs: { size: ['500мл','750мл','1000мл'] } },
      { external_id: '1688-003', name: 'Металлические фурнитура для сумок 500 шт', price_cny: 320, weight_kg: 2, attrs: { color: ['серебро', 'золото', 'черный'] } },
      { external_id: '1688-004', name: 'Строительный кирпич керамический паллет', price_cny: 800, weight_kg: 1500, attrs: { grade: 'M150' } },
      { external_id: '1688-005', name: 'Провод кабель UTP Cat6 305м', price_cny: 450, weight_kg: 8, attrs: { category: 'Cat6' } },
      { external_id: '1688-006', name: 'Пленка стрейч упаковочная 20мкм 5кг', price_cny: 120, weight_kg: 5.2, attrs: { width: '500мм' } },
    ]},
    // Pinduoduo (6 товаров)
    { marketplace: 'pinduoduo', items: [
      { external_id: 'PDD001', name: 'Фрукты свежие яблоки 5кг', price_cny: 69, weight_kg: 5.2, attrs: { variety: ['Гала','Фуджи','Гренни Смит'] } },
      { external_id: 'PDD002', name: 'Детский конструктор 200 деталей', price_cny: 45, weight_kg: 0.8, attrs: { theme: ['город','космос','техника'] } },
      { external_id: 'PDD003', name: 'Носки хлопковые 10 пар', price_cny: 39, weight_kg: 0.3, attrs: { color: ['черный','белый','серый'], size: ['39-42','43-46'] } },
      { external_id: 'PDD004', name: 'Средство для мытья посуды 2Л', price_cny: 28, weight_kg: 2.1, attrs: { scent: ['лимон','яблоко','без запаха'] } },
      { external_id: 'PDD005', name: 'Плед микрофибра 150x200см', price_cny: 89, weight_kg: 1.2, attrs: { color: ['серый','бежевый','синий'] } },
      { external_id: 'PDD006', name: 'Сумка для покупок многоразовая 3 шт', price_cny: 19, weight_kg: 0.15, attrs: { color: ['зеленый','синий','красный'] } },
    ]},
    // JD (6 товаров)
    { marketplace: 'jd', items: [
      { external_id: 'JD001', name: 'Ноутбук игровой RTX 4060 16GB', price_cny: 6999, weight_kg: 2.5, attrs: { cpu: 'i7-13620H', ram: '16GB', ssd: '512GB' } },
      { external_id: 'JD002', name: 'Смартфон флагман 256GB', price_cny: 4599, weight_kg: 0.2, attrs: { color: ['черный','белый','синий'], storage: '256GB' } },
      { external_id: 'JD003', name: 'SSD NVMe 1TB PCIe 4.0', price_cny: 599, weight_kg: 0.02, attrs: { interface: 'M.2 2280' } },
      { external_id: 'JD004', name: 'Кулер для процессора водянка 360мм', price_cny: 459, weight_kg: 1.5, attrs: { socket: ['LGA1700','AM5'] } },
      { external_id: 'JD005', name: 'Кресло офисное эргономичное сетка', price_cny: 1299, weight_kg: 18, attrs: { color: ['черный','серый'] } },
      { external_id: 'JD006', name: 'Веб-камера 4K с автофокусом', price_cny: 399, weight_kg: 0.3, attrs: { resolution: '3840x2160', fps: 30 } },
    ]},
    // Poizon (6 товаров)
    { marketplace: 'poizon', items: [
      { external_id: 'PZ001', name: 'Кроссовки Air Jordan 1 Retro High', price_cny: 1299, weight_kg: 1.2, attrs: { color: ['Chicago','Bred','Royal'], size: ['40','41','42','43','44','45'] } },
      { external_id: 'PZ002', name: 'Худи Supreme Box Logo', price_cny: 1899, weight_kg: 0.8, attrs: { color: ['черный','белый','красный','серый'], size: ['S','M','L','XL'] } },
      { external_id: 'PZ003', name: 'Кроссовки Yeezy Boost 350 V2', price_cny: 1599, weight_kg: 1.0, attrs: { color: ['Zebra','Black','Cream'], size: ['40','41','42','43','44','45'] } },
      { external_id: 'PZ004', name: 'Рюкзак Off-White Industrial Belt', price_cny: 2199, weight_kg: 0.6, attrs: { color: ['желтый','черный'] } },
      { external_id: 'PZ005', name: 'Кроссовки Nike Dunk Low Panda', price_cny: 899, weight_kg: 1.1, attrs: { color: ['Black/White'], size: ['39','40','41','42','43','44','45'] } },
      { external_id: 'PZ006', name: 'Кепка New Era 9FIFTY Lakers', price_cny: 299, weight_kg: 0.2, attrs: { color: ['фиолетовый/золотой'], size: ['OSFA'] } },
    ]},
  ];

  for (const mp of products) {
    const mpInfo = marketplaces.find(m => m.code === mp.marketplace);
    if (!mpInfo) continue;
    const marketplaceId = mpInfo.id;

    for (const item of mp.items) {
      await query(`
        INSERT INTO products (marketplace_id, external_id, name, description, price_cny, weight_kg, attributes, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (marketplace_id, external_id) DO NOTHING
      `, [
        marketplaceId,
        item.external_id,
        item.name,
        `Качественный товар с маркетплейса ${mp.marketplace}`,
        item.price_cny,
        item.weight_kg,
        JSON.stringify(item.attrs)
      ]);
    }
  }

  console.log('✅ Products seeded');
}

export { seedProducts };