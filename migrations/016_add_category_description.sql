-- Migration: Ajouter un champ description à la table categories

-- Ajouter la colonne description si elle n'existe pas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'description') THEN
    ALTER TABLE categories ADD COLUMN description TEXT DEFAULT NULL;
  END IF;
END $$;

-- Ajouter la colonne full_description si elle n'existe pas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'full_description') THEN
    ALTER TABLE categories ADD COLUMN full_description TEXT DEFAULT NULL;
  END IF;
END $$;

-- Créer un index pour de meilleures performances de requête
CREATE INDEX IF NOT EXISTS idx_category_description ON categories(id);
