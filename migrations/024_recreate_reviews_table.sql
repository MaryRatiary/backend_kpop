-- ============================================================
-- MIGRATION 024 - RECRÉER LA TABLE REVIEWS AVEC LA BONNE STRUCTURE
-- ============================================================
-- Force la suppression et recréation de la table reviews
-- avec tous les champs corrects (author, email, rating, etc)

-- Étape 1: Supprimer les dépendances (tables dépendantes)
DROP TABLE IF EXISTS review_images CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;

-- Étape 2: Créer la table reviews avec la bonne structure
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  helpful INTEGER DEFAULT 0,
  notHelpful INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Étape 3: Créer la table review_images
CREATE TABLE review_images (
  id SERIAL PRIMARY KEY,
  reviewId INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  imageUrl TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Étape 4: Créer les index pour les performances
CREATE INDEX idx_reviews_productId ON reviews(productId);
CREATE INDEX idx_reviews_userId ON reviews(userId);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_createdAt ON reviews(createdAt DESC);
CREATE INDEX idx_review_images_reviewId ON review_images(reviewId);

-- Étape 5: Ajouter les colonnes de statistiques aux produits si elles n'existent pas
ALTER TABLE products ADD COLUMN IF NOT EXISTS averageRating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewCount INTEGER DEFAULT 0;

-- Étape 6: Vérification que tout a été créé
SELECT 'reviews' as "Table créée", COUNT(*) as "Colonnes" 
FROM information_schema.columns 
WHERE table_name = 'reviews'
UNION ALL
SELECT 'review_images' as "Table créée", COUNT(*) as "Colonnes"
FROM information_schema.columns 
WHERE table_name = 'review_images';
