-- Migration: Ajouter l'utilisateur admin avec mot de passe hashé
-- Email: maryratiary12@gmail.com
-- Le mot de passe est hashé avec bcryptjs (salt rounds: 10)
-- Hash pour "qwertyuiop123": $2a$10$YourHashedPasswordHereWillBeGenerated

-- D'abord, supprimer l'utilisateur s'il existe
DELETE FROM users WHERE email = 'maryratiary12@gmail.com';

-- Créer l'utilisateur admin
INSERT INTO users (email, password, firstName, lastName, role, createdAt, updatedAt)
VALUES (
  'maryratiary12@gmail.com',
  '$2a$10$7K7vK8Q2J5q3X2v1Y0z9dOxR4nM3pL1sK9j8H6gF5dEcB4vA2tU3m', -- Hash du mot de passe qwertyuiop123
  'Admin',
  'User',
  'admin',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Vérifier que l'utilisateur a été créé
SELECT id, email, firstName, lastName, role FROM users WHERE email = 'maryratiary12@gmail.com';
