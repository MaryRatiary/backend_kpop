-- Migration: Ajouter une colonne order pour gérer l'affichage des catégories

ALTER TABLE categories ADD COLUMN "order" INTEGER DEFAULT 0;

-- Créer un index sur la colonne order pour optimiser le tri
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order");