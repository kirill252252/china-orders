import { query, pool } from '../src/config/db.js';

async function seedOrders() {
  console.log('🌱 Seeding orders...');

  const customersRes = await query(`
    SELECT u.id, u.email FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'customer' AND u.email IN ('customer@test.local', 'customer2@test.local', 'customer3@test.local')
    ORDER BY u.id
  `);
  const customers = customersRes.rows;

  const managerRes = await query(`SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'manager' LIMIT 1`);
  const managerId = managerRes.rows[0]?.id;

  const productsRes = await query('SELECT id, price_cny, weight_kg FROM products WHERE is_active = TRUE ORDER BY RANDOM()');
  const allProducts = productsRes.rows;

  const ordersData = [
    { customerIdx: 0, targetStatus: 'new', itemsCount: 1 },
    { customerIdx: 1, targetStatus: 'new', itemsCount: 2 },
    { customerIdx: 2, targetStatus: 'awaiting_payment', itemsCount: 1 },
    { customerIdx: 0, targetStatus: 'awaiting_payment', itemsCount: 2 },
    { customerIdx: 1, targetStatus: 'awaiting_payment', itemsCount: 1 },
    { customerIdx: 2, targetStatus: 'paid', itemsCount: 2 },
    { customerIdx: 0, targetStatus: 'paid', itemsCount: 3 },
    { customerIdx: 1, targetStatus: 'paid', itemsCount: 1 },
    { customerIdx: 2, targetStatus: 'purchased', itemsCount: 1 },
    { customerIdx: 0, targetStatus: 'purchased', itemsCount: 2 },
    { customerIdx: 1, targetStatus: 'purchased', itemsCount: 1 },
    { customerIdx: 2, targetStatus: 'shipped_from_china', itemsCount: 2 },
    { customerIdx: 0, targetStatus: 'shipped_from_china', itemsCount: 1 },
    { customerIdx: 1, targetStatus: 'shipped_from_china', itemsCount: 3 },
    { customerIdx: 2, targetStatus: 'in_transit', itemsCount: 1 },
    { customerIdx: 0, targetStatus: 'in_transit', itemsCount: 2 },
    { customerIdx: 1, targetStatus: 'arrived_warehouse', itemsCount: 1 },
    { customerIdx: 2, targetStatus: 'arrived_warehouse', itemsCount: 2 },
    { customerIdx: 0, targetStatus: 'delivered', itemsCount: 1 },
    { customerIdx: 1, targetStatus: 'delivered', itemsCount: 2 },
    { customerIdx: 1, targetStatus: 'cancelled', itemsCount: 1, cancelFrom: 'new' },
    { customerIdx: 2, targetStatus: 'cancelled', itemsCount: 2, cancelFrom: 'awaiting_payment' },
  ];

  let orderCounter = 1;
  const now = new Date();

  for (const orderData of ordersData) {
    const customer = customers[orderData.customerIdx];
    const targetStatus = orderData.targetStatus;
    const cancelFrom = orderData.cancelFrom || targetStatus;

    const orderNumber = `ORD-2026-${String(orderCounter).padStart(4, '0')}`;
    orderCounter++;

    const existing = await query('SELECT 1 FROM orders WHERE order_number = $1', [orderNumber]);
    if (existing.rows.length > 0) {
      continue;
    }

    const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
    const selectedProducts = shuffled.slice(0, orderData.itemsCount);

    const statusChain = getStatusChain(targetStatus, cancelFrom);
    if (!statusChain || statusChain.length === 0) {
      // 'new' status - just create order
    }

    // Generate intervals for the entire chain FIRST
    const numTransitions = statusChain.length;
    const intervals = [];
    let totalIntervalHours = 0;

    for (let i = 0; i < numTransitions; i++) {
      const hours = Math.floor(Math.random() * (72 - 2) + 2);
      intervals.push(hours);
      totalIntervalHours += hours;
    }

    const maxTotalHours = 1440; // 60 days
    const bufferHours = Math.floor(Math.random() * (20 * 24));
    const totalLookbackHours = totalIntervalHours + bufferHours;

    let finalIntervalHours = totalIntervalHours;
    let finalBufferHours = bufferHours;
    if (totalLookbackHours > 1440) {
      const scale = 1440 / totalLookbackHours;
      finalIntervalHours = Math.floor(totalIntervalHours * scale);
      finalBufferHours = Math.floor(bufferHours * scale);
      for (let i = 0; i < intervals.length; i++) {
        intervals[i] = Math.max(2, Math.floor(intervals[i] * (1440 / totalLookbackHours)));
      }
    }

    const createdAt = new Date(Date.now() - (finalIntervalHours + finalBufferHours) * 60 * 60 * 1000);

    const transitionTimes = [];
    let currentTime = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    for (let i = 0; i < intervals.length; i++) {
      transitionTimes.push(new Date(currentTime));
      currentTime = new Date(currentTime.getTime() + intervals[i] * 60 * 60 * 1000);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_current_user_id($1)', [customer.id]);

      const orderRes = await client.query(`
        INSERT INTO orders (order_number, user_id, status_id, shipping_address_id, created_at)
        VALUES ($1, $2, 1, 
          (SELECT id FROM addresses WHERE user_id = $2 AND is_default LIMIT 1),
          $3
        )
        RETURNING id
      `, [orderNumber, customer.id, createdAt.toISOString()]);
      const orderId = orderRes.rows[0].id;

      let subtotalCny = 0;
      let totalWeightKg = 0;
      for (let i = 0; i < selectedProducts.length; i++) {
        const prod = selectedProducts[i];
        const quantity = Math.floor(Math.random() * 3) + 1;
        subtotalCny += prod.price_cny * quantity;
        totalWeightKg += prod.weight_kg * quantity;

        await client.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price_cny, weight_kg)
          VALUES ($1, $2, $3, $4, $5)
        `, [orderId, prod.id, quantity, prod.price_cny, prod.weight_kg]);
      }

      await client.query('SELECT fn_calculate_order_total($1)', [orderId]);

      let transitionIndex = 0;
      let shipmentId = null;

      for (const nextStatus of statusChain) {
        const statusRes = await client.query('SELECT id FROM order_statuses WHERE code = $1', [nextStatus]);
        if (statusRes.rows.length === 0) break;
        const nextStatusId = statusRes.rows[0].id;

        const isManagerTransition = ['paid', 'purchased', 'shipped_from_china', 'in_transit', 'arrived_warehouse', 'delivered'].includes(nextStatus);
        if (isManagerTransition && managerId) {
          await client.query('SELECT set_current_user_id($1)', [managerId]);
        } else {
          await client.query('SELECT set_current_user_id($1)', [customer.id]);
        }

        const transitionTime = transitionTimes[transitionIndex];
        transitionIndex++;

        await client.query(`
          UPDATE orders SET status_id = $1, updated_at = $2 WHERE id = $3
        `, [nextStatusId, transitionTime.toISOString(), orderId]);

        if (nextStatus === 'paid') {
          const orderTotal = await client.query('SELECT total_rub FROM orders WHERE id = $1', [orderId]);
          const totalRub = orderTotal.rows[0].total_rub;
          await client.query(`
            INSERT INTO payments (order_id, payment_method, status, amount_rub, paid_at, created_at)
            VALUES ($1, 'mock', 'success', $2, $3, $3)
          `, [orderId, totalRub, transitionTime.toISOString()]);
          await client.query('UPDATE orders SET paid_at = $1 WHERE id = $2', [transitionTime.toISOString(), orderId]);
        }

        if (nextStatus === 'shipped_from_china') {
          const estimatedArrival = new Date(transitionTime.getTime() + (7 + Math.floor(Math.random() * 14)) * 24 * 60 * 60 * 1000);
          const shipmentRes = await client.query(`
            INSERT INTO shipments (order_id, tracking_number, carrier, weight_kg, declared_value_cny, shipped_at, estimated_arrival, created_at)
            VALUES ($1, $2, 'cdek', $3, $4, $5, $6, $5)
            RETURNING id
          `, [orderId, `TRK${orderNumber}-SHIP`, totalWeightKg, subtotalCny, transitionTime.toISOString(), estimatedArrival.toISOString()]);
          shipmentId = shipmentRes.rows[0].id;
        } else if (nextStatus === 'arrived_warehouse' && shipmentId) {
          await client.query(`UPDATE shipments SET arrived_at = $1, updated_at = $1 WHERE id = $2`, [transitionTime.toISOString(), shipmentId]);
        }

        if (nextStatus === 'delivered') {
          await client.query('UPDATE orders SET completed_at = $1 WHERE id = $2', [transitionTime.toISOString(), orderId]);
        }
        if (nextStatus === 'cancelled') {
          await client.query('UPDATE orders SET cancelled_at = $1 WHERE id = $2', [transitionTime.toISOString(), orderId]);
        }
      }

      await client.query('COMMIT');

      const historyRes = await query(`
        SELECT id FROM order_status_history WHERE order_id = $1 ORDER BY created_at
      `, [orderId]);

      if (historyRes.rows.length > 0) {
        let prevTime = createdAt;
        for (let i = 0; i < historyRes.rows.length; i++) {
          let newTime;
          if (i === 0) {
            newTime = createdAt;
          } else if (i - 1 < transitionTimes.length) {
            newTime = transitionTimes[i - 1];
          } else {
            const intervalHours = Math.floor(Math.random() * (72 - 2) + 2);
            newTime = new Date(historyRes.rows[i - 1].created_at.getTime() + intervalHours * 60 * 60 * 1000);
            if (newTime > new Date()) newTime = new Date();
          }

          await query(`UPDATE order_status_history SET created_at = $1 WHERE id = $2`, [newTime.toISOString(), historyRes.rows[i].id]);
          prevTime = newTime;
        }
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  console.log('✅ Orders seeded');
}

function getStatusChain(targetStatus, cancelFrom) {
  const chain = {
    'new': [],
    'awaiting_payment': ['awaiting_payment'],
    'paid': ['awaiting_payment', 'paid'],
    'purchased': ['awaiting_payment', 'paid', 'purchased'],
    'shipped_from_china': ['awaiting_payment', 'paid', 'purchased', 'shipped_from_china'],
    'in_transit': ['awaiting_payment', 'paid', 'purchased', 'shipped_from_china', 'in_transit'],
    'arrived_warehouse': ['awaiting_payment', 'paid', 'purchased', 'shipped_from_china', 'in_transit', 'arrived_warehouse'],
    'delivered': ['awaiting_payment', 'paid', 'purchased', 'shipped_from_china', 'in_transit', 'arrived_warehouse', 'delivered'],
    'cancelled': getCancelChain(cancelFrom),
  };
  return chain[targetStatus] || [];
}

function getCancelChain(cancelFrom) {
  const cancelChains = {
    'new': ['cancelled'],
    'awaiting_payment': ['awaiting_payment', 'cancelled'],
    'paid': ['awaiting_payment', 'paid', 'cancelled'],
    'purchased': ['awaiting_payment', 'paid', 'purchased', 'cancelled'],
  };
  return cancelChains[cancelFrom] || ['cancelled'];
}

export { seedOrders };