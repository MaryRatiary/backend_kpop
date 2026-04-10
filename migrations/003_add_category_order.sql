-- Migration: Ajouter une colonne order pour gérer l'affichage des catégories

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'order') THEN
    ALTER TABLE categories ADD COLUMN "order" INTEGER DEFAULT 0;
  END IF;
END $$;

-- Créer un index sur la colonne order pour optimiser le tri
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order");
