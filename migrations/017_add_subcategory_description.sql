-- Migration: Ajouter une colonne description à la table categories pour les sous-catégories

-- Ajouter la colonne description si elle n'existe pas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' AND column_name = 'description') THEN
    ALTER TABLE categories ADD COLUMN description TEXT NULL;
  END IF;
END $$;

-- Créer un index pour les requêtes plus rapides
CREATE INDEX IF NOT EXISTS idx_category_description_017 ON categories(id);
