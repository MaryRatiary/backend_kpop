-- Migration: Remplir le stock des variantes (tailles et couleurs)
-- Date: 2026-03-12
-- Description: Ajoute du stock par défaut aux tailles et couleurs existantes

-- Remplir le stock des tailles avec des valeurs réalistes
UPDATE product_sizes 
SET stock = CASE 
  WHEN size IN ('XS', 'XXL') THEN 8  -- Tailles moins populaires
  WHEN size IN ('S', 'XL') THEN 12   -- Tailles moyennement populaires
  ELSE 15                             -- Tailles M, L plus populaires
END
WHERE stock = 0;

-- Remplir le stock des couleurs avec des valeurs réalistes
UPDATE product_colors 
SET stock = CASE 
  WHEN colorname IN ('noir', 'Noir', 'Black', 'black') THEN 20  -- Les noirs se vendent plus
  WHEN colorname IN ('blanc', 'Blanc', 'White', 'white') THEN 18
  ELSE 10                                                         -- Autres couleurs
END
WHERE stock = 0;

-- Vérifier les résultats
SELECT 
  'Tailles mises à jour' as type,
  COUNT(*) as count,
  AVG(stock) as stock_moyen
FROM product_sizes
UNION ALL
SELECT 
  'Couleurs mises à jour',
  COUNT(*),
  AVG(stock)
FROM product_colors;
