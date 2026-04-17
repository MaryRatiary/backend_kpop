import pool from '../config/database.js';

/**
 * ✅ SOLUTION UNIFIÉE: Categories uniquement avec parentId
 * Supprime complètement la table subcategories
 */

// Obtenir toutes les catégories avec hiérarchie complète
export const getAllCategories = async (req, res) => {
  try {
    // Récupérer TOUTES les catégories (niveau 0, 1, 2, etc.)
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id)::integer as productCount,
        COUNT(DISTINCT child.id)::integer as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentid
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c.parentid ASC, c."order" ASC, c.name ASC
    `);

    // Construire l'arborescence
    const categories = result.rows;
    const categoryMap = new Map();
    const rootCategories = [];

    // Pass 1: Ajouter toutes les catégories à la map
    categories.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: []
      });
    });

    // Pass 2: Construire la hiérarchie
    categories.forEach(cat => {
      if (cat.parentid === null) {
        // C'est une catégorie racine
        rootCategories.push(categoryMap.get(cat.id));
      } else {
        // C'est un enfant, l'ajouter au parent
        const parent = categoryMap.get(cat.parentid);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      }
    });

    console.log(`✅ ${rootCategories.length} catégories racines trouvées`);
    console.log(`✅ ${categories.length} catégories totales`);
    
    res.json(rootCategories);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to get categories', details: err.message });
  }
};

// Obtenir toutes les catégories en version plate (sans hiérarchie imbriquée)
export const getAllCategoriesFlat = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id)::integer as productCount,
        COUNT(DISTINCT child.id)::integer as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentid
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c.parentid ASC, c."order" ASC, c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to get categories', details: err.message });
  }
};

// Obtenir une catégorie avec tous ses enfants et produits
export const getCategoryWithChildren = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    const categoryId = parseInt(id);

    // Récupérer la catégorie
    const category = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt 
      FROM categories c
      WHERE c.id = $1
    `, [categoryId]);
    
    if (category.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Récupérer les enfants directs
    const children = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id)::integer as productCount,
        COUNT(DISTINCT gc.id)::integer as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories gc ON c.id = gc.parentid
      WHERE c.parentid = $1
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c."order" ASC, c.name ASC
    `, [categoryId]);

    // Récupérer les produits directs et indirects (via enfants)
    const products = await pool.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE id = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      SELECT p.id, p.name, p.slug, p.price, p.originalPrice, p.stock, p.featured, p.categoryId,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isMainImage = true LIMIT 1) as image
      FROM products p
      WHERE p.categoryId IN (SELECT id FROM category_tree)
      ORDER BY p.name ASC
    `, [categoryId]);

    const totalCount = products.rows.length;
    const directCount = products.rows.filter(p => p.categoryId === categoryId).length;
    const indirectCount = totalCount - directCount;

    res.json({
      ...category.rows[0],
      children: children.rows,
      products: products.rows,
      productCount: totalCount,
      directProductCount: directCount,
      indirectProductCount: indirectCount
    });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Failed to get category', details: err.message });
  }
};

// Obtenir les enfants directs d'une catégorie
export const getChildCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    if (!parentId || isNaN(parseInt(parentId))) {
      return res.status(400).json({ error: 'ID parent invalide' });
    }
    
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id)::integer as productCount,
        COUNT(DISTINCT child.id)::integer as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentid
      WHERE c.parentid = $1
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c."order" ASC, c.name ASC
    `, [parseInt(parentId)]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get child categories error:', err);
    res.status(500).json({ error: 'Failed to get child categories', details: err.message });
  }
};

// ✅ Cette route EST OBSOLÈTE - les sous-catégories sont maintenant des catégories
// On la garde pour la compatibilité arrière, mais elle appelle getChildCategories
export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!categoryId || isNaN(parseInt(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    // Déléguer à getChildCategories
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id)::integer as productCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      WHERE c.parentid = $1
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c.name ASC
    `, [parseInt(categoryId)]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get subcategories error:', err);
    res.status(500).json({ error: 'Failed to get subcategories', details: err.message });
  }
};

