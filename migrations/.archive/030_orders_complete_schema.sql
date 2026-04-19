-- ============================================================
-- Migration 030 - MIGRATION FINALE COMPLÈTE ORDERS TABLE
-- Contient TOUS les champs nécessaires pour la table orders
-- ============================================================

DO $$ 
DECLARE
  v_column_exists boolean;
BEGIN
  
  -- ============ COLONNES ESSENTIELLES COMMANDE ============
  
  -- user_id (Foreign Key vers users)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
    ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- total_price (Prix total de la commande)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_price') THEN
    ALTER TABLE orders ADD COLUMN total_price DECIMAL(10, 2) NOT NULL DEFAULT 0;
  END IF;

  -- ============ COLONNES STATUT COMMANDE ============
  
  -- status (pending, processing, shipped, delivered, cancelled)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') THEN
    ALTER TABLE orders ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';
  END IF;

  -- payment_status (unpaid, paid, refunded)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'unpaid';
  END IF;

  -- payment_method (card, paypal, apple, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50);
  END IF;

  -- fulfillment_status (pending, processing, shipped, delivered, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'fulfillment_status') THEN
    ALTER TABLE orders ADD COLUMN fulfillment_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  -- ============ COLONNES INFORMATIONS CLIENT ============
  
  -- first_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'first_name') THEN
    ALTER TABLE orders ADD COLUMN first_name VARCHAR(100);
  END IF;

  -- last_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'last_name') THEN
    ALTER TABLE orders ADD COLUMN last_name VARCHAR(100);
  END IF;

  -- email
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'email') THEN
    ALTER TABLE orders ADD COLUMN email VARCHAR(255);
  END IF;

  -- customer_email (alias pour email si besoin)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_email') THEN
    ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
  END IF;

  -- phone
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'phone') THEN
    ALTER TABLE orders ADD COLUMN phone VARCHAR(20);
  END IF;

  -- ============ COLONNES ADRESSE LIVRAISON ============
  
  -- shipping_address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address') THEN
    ALTER TABLE orders ADD COLUMN shipping_address TEXT;
  END IF;

  -- city
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'city') THEN
    ALTER TABLE orders ADD COLUMN city VARCHAR(100);
  END IF;

  -- postal_code
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'postal_code') THEN
    ALTER TABLE orders ADD COLUMN postal_code VARCHAR(20);
  END IF;

  -- country
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'country') THEN
    ALTER TABLE orders ADD COLUMN country VARCHAR(100) DEFAULT 'France';
  END IF;

  -- ============ COLONNES GÉOLOCALISATION ============
  
  -- latitude
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'latitude') THEN
    ALTER TABLE orders ADD COLUMN latitude DECIMAL(10, 8);
  END IF;

  -- longitude
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'longitude') THEN
    ALTER TABLE orders ADD COLUMN longitude DECIMAL(11, 8);
  END IF;

  -- ============ COLONNES SUIVI/NOTES ============
  
  -- tracking_number (Numéro de suivi)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(255);
  END IF;

  -- shipping_method
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_method') THEN
    ALTER TABLE orders ADD COLUMN shipping_method VARCHAR(100);
  END IF;

  -- notes (Notes de la commande)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'notes') THEN
    ALTER TABLE orders ADD COLUMN notes TEXT;
  END IF;

  -- ============ COLONNES SHOPIFY SYNC ============
  
  -- shopify_order_id (ID Shopify de la commande)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shopify_order_id') THEN
    ALTER TABLE orders ADD COLUMN shopify_order_id BIGINT UNIQUE;
  END IF;

  -- ============ COLONNES TIMESTAMPS ============
  
  -- created_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'created_at') THEN
    ALTER TABLE orders ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updated_at') THEN
    ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

END $$;

-- ============ INDEXES POUR PERFORMANCE ============

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- ============ TRIGGER POUR UPDATED_AT ============

CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_orders_updated_at();

COMMIT;