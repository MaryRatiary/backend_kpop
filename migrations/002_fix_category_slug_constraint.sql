-- Migration: Corriger la contrainte UNIQUE sur slug pour supporter la hiérarchie

-- Supprimer la contrainte UNIQUE actuelle sur slug si elle existe
DO $$ BEGIN
  ALTER TABLE categories DROP CONSTRAINT categories_slug_key;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Créer une nouvelle contrainte UNIQUE composite (parentId, slug) si elle n'existe pas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'categories_parentid_slug_key'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_parentid_slug_key UNIQUE (parentId, slug);
  END IF;
END $$;

-- Ajouter un index pour les recherches par slug
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
