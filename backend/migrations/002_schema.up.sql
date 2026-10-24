-- 002_schema.up.sql
-- Full database schema for China Orders (15 tables)

-- 1. roles
CREATE TABLE roles (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. users
CREATE TABLE users (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. addresses
CREATE TABLE addresses (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('delivery', 'billing')),
    country VARCHAR(100) NOT NULL DEFAULT 'Россия',
    region VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    street VARCHAR(255),
    building VARCHAR(50),
    apartment VARCHAR(50),
    postal_code VARCHAR(20),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. marketplaces
CREATE TABLE marketplaces (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. products
CREATE TABLE products (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    marketplace_id INT NOT NULL REFERENCES marketplaces(id) ON DELETE RESTRICT,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    price_cny NUMERIC(12,2) NOT NULL CHECK (price_cny > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
    sku VARCHAR(100),
    weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
    main_image_url VARCHAR(500),
    images JSONB NOT NULL DEFAULT '[]',
    attributes JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (marketplace_id, external_id)
);

-- 6. carts
CREATE TABLE carts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. cart_items
CREATE TABLE cart_items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    selected_attributes JSONB NOT NULL DEFAULT '{}',
    price_cny_at_add NUMERIC(12,2) NOT NULL CHECK (price_cny_at_add >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, product_id, selected_attributes)
);

-- 8. order_statuses
CREATE TABLE order_statuses (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_ru VARCHAR(100) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. exchange_rates (must be before orders for FK)
CREATE TABLE exchange_rates (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    base_currency VARCHAR(3) NOT NULL DEFAULT 'CNY',
    target_currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    rate NUMERIC(12,6) NOT NULL CHECK (rate > 0),
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('cbr', 'manual')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (base_currency, target_currency, valid_from)
);

-- 10. delivery_tariffs (must be before orders for FK)
CREATE TABLE delivery_tariffs (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name VARCHAR(100) NOT NULL UNIQUE,
    min_weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (min_weight_kg >= 0),
    max_weight_kg NUMERIC(10,3) CHECK (max_weight_kg > min_weight_kg),
    base_cost_rub NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_cost_rub >= 0),
    per_kg_cost_rub NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (per_kg_cost_rub >= 0),
    min_days INT NOT NULL DEFAULT 0 CHECK (min_days >= 0),
    max_days INT NOT NULL DEFAULT 0 CHECK (max_days >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. orders
CREATE TABLE orders (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status_id INT NOT NULL REFERENCES order_statuses(id) ON DELETE RESTRICT DEFAULT 1,
    exchange_rate_id INT REFERENCES exchange_rates(id) ON DELETE RESTRICT,
    delivery_tariff_id INT REFERENCES delivery_tariffs(id) ON DELETE RESTRICT,
    subtotal_cny NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal_cny >= 0),
    exchange_rate_used NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK (exchange_rate_used >= 0),
    commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_percent >= 0),
    delivery_cost_rub NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_cost_rub >= 0),
    total_rub NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_rub >= 0),
    shipping_address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    manager_comment TEXT,
    customer_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

-- 12. order_items
CREATE TABLE order_items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    selected_attributes JSONB NOT NULL DEFAULT '{}',
    price_cny NUMERIC(12,2) NOT NULL CHECK (price_cny >= 0),
    weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. order_status_history
CREATE TABLE order_status_history (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status_id INT NOT NULL REFERENCES order_statuses(id) ON DELETE RESTRICT,
    changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. payments
CREATE TABLE payments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('mock', 'card', 'sbp')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    amount_rub NUMERIC(12,2) NOT NULL CHECK (amount_rub >= 0),
    external_id VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- 15. shipments
CREATE TABLE shipments (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tracking_number VARCHAR(100),
    carrier VARCHAR(50) CHECK (carrier IN ('cdek', 'russian_post', 'ems', 'other')),
    weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
    declared_value_cny NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (declared_value_cny >= 0),
    shipped_at TIMESTAMPTZ,
    estimated_arrival TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_products_marketplace_id ON products(marketplace_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_price_cny ON products(price_cny);
CREATE INDEX idx_products_search ON products USING GIN (to_tsvector('russian', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status_id ON orders(status_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_user_status_date ON orders(user_id, status_id, created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX idx_exchange_rates_active ON exchange_rates(base_currency, target_currency, is_active) WHERE is_active;
CREATE INDEX idx_delivery_tariffs_active ON delivery_tariffs(is_active) WHERE is_active;

-- Comments
COMMENT ON TABLE roles IS 'Справочник ролей пользователей';
COMMENT ON TABLE users IS 'Пользователи системы';
COMMENT ON TABLE addresses IS 'Адреса доставки/биллинга пользователей';
COMMENT ON TABLE marketplaces IS 'Поддерживаемые китайские маркетплейсы';
COMMENT ON TABLE products IS 'Товары (импортированные или созданные вручную)';
COMMENT ON TABLE carts IS 'Корзины пользователей (одна на пользователя)';
COMMENT ON TABLE cart_items IS 'Позиции в корзине с зафиксированной ценой на момент добавления';
COMMENT ON TABLE order_statuses IS 'Справочник статусов заказа';
COMMENT ON TABLE orders IS 'Заказы клиентов с снимками курсов/тарифов на момент оформления';
COMMENT ON TABLE order_items IS 'Позиции заказа с ценами и весом на момент заказа';
COMMENT ON TABLE order_status_history IS 'Аудит смены статусов заказов (заполняется триггером)';
COMMENT ON TABLE payments IS 'Платёжные попытки (мок/карта/СБП)';
COMMENT ON TABLE shipments IS 'Отправления/логистика с трек-номерами';
COMMENT ON TABLE exchange_rates IS 'История курсов валют CNY->RUB';
COMMENT ON TABLE delivery_tariffs IS 'Тарифы доставки по весовым интервалам';