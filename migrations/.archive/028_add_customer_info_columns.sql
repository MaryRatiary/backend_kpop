-- ============================================================
-- Migration 028 - Ajouter les colonnes d'informations client
-- ============================================================

DO $$ BEGIN
  -- first_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN first_name VARCHAR(100);
  END IF;

  -- last_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN last_name VARCHAR(100);
  END IF;

  -- phone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN phone VARCHAR(20);
  END IF;

  -- city
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'city'
  ) THEN
    ALTER TABLE orders ADD COLUMN city VARCHAR(100);
  END IF;

  -- postal_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN postal_code VARCHAR(20);
  END IF;

  -- country
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'country'
  ) THEN
    ALTER TABLE orders ADD COLUMN country VARCHAR(100) DEFAULT 'France';
  END IF;

  -- latitude
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE orders ADD COLUMN latitude DECIMAL(10, 8);
  END IF;

  -- longitude
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE orders ADD COLUMN longitude DECIMAL(11, 8);
  END IF;

END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_first_name ON orders(first_name);
CREATE INDEX IF NOT EXISTS idx_orders_last_name ON orders(last_name);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_country ON orders(country);

COMMIT;
