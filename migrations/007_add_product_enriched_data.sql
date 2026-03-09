-- Migration: Ajouter les colonnes produit enrichies (brand, material, careInstructions)
-- Date: 2026-03-09
-- Description: Ajoute les colonnes pour les données enrichies des produits

ALTER TABLE products
ADD COLUMN IF NOT EXISTS brand VARCHAR(255),
ADD COLUMN IF NOT EXISTS material VARCHAR(255),
ADD COLUMN IF NOT EXISTS careInstructions TEXT;

-- Créer des index pour les colonnes couramment requêtes
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;