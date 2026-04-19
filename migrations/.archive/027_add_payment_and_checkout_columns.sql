-- ============================================================
-- Migration 027 - Ajouter les colonnes payment et checkout
-- ============================================================

DO $$ BEGIN
  -- payment_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50);
  END IF;

  -- payment_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  -- customer_email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
  END IF;

  -- fulfillment_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'fulfillment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN fulfillment_status VARCHAR(50) DEFAULT 'pending';
  END IF;

  -- shipping_method
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shipping_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_method VARCHAR(100);
  END IF;

  -- notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes TEXT;
  END IF;

  -- shopify_order_id (pour synchronisation)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shopify_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN shopify_order_id BIGINT UNIQUE;
  END IF;

END $$;

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON orders(shopify_order_id);

COMMIT;
