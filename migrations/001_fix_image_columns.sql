-- Migration: Augmenter la taille des colonnes image pour supporter les images base64

-- Modifier la colonne image de la table categories
ALTER TABLE categories 
  ALTER COLUMN image TYPE TEXT;

-- Modifier la colonne image de la table kpop_groups
ALTER TABLE kpop_groups 
  ALTER COLUMN image TYPE TEXT;

-- Modifier la colonne imageUrl de la table product_images
ALTER TABLE product_images 
  ALTER COLUMN imageUrl TYPE TEXT;

-- Ajouter les colonnes manquantes à la table categories si elles n'existent pas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'parentId') THEN
    ALTER TABLE categories ADD COLUMN parentId INTEGER REFERENCES categories(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'level') THEN
    ALTER TABLE categories ADD COLUMN level INTEGER DEFAULT 0;
  END IF;
END $$;

-- Créer l'index pour parentId si nécessaire
CREATE INDEX IF NOT EXISTS idx_categories_parentId ON categories(parentId);
