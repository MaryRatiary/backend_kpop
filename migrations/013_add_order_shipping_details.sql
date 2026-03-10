-- ============================================================
-- MIGRATION 013 - AJOUTER LES DÉTAILS DE LIVRAISON À ORDERS
-- ============================================================
-- Ajoute les colonnes manquantes pour les détails de livraison
-- et de contact dans la table orders
-- Date: 2026-03-10

-- Ajouter les colonnes de détails de livraison et de contact
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS "firstName" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "lastName" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "postalCode" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Créer des index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_firstname ON orders("firstName");

-- ============================================================
-- Confirmation
-- ============================================================
-- Colonnes ajoutées à la table orders :
-- - firstName, lastName
-- - email, phone
-- - city, postalCode, country
-- - latitude, longitude
-- - notes
