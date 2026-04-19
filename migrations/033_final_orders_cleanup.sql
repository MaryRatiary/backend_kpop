-- ============================================================
-- Migration 033 - NETTOYAGE FINAL ET PROPRE DE LA TABLE ORDERS
-- 
-- Cette migration:
-- 1. Supprime TOUS les doublons/mauvaises colonnes
-- 2. Garde UNIQUEMENT les bonnes colonnes en snake_case
-- 3. Utilise DROP COLUMN IF EXISTS pour éviter les erreurs
-- ============================================================

BEGIN;

-- ============================================================
-- ÉTAPE 1: Supprimer TOUTES les mauvaises colonnes
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
-- ÉTAPE 2: AJOUTER les bonnes colonnes en snake_case
-- ============================================================

-- Ajouter user_id si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Ajouter total_price si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Ajouter status si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending';

-- Ajouter payment_method si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- Ajouter payment_status si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

-- Ajouter fulfillment_status si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'pending';

-- Ajouter shipping_address si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;

-- Ajouter shipping_method si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(100);

-- Ajouter tracking_number si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255);

-- Ajouter first_name si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);

-- Ajouter last_name si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

-- Ajouter email si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Ajouter customer_email si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

-- Ajouter phone si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Ajouter city si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Ajouter postal_code si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

-- Ajouter country si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'France';

-- Ajouter latitude si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);

-- Ajouter longitude si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Ajouter notes si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ajouter shopify_order_id si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_order_id BIGINT;

-- Ajouter created_at si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Ajouter updated_at si manquante
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================
-- ÉTAPE 3: Supprimer les anciens indexes (s'ils existent)
-- ============================================================

DROP INDEX IF EXISTS idx_orders_user_id;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_payment_status;
DROP INDEX IF EXISTS idx_orders_fulfillment_status;
DROP INDEX IF EXISTS idx_orders_email;
DROP INDEX IF EXISTS idx_orders_customer_email;
DROP INDEX IF EXISTS idx_orders_city;
DROP INDEX IF EXISTS idx_orders_country;
DROP INDEX IF EXISTS idx_orders_shopify_id;
DROP INDEX IF EXISTS idx_orders_created_at;
DROP INDEX IF EXISTS idx_orders_updated_at;
DROP INDEX IF EXISTS idx_orders_tracking_number;
DROP INDEX IF EXISTS idx_orders_first_name;
DROP INDEX IF EXISTS idx_orders_last_name;

-- ============================================================
-- ÉTAPE 4: Créer les nouveaux indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- ============================================================
-- ÉTAPE 5: Recréer le trigger pour updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
DROP FUNCTION IF EXISTS update_orders_updated_at();

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
-- ÉTAPE 6: Enregistrer la migration
-- ============================================================

INSERT INTO schema_migrations (name, applied_at) 
VALUES ('033_final_orders_cleanup', CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ÉTAPE 7: Afficher les colonnes finales (pour vérification)
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
