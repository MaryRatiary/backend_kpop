-- Migration: Ajouter l'utilisateur admin par défaut pour Render
-- Email: admin123@gmail.com
-- Password: admin123
-- Hash généré avec bcryptjs (salt rounds: 10)

-- D'abord, vérifier si l'utilisateur existe déjà
DELETE FROM users WHERE email = 'admin123@gmail.com';

-- Créer l'utilisateur admin
INSERT INTO users (email, password, firstName, lastName, role, createdAt, updatedAt)
VALUES (
  'admin123@gmail.com',
  '$2b$10$YmHL0YwoENvAlnBg4XBlN.y684BkkrzL3PZ87tLO2G9kQCBELw3kS',
  'Admin',
  'Default',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Vérifier que l'utilisateur a été créé
SELECT id, email, firstName, lastName, role FROM users WHERE email = 'admin123@gmail.com';
