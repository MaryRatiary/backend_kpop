-- ============================================
-- Migration Shopify Integration
-- ============================================

-- Table pour mapper les produits locaux avec Shopify
CREATE TABLE IF NOT EXISTS shopify_products (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shopify_id BIGINT UNIQUE NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, shopify_id)
);

-- Table pour stocker les commandes Shopify
CREATE TABLE IF NOT EXISTS shopify_orders (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT UNIQUE NOT NULL,
  customer_email VARCHAR(255),
  total_price DECIMAL(10, 2),
  currency VARCHAR(3),
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les articles de commande Shopify
CREATE TABLE IF NOT EXISTS shopify_order_items (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL REFERENCES shopify_orders(shopify_order_id) ON DELETE CASCADE,
  product_title VARCHAR(255),
  quantity INTEGER,
  price DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les expéditions
CREATE TABLE IF NOT EXISTS shopify_shipments (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT UNIQUE NOT NULL REFERENCES shopify_orders(shopify_order_id) ON DELETE CASCADE,
  tracking_number VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les remboursements
CREATE TABLE IF NOT EXISTS shopify_refunds (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL REFERENCES shopify_orders(shopify_order_id) ON DELETE CASCADE,
  amount DECIMAL(10, 2),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les webhooks logs
CREATE TABLE IF NOT EXISTS shopify_webhook_logs (
  id SERIAL PRIMARY KEY,
  webhook_type VARCHAR(100),
  payload JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX idx_shopify_orders_status ON shopify_orders(status);
CREATE INDEX idx_shopify_orders_created ON shopify_orders(created_at DESC);
CREATE INDEX idx_shopify_order_items_order ON shopify_order_items(shopify_order_id);
CREATE INDEX idx_shopify_products_mapping ON shopify_products(product_id, shopify_id);

-- Insertion de la migration dans schema_migrations
INSERT INTO schema_migrations (name, applied_at) 
VALUES ('021_shopify_integration', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
