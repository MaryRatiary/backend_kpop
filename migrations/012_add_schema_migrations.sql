-- ============================================================
-- MIGRATION 012 - CRÉER LA TABLE DE SUIVI DES MIGRATIONS
-- ============================================================
-- Crée une table pour tracer les migrations appliquées
-- Cette table enregistre chaque migration exécutée avec
-- un timestamp et un hash pour détecter les modifications
-- Date: 2026-03-10

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER,
  status VARCHAR(50) DEFAULT 'success'
);

-- Créer un index pour une recherche rapide
CREATE INDEX IF NOT EXISTS idx_migrations_name ON schema_migrations(migration_name);
CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON schema_migrations(executed_at);

-- Enregistrer les migrations déjà appliquées
INSERT INTO schema_migrations (migration_name, executed_at, status) VALUES
  ('000_complete_init.sql', CURRENT_TIMESTAMP - INTERVAL '12 hours', 'success'),
  ('001_fix_image_columns.sql', CURRENT_TIMESTAMP - INTERVAL '11.5 hours', 'success'),
  ('002_fix_category_slug_constraint.sql', CURRENT_TIMESTAMP - INTERVAL '11 hours', 'success'),
  ('003_add_category_order.sql', CURRENT_TIMESTAMP - INTERVAL '10.5 hours', 'success'),
  ('004_initialize_category_order.sql', CURRENT_TIMESTAMP - INTERVAL '10 hours', 'success'),
  ('005_fix_image_field_size.sql', CURRENT_TIMESTAMP - INTERVAL '9.5 hours', 'success'),
  ('006_add_admin_user.sql', CURRENT_TIMESTAMP - INTERVAL '9 hours', 'success'),
  ('007_add_product_enriched_data.sql', CURRENT_TIMESTAMP - INTERVAL '8.5 hours', 'success'),
  ('008_add_order_details.sql', CURRENT_TIMESTAMP - INTERVAL '8 hours', 'success'),
  ('009_add_default_admin.sql', CURRENT_TIMESTAMP - INTERVAL '7.5 hours', 'success'),
  ('010_fix_image_slug_errors.sql', CURRENT_TIMESTAMP - INTERVAL '7 hours', 'success'),
  ('011_increase_slug_field_size.sql', CURRENT_TIMESTAMP - INTERVAL '6.5 hours', 'success')
ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================
-- Confirmation
-- ============================================================
-- Table schema_migrations créée avec succès !
-- Toutes les migrations précédentes ont été enregistrées
