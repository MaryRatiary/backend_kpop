-- ============================================================
-- Migration 026 - Ajouter les colonnes manquantes à orders
-- ============================================================

DO $$ BEGIN
  -- Ajouter total_price si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE orders ADD COLUMN total_price DECIMAL(10, 2);
  END IF;

  -- Ajouter status si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'status'
  ) THEN
    ALTER TABLE orders ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
  END IF;

  -- Ajouter shipping_address si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shipping_address'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_address TEXT;
  END IF;

  -- Ajouter created_at si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Ajouter updated_at si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

END $$;

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

COMMIT;
