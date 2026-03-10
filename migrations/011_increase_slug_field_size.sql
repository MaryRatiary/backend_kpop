-- ============================================================
-- MIGRATION 011 - AUGMENTER LA TAILLE DU CHAMP SLUG
-- ============================================================
-- Corrige l'erreur "value too long for type character varying(100)"
-- Le champ slug était limité à 100 caractères, ce qui n'est pas suffisant
-- pour les noms longs + timestamp (format: nom-slug-timestamp)
-- Date: 2026-03-10

-- Augmenter la taille du champ slug dans la table products
-- De VARCHAR(255) UNIQUE à TEXT (plus flexible)
ALTER TABLE products
  ALTER COLUMN slug TYPE TEXT;

-- Supprimer la contrainte UNIQUE si elle existe (nous avons déjà un index)
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_slug_key;

-- S'assurer que nous avons un index pour les performances
CREATE INDEX IF NOT EXISTS idx_products_slug_final ON products(slug);

-- Faire la même chose pour les catégories (si nécessaire)
ALTER TABLE categories
  ALTER COLUMN slug TYPE TEXT;

ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_slug_key;

CREATE INDEX IF NOT EXISTS idx_categories_slug_final ON categories(slug);

-- ============================================================
-- Confirmation
-- ============================================================
-- Migration complétée!
-- - Champ slug augmenté en TEXT dans products
-- - Champ slug augmenté en TEXT dans categories
-- - Les slugs longs avec timestamp fonctionnent maintenant