// Créer une catégorie (peut être parent ou enfant)
export const createCategory = async (req, res) => {
  try {
    const { name, description, image, parentId } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Le nom est obligatoire' });
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    let level = 0;
    if (parentId) {
      if (isNaN(parseInt(parentId))) {
        return res.status(400).json({ error: 'ID parent invalide' });
      }
      const parent = await pool.query('SELECT level FROM categories WHERE id = $1', [parseInt(parentId)]);
      if (parent.rows.length === 0) {
        return res.status(404).json({ error: 'Parent category not found' });
      }
      level = parent.rows[0].level + 1;
    }

    const result = await pool.query(
      'INSERT INTO categories (name, description, image, slug, parentId, level) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description || null, image || null, slug, parentId ? parseInt(parentId) : null, level]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie', details: err.message });
  }
};

// Mettre à jour une catégorie
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    const slug = name ? name.toLowerCase().replace(/\s+/g, '-') : undefined;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description || null);
    }
    if (image !== undefined) {
      updates.push(`image = $${paramIndex++}`);
      params.push(image || null);
    }
    if (slug) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(slug);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updates.push(`updatedAt = CURRENT_TIMESTAMP`);
    params.push(parseInt(id));

    const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour', details: err.message });
  }
};

// Supprimer une catégorie (récursive avec transactions)
export const deleteCategory = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    const categoryId = parseInt(id);

    // Vérifier si la catégorie existe
    const categoryCheck = await client.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    // DÉBUT TRANSACTION
    await client.query('BEGIN');
    console.log(`🗑️ Suppression de la catégorie ${categoryId}`);

    // 1️⃣ Récupérer TOUS les IDs de produits (catégorie + enfants récursifs)
    const allProductIds = await client.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE id = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      SELECT DISTINCT id FROM products WHERE categoryId IN (SELECT id FROM category_tree)
    `, [categoryId]);

    const productIds = allProductIds.rows.map(r => r.id);
    console.log(`📊 Produits à supprimer: ${productIds.length}`);

    // 2️⃣ Supprimer les données liées aux produits
    if (productIds.length > 0) {
      await client.query('DELETE FROM reviews WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_images WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_colors WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_sizes WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM order_items WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM products WHERE id = ANY($1)', [productIds]);
    }

    // 3️⃣ Supprimer les catégories enfants (récursivement)
    await client.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE parentid = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      DELETE FROM categories WHERE id IN (SELECT id FROM category_tree)
    `, [categoryId]);

    // 4️⃣ Supprimer la catégorie principale
    await client.query('DELETE FROM categories WHERE id = $1', [categoryId]);

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    console.log(`✅ Catégorie ${categoryId} et ses enfants supprimés`);
    res.json({ message: 'Catégorie supprimée avec succès', deletedProducts: productIds.length });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      console.error('Rollback error:', e);
    }
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  } finally {
    client.release();
  }
};

// Réordonner les catégories
export const reorderCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetCategoryId } = req.body;

    if (!id || isNaN(parseInt(id)) || !targetCategoryId || isNaN(parseInt(targetCategoryId))) {
      return res.status(400).json({ error: 'IDs invalides' });
    }

    console.log(`🔄 Reorder: source=${id}, target=${targetCategoryId}`);

    const sourceCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [parseInt(id)]);
    const targetCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [parseInt(targetCategoryId)]);

    if (sourceCategory.rows.length === 0 || targetCategory.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    const source = sourceCategory.rows[0];
    const target = targetCategory.rows[0];

    if (source.parentid !== target.parentid) {
      return res.status(400).json({ error: 'Les catégories doivent être au même niveau' });
    }

    const siblingCategories = await pool.query(
      'SELECT id, "order" FROM categories WHERE parentId IS NOT DISTINCT FROM $1 ORDER BY "order" ASC, id ASC',
      [source.parentid]
    );

    const siblings = siblingCategories.rows;
    const sourceIndex = siblings.findIndex(s => s.id === source.id);
    const targetIndex = siblings.findIndex(s => s.id === target.id);

    let newOrder = siblings.map(s => s.id);
    if (sourceIndex !== targetIndex) {
      newOrder.splice(sourceIndex, 1);
      if (sourceIndex < targetIndex) {
        newOrder.splice(targetIndex - 1, 0, source.id);
      } else {
        newOrder.splice(targetIndex, 0, source.id);
      }
    }

    for (let i = 0; i < newOrder.length; i++) {
      await pool.query('UPDATE categories SET "order" = $1 WHERE id = $2', [i + 1, newOrder[i]]);
    }

    const updatedCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [parseInt(id)]);
    res.json(updatedCategory.rows[0]);
  } catch (err) {
    console.error('Reorder category error:', err);
    res.status(500).json({ error: 'Erreur lors du réordonnancement', details: err.message });
  }
};