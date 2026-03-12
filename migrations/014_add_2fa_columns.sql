-- ============================================================
-- MIGRATION 014 - AJOUTER LES COLONNES 2FA (TWO-FACTOR AUTH)
-- ============================================================
-- Ajoute les colonnes nécessaires pour l'authentification à double facteur par email
-- Date: 2026-03-12

-- Ajouter les colonnes 2FA à la table users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_fa_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_otp_sent_at TIMESTAMP;

-- Créer des index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_users_two_fa_enabled ON users(two_fa_enabled);
CREATE INDEX IF NOT EXISTS idx_users_otp_expires_at ON users(otp_expires_at);

-- ============================================================
-- Confirmation
-- ============================================================
-- Colonnes ajoutées à la table users :
-- - two_fa_enabled : booléen pour activer/désactiver le 2FA
-- - two_fa_verified : booléen pour vérifier que le 2FA est configuré
-- - otp_code : code OTP à 6 chiffres
-- - otp_expires_at : date/heure d'expiration du code OTP
-- - otp_attempts : nombre de tentatives pour vérifier le code
-- - last_otp_sent_at : date/heure du dernier envoi du code OTP
