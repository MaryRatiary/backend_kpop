-- ============================================================
-- MIGRATION 023 - FIX SCHEMA MIGRATIONS TABLE & FORCE REVIEWS
-- ============================================================
-- Cette migration corrige les problèmes de migration précédentes

-- Étape 1: Vérifier et recréer la table schema_migrations avec la bonne structure
-- (nécessaire car la migration 012 avait une structure incompatible)
DROP TABLE IF EXISTS schema_migrations_backup;
CREATE TABLE IF NOT EXISTS schema_migrations_backup AS SELECT * FROM schema_migrations WHERE FALSE;

-- Supprimer l'ancienne table si elle existe
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- Créer la nouvelle table avec la bonne structure
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  migration VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_migrations_migration ON schema_migrations(migration);
CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON schema_migrations(executed_at);

-- Étape 2: Vérifier que les tables reviews existent
-- Si elles n'existent pas, les créer

-- Table reviews
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  helpful INTEGER DEFAULT 0,
  notHelpful INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table review_images
CREATE TABLE IF NOT EXISTS review_images (
  id SERIAL PRIMARY KEY,
  reviewId INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  imageUrl TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);
CREATE INDEX IF NOT EXISTS idx_reviews_userId ON reviews(userId);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_review_images_reviewId ON review_images(reviewId);

-- Ajouter les colonnes averageRating et reviewCount aux produits s'ils n'existent pas
ALTER TABLE products ADD COLUMN IF NOT EXISTS averageRating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewCount INTEGER DEFAULT 0;

-- Enregistrer les migrations comme exécutées
INSERT INTO schema_migrations (migration) VALUES 
  ('012_add_schema_migrations.sql'),
  ('022_add_reviews.sql'),
  ('023_fix_schema_migrations_and_reviews.sql')
ON CONFLICT (migration) DO NOTHING;

-- Vérification finale
SELECT COUNT(*) as "Total migrations" FROM schema_migrations;
SELECT 'reviews table' as "Table", COUNT(*) as "Rows" FROM reviews UNION ALL
SELECT 'review_images table' as "Table", COUNT(*) as "Rows" FROM review_images;
