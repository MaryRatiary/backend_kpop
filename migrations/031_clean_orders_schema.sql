-- ============================================================
-- Migration 031 - NETTOYAGE COMPLET ET FINAL DE LA TABLE ORDERS
-- 
-- Cette migration consolidate toutes les colonnes nécessaires
-- en une seule fois et supprime les redondances des migrations
-- précédentes (026, 027, 028, 030)
-- ============================================================

-- Démarrer une transaction
BEGIN;

-- ============================================================
-- ÉTAPE 1: Vérifier et corriger les noms de colonnes
-- ============================================================

-- Renommer les colonnes mal nommées (camelCase → snake_case)
-- Si "userId" existe, la renommer en "user_id"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'userId') THEN
    ALTER TABLE orders RENAME COLUMN "userId" TO user_id;
  END IF;
END $$;

-- Si "firstName" existe, la renommer en "first_name"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'firstName') THEN
    ALTER TABLE orders RENAME COLUMN "firstName" TO first_name;
  END IF;
END $$;

-- Si "lastName" existe, la renommer en "last_name"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'lastName') THEN
    ALTER TABLE orders RENAME COLUMN "lastName" TO last_name;
  END IF;
END $$;

-- Si "postalCode" existe, la renommer en "postal_code"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'postalCode') THEN
    ALTER TABLE orders RENAME COLUMN "postalCode" TO postal_code;
  END IF;
END $$;

-- Si "shippingAddress" existe, la renommer en "shipping_address"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shippingAddress') THEN
    ALTER TABLE orders RENAME COLUMN "shippingAddress" TO shipping_address;
  END IF;
END $$;

-- Si "paymentMethod" existe, la renommer en "payment_method"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentMethod') THEN
    ALTER TABLE orders RENAME COLUMN "paymentMethod" TO payment_method;
  END IF;
END $$;

-- Si "paymentStatus" existe, la renommer en "payment_status"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentStatus') THEN
    ALTER TABLE orders RENAME COLUMN "paymentStatus" TO payment_status;
  END IF;
END $$;

-- Si "createdAt" existe, la renommer en "created_at"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'createdAt') THEN
    ALTER TABLE orders RENAME COLUMN "createdAt" TO created_at;
  END IF;
END $$;

-- Si "updatedAt" existe, la renommer en "updated_at"
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updatedAt') THEN
    ALTER TABLE orders RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;

-- ============================================================
-- ÉTAPE 2: Ajouter TOUTES les colonnes manquantes (snake_case)
-- ============================================================

DO $$ BEGIN
  -- Colonnes essentielles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
    ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_price') THEN
    ALTER TABLE orders ADD COLUMN total_price DECIMAL(10, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'status') THEN
    ALTER TABLE orders ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';
  END IF;

  -- Colonnes de paiement
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'unpaid';
  END IF;

  -- Colonnes de traitement
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'fulfillment_status') THEN
    ALTER TABLE orders ADD COLUMN fulfillment_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  -- Colonnes d'adresse de livraison
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address') THEN
    ALTER TABLE orders ADD COLUMN shipping_address TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_method') THEN
    ALTER TABLE orders ADD COLUMN shipping_method VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(255);
  END IF;

  -- Colonnes d'informations client
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'first_name') THEN
    ALTER TABLE orders ADD COLUMN first_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'last_name') THEN
    ALTER TABLE orders ADD COLUMN last_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'email') THEN
    ALTER TABLE orders ADD COLUMN email VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_email') THEN
    ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'phone') THEN
    ALTER TABLE orders ADD COLUMN phone VARCHAR(20);
  END IF;

  -- Colonnes de localisation
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

  -- Colonnes de notes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'notes') THEN
    ALTER TABLE orders ADD COLUMN notes TEXT;
  END IF;

  -- Colonnes Shopify
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shopify_order_id') THEN
    ALTER TABLE orders ADD COLUMN shopify_order_id BIGINT UNIQUE;
  END IF;

  -- Colonnes timestamps
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'created_at') THEN
    ALTER TABLE orders ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updated_at') THEN
    ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- ============================================================
-- ÉTAPE 3: Créer les indexes (uniquement s'ils n'existent pas)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- ============================================================
-- ÉTAPE 4: Créer le trigger pour updated_at (s'il n'existe pas)
-- ============================================================

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

-- ============================================================
-- ÉTAPE 5: Enregistrer la migration
-- ============================================================

INSERT INTO schema_migrations (name, applied_at) 
VALUES ('031_clean_orders_schema', CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ÉTAPE 6: Afficher un résumé
-- ============================================================

-- Vérifier les colonnes finales
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- Commit la transaction
COMMIT;
