-- Supprimer les tables existantes (si nécessaire)
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_colors CASCADE;
DROP TABLE IF EXISTS product_sizes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS kpop_groups CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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
    postalCode VARCHAR(20),
    country VARCHAR(100),
    role VARCHAR(50) DEFAULT 'customer',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des groupes K-POP
CREATE TABLE kpop_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image VARCHAR(500),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des catégories hiérarchiques (support récursif)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image VARCHAR(500),
    parentId INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON categories(parentId);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Table des produits
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    detailedDescription TEXT,
    composition VARCHAR(500),
    careInstructions TEXT,
    brand VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    originalPrice DECIMAL(10, 2),
    categoryId INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    groupId INTEGER REFERENCES kpop_groups(id) ON DELETE SET NULL,
    stock INTEGER DEFAULT 0,
    featured BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3, 2) DEFAULT 0.0,
    reviews INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(categoryId);
CREATE INDEX idx_products_group ON products(groupId);
CREATE INDEX idx_products_slug ON products(slug);

-- Table des images de produit
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    imageUrl VARCHAR(500) NOT NULL,
    isMainImage BOOLEAN DEFAULT FALSE,
    isHoverImage BOOLEAN DEFAULT FALSE,
    "order" INTEGER DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_images_product ON product_images(productId);

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

CREATE INDEX idx_product_sizes_product ON product_sizes(productId);

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

CREATE INDEX idx_product_colors_product ON product_colors(productId);

-- Table des avis/reviews
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_product ON reviews(productId);
CREATE INDEX idx_reviews_user ON reviews(userId);

-- Table des commandes
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    totalPrice DECIMAL(10, 2) NOT NULL,
    shippingAddress TEXT,
    paymentMethod VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    paymentStatus VARCHAR(50) DEFAULT 'unpaid',
    trackingNumber VARCHAR(100),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user ON orders(userId);

-- Table des articles de commande
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    productId INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL,
    size VARCHAR(50),
    color VARCHAR(100),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(orderId);
CREATE INDEX idx_order_items_product ON order_items(productId);

-- Création d'une vue pour les catégories avec comptage
CREATE OR REPLACE VIEW category_stats AS
SELECT 
    c.id,
    c.name,
    c.slug,
    c.parentId,
    c.level,
    COUNT(DISTINCT p.id) as productCount,
    COUNT(DISTINCT child.id) as childCount
FROM categories c
LEFT JOIN products p ON c.id = p.categoryId
LEFT JOIN categories child ON c.id = child.parentId
GROUP BY c.id, c.name, c.slug, c.parentId, c.level;
