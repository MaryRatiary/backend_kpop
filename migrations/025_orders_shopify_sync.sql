-- Table pour tracker la synchronisation des commandes vers Shopify
CREATE TABLE IF NOT EXISTS orders_to_shopify_sync (
  id SERIAL PRIMARY KEY,
  local_order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  shopify_order_id BIGINT UNIQUE,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'completed', 'failed', 'retrying')),
  error_message TEXT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  retried_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders_to_shopify_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_orders_sync_local_id ON orders_to_shopify_sync(local_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_sync_shopify_id ON orders_to_shopify_sync(shopify_order_id);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_orders_to_shopify_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_sync_updated_at ON orders_to_shopify_sync;
CREATE TRIGGER trigger_orders_sync_updated_at
BEFORE UPDATE ON orders_to_shopify_sync
FOR EACH ROW
EXECUTE FUNCTION update_orders_to_shopify_sync_updated_at();

-- Insertion initiale pour les commandes existantes non synchronisées
INSERT INTO orders_to_shopify_sync (local_order_id, sync_status)
SELECT id, 'pending'
FROM orders
WHERE id NOT IN (SELECT COALESCE(local_order_id, 0) FROM orders_to_shopify_sync)
ON CONFLICT DO NOTHING;

COMMIT;
