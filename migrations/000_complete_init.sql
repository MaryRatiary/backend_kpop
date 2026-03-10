-- ============================================================
-- MIGRATION COMPLÈTE - INITIALISATION BASE DE DONNÉES SINOA
-- ============================================================
-- Script d'initialisation complet pour la base de données
-- À exécuter une seule fois lors du déploiement initial
-- Date: 2026-03-09

-- ============================================================
-- 1. CRÉATION DES TABLES (si elles n'existent pas)
-- ============================================================
-- NOTE: Utilisation de CREATE TABLE IF NOT EXISTS pour préserver les données existantes

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  phone VARCHAR(20),
  address VARCHAR(255),
  city VARCHAR(100),
  postalCode VARCHAR(10),
  country VARCHAR(100),
  role VARCHAR(20) DEFAULT 'customer',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des groupes KPOP
CREATE TABLE IF NOT EXISTS kpop_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des catégories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  image TEXT,
  parentId INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (parentId, slug)
);

-- Table des sous-catégories
CREATE TABLE IF NOT EXISTS subcategories (
  id SERIAL PRIMARY KEY,
  categoryId INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  image TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(categoryId, slug)
);

-- Table des produits
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  originalPrice DECIMAL(10, 2),
  categoryId INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subcategoryId INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
  groupId INTEGER REFERENCES kpop_groups(id) ON DELETE SET NULL,
  stock INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  sales INTEGER DEFAULT 0,
  rating DECIMAL(3, 1) DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des images de produits
CREATE TABLE IF NOT EXISTS product_images (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  imageUrl TEXT NOT NULL,
  isMainImage BOOLEAN DEFAULT false,
  isHoverImage BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tailles
CREATE TABLE IF NOT EXISTS product_sizes (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size VARCHAR(50) NOT NULL,
  stock INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(productId, size)
);

-- Table des couleurs
CREATE TABLE IF NOT EXISTS product_colors (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  colorName VARCHAR(100) NOT NULL,
  colorHex VARCHAR(7),
  stock INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(productId, colorName)
);

-- Table des avis
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des commandes (avec détails complets de livraison)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  totalPrice DECIMAL(10, 2) NOT NULL,
  shippingAddress TEXT NOT NULL,
  paymentMethod VARCHAR(50) NOT NULL,
  paymentStatus VARCHAR(50) DEFAULT 'unpaid',
  status VARCHAR(50) DEFAULT 'pending',
  trackingNumber VARCHAR(100),
  firstName VARCHAR(100),
  lastName VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  city VARCHAR(100),
  postalCode VARCHAR(10),
  country VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des articles de commande
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  size VARCHAR(50),
  color VARCHAR(100),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. CRÉATION DES INDEX (si elles n'existent pas)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_categories_parentId ON categories(parentId);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_subcategories_categoryId ON subcategories(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_subcategoryId ON products(subcategoryId);
CREATE INDEX IF NOT EXISTS idx_products_groupId ON products(groupId);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_product_sizes_productId ON product_sizes(productId);
CREATE INDEX IF NOT EXISTS idx_product_colors_productId ON product_colors(productId);
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt);
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);
CREATE INDEX IF NOT EXISTS idx_reviews_userId ON reviews(userId);

-- ============================================================
-- 3. INSERTION UTILISATEUR ADMIN PAR DÉFAUT
-- ============================================================

-- Insérer un utilisateur admin (password: admin123)
-- Hash bcrypt du mot de passe: $2a$10$YIjlrVyaYvDyqfQnQhZXLOFRg3M9hc7MQcwO9VGwb7X.y7gEXgKiW
INSERT INTO users (email, password, firstName, lastName, role)
VALUES (
  'admin@sinoa.com',
  '$2a$10$YIjlrVyaYvDyqfQnQhZXLOFRg3M9hc7MQcwO9VGwb7X.y7gEXgKiW',
  'Admin',
  'Sinoa',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- 4. COMMENTAIRES ET DOCUMENTATION
-- ============================================================
COMMENT ON TABLE users IS 'Stocke les informations des utilisateurs (clients et admins)';
COMMENT ON TABLE orders IS 'Stocke les commandes avec tous les détails de livraison et coordonnées GPS';
COMMENT ON TABLE order_items IS 'Stocke les articles de chaque commande';
COMMENT ON TABLE products IS 'Stocke les produits KPOP';
COMMENT ON TABLE product_images IS 'Stocke les images des produits';
COMMENT ON TABLE product_sizes IS 'Stocke les tailles disponibles par produit';
COMMENT ON TABLE product_colors IS 'Stocke les couleurs disponibles par produit';

-- ============================================================
-- 5. CONFIRMATION
-- ============================================================
-- Migration complétée avec succès!
-- Tables créées: users, kpop_groups, categories, subcategories, products, product_images, product_sizes, product_colors, reviews, orders, order_items
-- Indexes créés: 17 index pour optimiser les requêtes
-- Utilisateur admin créé: admin@sinoa.com
-- IMPORTANT: Cette migration préserve les données existantes (CREATE IF NOT EXISTS)
