-- ✅ SCRIPT D'OPTIMISATION DES INDEXES POUR PRODUCTION
-- Ce script crée tous les indexes manquants pour éviter les full table scans

-- ============ INDEXES POUR PRODUITS ============
CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_groupId ON products(groupId);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured_createdAt ON products(featured, createdAt DESC);

-- ============ INDEXES POUR IMAGES ============
CREATE INDEX IF NOT EXISTS idx_product_images_productId ON product_images(productId);
CREATE INDEX IF NOT EXISTS idx_product_images_isMainImage ON product_images(productId, isMainImage);
CREATE INDEX IF NOT EXISTS idx_product_images_isHoverImage ON product_images(productId, isHoverImage);

-- ============ INDEXES POUR VARIANTES ============
CREATE INDEX IF NOT EXISTS idx_product_sizes_productId ON product_sizes(productId);
CREATE INDEX IF NOT EXISTS idx_product_colors_productId ON product_colors(productId);

-- ============ INDEXES POUR COMMANDES ============
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_orders_userId_createdAt ON orders(userId, createdAt DESC);

-- ============ INDEXES POUR ORDER ITEMS ============
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
CREATE INDEX IF NOT EXISTS idx_order_items_productId ON order_items(productId);

-- ============ INDEXES POUR REVIEWS ============
CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);
CREATE INDEX IF NOT EXISTS idx_reviews_productId_createdAt ON reviews(productId, createdAt DESC);

-- ============ INDEXES POUR CATEGORIES ============
CREATE INDEX IF NOT EXISTS idx_categories_parentId ON categories(parentId);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- ============ INDEXES POUR USERS ============
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ✅ ANALYSER LES STATISTIQUES
ANALYZE products;
ANALYZE product_images;
ANALYZE product_sizes;
ANALYZE product_colors;
ANALYZE orders;
ANALYZE order_items;
ANALYZE categories;
ANALYZE users;
ANALYZE reviews;

-- ✅ AFFICHER LES INDEXES CRÉÉS
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY tablename, indexname;
