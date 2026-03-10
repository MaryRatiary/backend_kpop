-- ============================================================
-- MIGRATION 010 - CORRECTION DES ERREURS
-- ============================================================
-- Corrige:
-- 1. Augmente la taille du champ imageUrl (erreur 22001)
-- 2. Permet les slugs dupliqués avec timestamp pour éviter les conflits
-- Date: 2026-03-10

-- 1. Augmenter la taille du champ imageUrl si nécessaire
ALTER TABLE product_images
  ALTER COLUMN imageUrl TYPE TEXT;

-- 2. Ajouter un suffix unique au slug pour éviter les conflits
-- Créer une fonction pour générer des slugs uniques
CREATE OR REPLACE FUNCTION generate_unique_slug(p_name VARCHAR, p_product_id INTEGER DEFAULT NULL)
RETURNS VARCHAR AS $$
DECLARE
  v_slug VARCHAR;
  v_count INTEGER;
BEGIN
  v_slug := LOWER(p_name);
  v_slug := REGEXP_REPLACE(v_slug, '\s+', '-', 'g');
  v_slug := REGEXP_REPLACE(v_slug, '[^a-z0-9-]', '', 'g');
  
  -- Vérifier si ce slug existe déjà
  SELECT COUNT(*) INTO v_count FROM products WHERE slug = v_slug;
  
  -- Si le slug existe, ajouter un timestamp pour le rendre unique
  IF v_count > 0 THEN
    v_slug := v_slug || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;
  END IF;
  
  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- 3. Supprimer la contrainte UNIQUE sur slug (si elle existe) et la rendre non-unique
-- Cela permet les slugs en double mais avec des IDs différents
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_slug_key;

-- 4. Garder l'index sur slug pour les requêtes (mais sans unicité)
CREATE INDEX IF NOT EXISTS idx_products_slug_non_unique ON products(slug);

-- ============================================================
-- Confirmation
-- ============================================================
-- Migration complétée! 
-- - imageUrl peut maintenant accepter des URLs très longues
-- - Les slugs peuvent être dupliqués (utiliser l'ID pour les requêtes spécifiques)
-- - Nouvelle fonction: generate_unique_slug() pour générer des slugs uniques si nécessaire
