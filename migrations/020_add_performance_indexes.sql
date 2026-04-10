-- ✅ OPTIMISATION: Ajouter les indexes manquants pour les requêtes fréquentes

-- Index pour les requêtes de produits par catégorie
CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId);
CREATE INDEX IF NOT EXISTS idx_products_groupId ON products(groupId);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);

-- Index pour les images de produits
CREATE INDEX IF NOT EXISTS idx_product_images_productId ON product_images(productId);
CREATE INDEX IF NOT EXISTS idx_product_images_isMainImage ON product_images(isMainImage);

-- Index pour les tailles et couleurs
CREATE INDEX IF NOT EXISTS idx_product_sizes_productId ON product_sizes(productId);
CREATE INDEX IF NOT EXISTS idx_product_colors_productId ON product_colors(productId);

-- Index pour les commandes
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt DESC);

-- Index pour les items de commande
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
CREATE INDEX IF NOT EXISTS idx_order_items_productId ON order_items(productId);

-- Index pour les critiques/reviews
CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId);

-- Index pour les catégories
CREATE INDEX IF NOT EXISTS idx_categories_parentId ON categories(parentId);

-- Index composite pour les recherches combinées
CREATE INDEX IF NOT EXISTS idx_products_featured_createdAt ON products(featured, createdAt DESC);

-- ✅ ANALYSE: Analyser les statistiques des tables pour les requêtes optimales
ANALYZE products;
ANALYZE product_images;
ANALYZE product_sizes;
ANALYZE product_colors;
ANALYZE orders;
ANALYZE order_items;
ANALYZE categories;
ANALYZE users;
