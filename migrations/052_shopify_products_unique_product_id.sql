-- ============================================================
-- Migration 052 - Contrainte UNIQUE product_id sur shopify_products
-- (Pour les bases existantes où la table existe déjà sans contrainte)
-- ============================================================

BEGIN;

-- Créer les tables Shopify si elles n'existent pas encore
CREATE TABLE IF NOT EXISTS shopify_products (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  shopify_id BIGINT UNIQUE NOT NULL,
  title VARCHAR(255),
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopify_orders (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT UNIQUE NOT NULL,
  customer_email VARCHAR(255),
  total_price VARCHAR(50),
  currency VARCHAR(10),
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopify_order_items (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  product_title VARCHAR(255),
  quantity INTEGER,
  price VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopify_shipments (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT UNIQUE NOT NULL,
  tracking_number VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopify_refunds (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL,
  amount VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ajouter la contrainte UNIQUE sur product_id si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'shopify_products_product_id_unique'
  ) THEN
    ALTER TABLE shopify_products
      ADD CONSTRAINT shopify_products_product_id_unique UNIQUE (product_id);
  END IF;
END $$;

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_shopify_products_product_id ON shopify_products(product_id);
CREATE INDEX IF NOT EXISTS idx_shopify_products_shopify_id ON shopify_products(shopify_id);

COMMIT;