-- Личный список товаров пользователя (связь многие-ко-многим users <-> products)
CREATE TABLE user_products (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_user_products_product_id ON user_products(product_id);
CREATE INDEX idx_user_products_user_created ON user_products(user_id, created_at DESC);

COMMENT ON TABLE user_products IS 'Личный список товаров пользователя (каталог клиента)';