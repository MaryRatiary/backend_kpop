-- Migration: Initialiser les valeurs order pour les catégories existantes

-- Pour chaque groupe de catégories au même niveau (même parentId),
-- attribuer des numéros d'ordre séquentiels
WITH category_groups AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(parentId, -1) ORDER BY id ASC) - 1 as new_order
  FROM categories
)
UPDATE categories
SET "order" = category_groups.new_order
FROM category_groups
WHERE categories.id = category_groups.id;