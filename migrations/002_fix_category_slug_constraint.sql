-- Migration: Corriger la contrainte UNIQUE sur slug pour supporter la hiérarchie

-- Supprimer la contrainte UNIQUE actuelle sur slug
ALTER TABLE categories DROP CONSTRAINT categories_slug_key;

-- Créer une nouvelle contrainte UNIQUE composite (parentId, slug)
-- Cela permet le même slug dans différentes branches de la hiérarchie
ALTER TABLE categories ADD CONSTRAINT categories_parentid_slug_key UNIQUE (parentId, slug);

-- Ajouter un index pour les recherches par slug
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
