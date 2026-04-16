-- Créer la table des avis
CREATE TABLE IF NOT EXISTS reviews (
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

-- Créer la table des images d'avis
CREATE TABLE IF NOT EXISTS review_images (
  id SERIAL PRIMARY KEY,
  reviewId INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  imageUrl TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer les index
CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);
CREATE INDEX IF NOT EXISTS idx_reviews_userId ON reviews(userId);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_review_images_reviewId ON review_images(reviewId);

-- Ajouter une colonne pour le nombre total d'avis sur les produits (optionnel mais utile pour les perfs)
ALTER TABLE products ADD COLUMN IF NOT EXISTS averageRating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewCount INTEGER DEFAULT 0;
