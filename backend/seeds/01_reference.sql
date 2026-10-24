-- 01_reference.sql
-- Reference data seed (idempotent)

-- roles
INSERT INTO roles (name, description) VALUES
('customer', 'Regular customer'),
('manager', 'Order manager'),
('admin', 'System administrator')
ON CONFLICT (name) DO NOTHING;

-- order_statuses: new must be id=1 (orders.status_id default = 1)
INSERT INTO order_statuses (code, name_ru, sort_order, is_final, is_cancelled) VALUES
('new', 'Новый', 1, FALSE, FALSE),
('awaiting_payment', 'Ожидает оплаты', 2, FALSE, FALSE),
('paid', 'Оплачен', 3, FALSE, FALSE),
('purchased', 'Выкуплен', 4, FALSE, FALSE),
('shipped_from_china', 'Отправлен из Китая', 5, FALSE, FALSE),
('in_transit', 'В пути', 6, FALSE, FALSE),
('arrived_warehouse', 'Прибыл на склад', 7, FALSE, FALSE),
('delivered', 'Выдан', 8, TRUE, FALSE),
('cancelled', 'Отменён', 9, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- marketplaces
INSERT INTO marketplaces (code, name, base_url, is_active) VALUES
('taobao', 'Taobao', 'https://www.taobao.com', TRUE),
('tmall', 'Tmall', 'https://www.tmall.com', TRUE),
('1688', '1688', 'https://www.1688.com', TRUE),
('pinduoduo', 'Pinduoduo', 'https://www.pinduoduo.com', TRUE),
('jd', 'JD.com', 'https://www.jd.com', TRUE),
('poizon', 'Poizon', 'https://www.poizon.com', TRUE)
ON CONFLICT (code) DO NOTHING;

-- exchange_rates: one active CNY->RUB
INSERT INTO exchange_rates (base_currency, target_currency, rate, source, is_active, valid_from) VALUES
('CNY', 'RUB', 12.50, 'manual', TRUE, NOW())
ON CONFLICT (base_currency, target_currency, valid_from) DO NOTHING;

-- delivery_tariffs: 3 tariffs by weight
INSERT INTO delivery_tariffs (name, min_weight_kg, max_weight_kg, base_cost_rub, per_kg_cost_rub, min_days, max_days, is_active) VALUES
('До 1 кг', 0, 1, 300, 150, 14, 21, TRUE),
('1–5 кг', 1, 5, 500, 100, 14, 21, TRUE),
('5+ кг', 5, NULL, 900, 80, 14, 21, TRUE)
ON CONFLICT (name) DO NOTHING;