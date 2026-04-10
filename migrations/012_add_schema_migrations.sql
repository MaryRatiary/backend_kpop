-- ============================================================
-- MIGRATION 012 - TABLE DE SUIVI DES MIGRATIONS (COMPATIBLE)
-- ============================================================
-- Assure la compatibilité avec init-db.js qui utilise la colonne 'version'

-- Vérifier si la table schema_migrations existe avec la bonne structure
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    CREATE TABLE schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  END IF;
END $$;

-- Créer un index pour une recherche rapide
CREATE INDEX IF NOT EXISTS idx_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON schema_migrations(executed_at);
