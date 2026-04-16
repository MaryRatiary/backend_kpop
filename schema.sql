-- ============================================================
-- SCRIPT DE RESET COMPLET DE LA BASE DE DONNÉES
-- ============================================================
-- Ce script supprime TOUTES les tables et les recrée vierges

-- ============================================================
-- 1. DROP DES TABLES (dans l'ordre inverse des dépendances)
-- ============================================================

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS product_colors CASCADE;
DROP TABLE IF EXISTS product_sizes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS kpop_groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- 2. CRÉATION DES TABLES (structure vierge)
-- ============================================================

-- Table des utilisateurs
CREATE TABLE users (
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
CREATE TABLE kpop_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  image TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des catégories (avec support hiérarchique)
CREATE TABLE categories (
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
CREATE TABLE subcategories (
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
CREATE TABLE products (
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
CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  imageUrl TEXT NOT NULL,
  isMainImage BOOLEAN DEFAULT false,
  isHoverImage BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des tailles avec stock
CREATE TABLE product_sizes (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size VARCHAR(50) NOT NULL,
  stock INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(productId, size)
);

-- Table des couleurs avec stock
CREATE TABLE product_colors (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  colorName VARCHAR(100) NOT NULL,
  colorHex VARCHAR(7),
  stock INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(productId, colorName)
);

-- Table des avis/critiques
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des commandes (AVEC TOUTES LES COLONNES NÉCESSAIRES)
CREATE TABLE orders (
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
CREATE TABLE order_items (
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
-- 3. CRÉATION DES INDEX
-- ============================================================

CREATE INDEX idx_categories_parentId ON categories(parentId);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_subcategories_categoryId ON subcategories(categoryId);
CREATE INDEX idx_products_categoryId ON products(categoryId);
CREATE INDEX idx_products_subcategoryId ON products(subcategoryId);
CREATE INDEX idx_products_groupId ON products(groupId);
CREATE INDEX idx_product_sizes_productId ON product_sizes(productId);
CREATE INDEX idx_product_colors_productId ON product_colors(productId);
CREATE INDEX idx_orders_userId ON orders(userId);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_orderId ON order_items(orderId);
CREATE INDEX idx_reviews_productId ON reviews(productId);

-- ============================================================
-- 4. MESSAGE DE CONFIRMATION
-- ============================================================
-- Base de données réinitialisée avec succès !
-- Toutes les tables sont vierges et prêtes pour les nouvelles données.
