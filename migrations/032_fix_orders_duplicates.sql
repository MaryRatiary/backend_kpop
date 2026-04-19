-- ============================================================
-- Migration 032 - SUPPRESSION DES DOUBLONS ET NETTOYAGE
-- 
-- Supprime TOUTES les colonnes en doublon/mal nommées
-- et crée une table orders propre avec les bons noms
-- ============================================================

BEGIN;

-- ============================================================
-- ÉTAPE 1: Supprimer les colonnes dupliquées/mal nommées
-- ============================================================

-- Supprimer les variations de camelCase mal nommées
DO $$ BEGIN
  -- Supprimer les variantes incorrectes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'firstName') THEN
    ALTER TABLE orders DROP COLUMN "firstName";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'firstname') THEN
    ALTER TABLE orders DROP COLUMN firstname;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'lastName') THEN
    ALTER TABLE orders DROP COLUMN "lastName";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'lastname') THEN
    ALTER TABLE orders DROP COLUMN lastname;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'postalCode') THEN
    ALTER TABLE orders DROP COLUMN "postalCode";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'postalcode') THEN
    ALTER TABLE orders DROP COLUMN postalcode;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shippingaddress') THEN
    ALTER TABLE orders DROP COLUMN shippingaddress;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentmethod') THEN
    ALTER TABLE orders DROP COLUMN paymentmethod;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentstatus') THEN
    ALTER TABLE orders DROP COLUMN paymentstatus;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'totalprice') THEN
    ALTER TABLE orders DROP COLUMN totalprice;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'trackingnumber') THEN
    ALTER TABLE orders DROP COLUMN trackingnumber;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'createdat') THEN
    ALTER TABLE orders DROP COLUMN createdat;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updatedat') THEN
    ALTER TABLE orders DROP COLUMN updatedat;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'userId') THEN
    ALTER TABLE orders DROP COLUMN "userId";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'userid') THEN
    ALTER TABLE orders DROP COLUMN userid;
  END IF;
END $$;

-- ============================================================
-- ÉTAPE 2: Ajouter les colonnes manquantes (UNIQUE snake_case)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
    ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_price') THEN
    ALTER TABLE orders ADD COLUMN total_price DECIMAL(10, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') THEN
    ALTER TABLE orders ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'unpaid';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'fulfillment_status') THEN
    ALTER TABLE orders ADD COLUMN fulfillment_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address') THEN
    ALTER TABLE orders ADD COLUMN shipping_address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_method') THEN
    ALTER TABLE orders ADD COLUMN shipping_method VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'first_name') THEN
    ALTER TABLE orders ADD COLUMN first_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'last_name') THEN
    ALTER TABLE orders ADD COLUMN last_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'email') THEN
    ALTER TABLE orders ADD COLUMN email VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'phone') THEN
    ALTER TABLE orders ADD COLUMN phone VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'city') THEN
    ALTER TABLE orders ADD COLUMN city VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'postal_code') THEN
    ALTER TABLE orders ADD COLUMN postal_code VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'country') THEN
    ALTER TABLE orders ADD COLUMN country VARCHAR(100) DEFAULT 'France';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'latitude') THEN
    ALTER TABLE orders ADD COLUMN latitude DECIMAL(10, 8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'longitude') THEN
    ALTER TABLE orders ADD COLUMN longitude DECIMAL(11, 8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'notes') THEN
    ALTER TABLE orders ADD COLUMN notes TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shopify_order_id') THEN
    ALTER TABLE orders ADD COLUMN shopify_order_id BIGINT UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'created_at') THEN
    ALTER TABLE orders ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updated_at') THEN
    ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ============================================================
-- ÉTAPE 3: Recréer les indexes
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

-- ============================================================
-- ÉTAPE 4: Recréer le trigger
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
-- ÉTAPE 5: Enregistrer la migration
-- ============================================================

INSERT INTO schema_migrations (name, applied_at) 
VALUES ('032_fix_orders_duplicates', CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

COMMIT;

-- Afficher les colonnes finales
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;
