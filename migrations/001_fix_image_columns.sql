-- Migration: Augmenter la taille des colonnes image pour supporter les images base64

-- Modifier la colonne image de la table categories
ALTER TABLE categories 
  ALTER COLUMN image TYPE TEXT;

-- Modifier la colonne image de la table kpop_groups (si elle existe)
DO $$ BEGIN
  ALTER TABLE kpop_groups 
    ALTER COLUMN image TYPE TEXT;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Modifier la colonne imageUrl de la table product_images (si elle existe)
DO $$ BEGIN
  ALTER TABLE product_images 
    ALTER COLUMN imageUrl TYPE TEXT;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Ajouter la colonne parentId à la table categories si elle n'existe pas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'parentid') THEN
    ALTER TABLE categories ADD COLUMN parentId INTEGER REFERENCES categories(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ajouter la colonne level à la table categories si elle n'existe pas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'level') THEN
    ALTER TABLE categories ADD COLUMN level INTEGER DEFAULT 0;
  END IF;
END $$;

-- Créer l'index pour parentId si nécessaire
CREATE INDEX IF NOT EXISTS idx_categories_parentid ON categories(parentId);
