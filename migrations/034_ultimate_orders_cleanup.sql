-- ============================================================
-- Migration 034 - NETTOYAGE ULTIME ET DÉFINITIF
-- 
-- Supprime toutes les migrations erronées (031-033) et 
-- recrée la table orders PROPRE et sans doublons
-- ============================================================

BEGIN;

-- ============================================================
-- ÉTAPE 0: NETTOYER les migrations erronées de schema_migrations
-- ============================================================

DELETE FROM schema_migrations WHERE name IN (
  '031_clean_orders_schema',
  '032_fix_orders_duplicates', 
  '033_final_orders_cleanup'
);

-- ============================================================
-- ÉTAPE 1: Supprimer TOUS les mauvaises colonnes
-- ============================================================

-- Supprimer les colonnes en camelCase (guillemets)
ALTER TABLE orders DROP COLUMN IF EXISTS "userId" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "firstName" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "lastName" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "postalCode" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "shippingAddress" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "paymentMethod" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "paymentStatus" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "createdAt" CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS "updatedAt" CASCADE;

-- Supprimer les colonnes en lowercase (sans underscores)
ALTER TABLE orders DROP COLUMN IF EXISTS userid CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS firstname CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS lastname CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS postalcode CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS shippingaddress CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS paymentmethod CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS paymentstatus CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS createdat CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS updatedat CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS totalprice CASCADE;
ALTER TABLE orders DROP COLUMN IF EXISTS trackingnumber CASCADE;

-- ============================================================
-- ÉTAPE 2: AJOUTER les bonnes colonnes en snake_case (IF NOT EXISTS)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'France';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_order_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- ÉTAPE 3: Recréer les indexes
-- ============================================================

DROP INDEX IF EXISTS idx_orders_user_id CASCADE;
DROP INDEX IF EXISTS idx_orders_status CASCADE;
DROP INDEX IF EXISTS idx_orders_payment_status CASCADE;
DROP INDEX IF EXISTS idx_orders_fulfillment_status CASCADE;
DROP INDEX IF EXISTS idx_orders_email CASCADE;
DROP INDEX IF EXISTS idx_orders_customer_email CASCADE;
DROP INDEX IF EXISTS idx_orders_city CASCADE;
DROP INDEX IF EXISTS idx_orders_country CASCADE;
DROP INDEX IF EXISTS idx_orders_shopify_id CASCADE;
DROP INDEX IF EXISTS idx_orders_created_at CASCADE;
DROP INDEX IF EXISTS idx_orders_updated_at CASCADE;
DROP INDEX IF EXISTS idx_orders_tracking_number CASCADE;

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_city ON orders(city);
CREATE INDEX idx_orders_country ON orders(country);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX idx_orders_tracking_number ON orders(tracking_number);

-- ============================================================
-- ÉTAPE 4: Recréer le trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
DROP FUNCTION IF EXISTS update_orders_updated_at() CASCADE;

CREATE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_orders_updated_at();

-- ============================================================
-- ÉTAPE 5: Enregistrer cette migration
-- ============================================================

INSERT INTO schema_migrations (name, applied_at) 
VALUES ('034_ultimate_orders_cleanup', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ============================================================
-- ÉTAPE 6: Afficher les colonnes finales (pour vérification)
-- ============================================================

SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;

COMMIT;
