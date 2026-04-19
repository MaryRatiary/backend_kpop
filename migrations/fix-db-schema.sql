-- ============================================================
-- FIX AUTO - Exécuter à chaque déploiement
-- ============================================================

-- 1. FIXER schema_migrations - Assurer que TOUTES les colonnes existent
DO $$ BEGIN
  -- Ajouter 'version' si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schema_migrations' AND column_name = 'version'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN version VARCHAR(255) UNIQUE;
  END IF;

  -- Ajouter 'name' si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schema_migrations' AND column_name = 'name'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN name VARCHAR(255);
  END IF;

  -- Ajouter 'applied_at' si manquante (alias pour executed_at)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schema_migrations' AND column_name = 'applied_at'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- Ajouter 'migration' si manquante
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'schema_migrations' AND column_name = 'migration'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN migration VARCHAR(255);
  END IF;

END $$;

-- 2. FIXER orders table - Ajouter user_id si manquante
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN orders.user_id IS 'Link to user who placed the order';
  END IF;
END $$;

-- 3. Ajouter les indexes s'ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(name);

-- Log de succès
DO $$ BEGIN
  RAISE NOTICE 'Schema fix completed successfully!';
END $$;

COMMIT;