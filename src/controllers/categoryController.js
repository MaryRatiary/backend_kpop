import pool from '../config/database.js';

// Obtenir toutes les catégories avec leurs sous-catégories
export const getAllCategories = async (req, res) => {
  try {
    // Récupérer toutes les catégories (parents et enfants)
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id) as productCount,
        COUNT(DISTINCT child.id) as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentid
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c.parentid ASC, c."order" ASC, c.name ASC
    `);
    
    const allCategories = result.rows;
    
    // Créer une map de toutes les catégories
    const categoryMap = new Map();
    allCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    // Construire la hiérarchie
    const roots = [];
    allCategories.forEach(cat => {
      if (cat.parentid) {
        const parent = categoryMap.get(cat.parentid);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        }
      } else {
        roots.push(categoryMap.get(cat.id));
      }
    });
    
    res.json(roots);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to get categories', details: err.message });
  }
};

// Obtenir toutes les catégories (plates - parents ET enfants)
export const getAllCategoriesFlat = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id) as productCount,
        COUNT(DISTINCT child.id) as childCategoryCount
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

// Obtenir une catégorie avec toutes ses sous-catégories
export const getCategoryWithChildren = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt 
      FROM categories c
      WHERE c.id = $1
    `, [id]);
    
    if (category.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const children = await pool.query(`
      SELECT c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt,
        COUNT(DISTINCT p.id)::integer as productCount,
        COUNT(DISTINCT child.id)::integer as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentid
      WHERE c.parentid = $1
      GROUP BY c.id, c.name, c.slug, c.description, c.parentid, c.level, c."order", c.image, c.createdAt, c.updatedAt
      ORDER BY c."order" ASC, c.name ASC
    `, [id]);

    const products = await pool.query(`
      SELECT p.id, p.name, p.slug, p.price, p.originalPrice, p.stock, p.featured, p.categoryId,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isMainImage = true LIMIT 1) as image
      FROM products p
      WHERE p.categoryId = $1
      ORDER BY p.name ASC
    `, [id]);

    res.json({
      ...category.rows[0],
      children: children.rows,
      products: products.rows
    });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Failed to get category', details: err.message });
  }
};

// Obtenir les sous-catégories d'une catégorie
export const getChildCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    
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
    `, [parentId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get child categories error:', err);
    res.status(500).json({ error: 'Failed to get child categories', details: err.message });
  }
};

// Créer une catégorie (Admin) - peut être parent ou enfant
export const createCategory = async (req, res) => {
  try {
    const { name, description, image, parentId } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    // Déterminer le niveau
    let level = 0;
    if (parentId) {
      const parent = await pool.query('SELECT level FROM categories WHERE id = $1', [parentId]);
      if (parent.rows.length === 0) {
        return res.status(404).json({ error: 'Parent category not found' });
      }
      level = parent.rows[0].level + 1;
    }

    const result = await pool.query(
      'INSERT INTO categories (name, description, image, slug, parentId, level) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, image, slug, parentId || null, level]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

// Mettre à jour une catégorie (Admin)
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image } = req.body;
    const slug = name ? name.toLowerCase().replace(/\s+/g, '-') : undefined;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (image) {
      updates.push(`image = $${paramIndex++}`);
      params.push(image);
    }
    if (slug) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(slug);
    }

    updates.push(`updatedAt = CURRENT_TIMESTAMP`);
    params.push(id);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

// Supprimer une catégorie (Admin)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la catégorie existe
    const categoryCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Supprimer les order_items qui référencent les produits de cette catégorie
    await pool.query(`
      DELETE FROM order_items 
      WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
    `, [id]);

    // Supprimer les images des produits
    await pool.query(`
      DELETE FROM product_images 
      WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
    `, [id]);

    // Supprimer les couleurs des produits
    await pool.query(`
      DELETE FROM product_colors 
      WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
    `, [id]);

    // Supprimer les tailles des produits
    await pool.query(`
      DELETE FROM product_sizes 
      WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
    `, [id]);

    // Supprimer les produits de la catégorie
    await pool.query('DELETE FROM products WHERE categoryId = $1', [id]);

    // Supprimer les sous-catégories et leurs produits
    const subcategories = await pool.query('SELECT id FROM categories WHERE parentId = $1', [id]);
    
    for (const subcat of subcategories.rows) {
      // Supprimer les order_items des sous-catégories
      await pool.query(`
        DELETE FROM order_items 
        WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
      `, [subcat.id]);

      await pool.query(`
        DELETE FROM product_images 
        WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
      `, [subcat.id]);

      await pool.query(`
        DELETE FROM product_colors 
        WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
      `, [subcat.id]);

      await pool.query(`
        DELETE FROM product_sizes 
        WHERE productId IN (SELECT id FROM products WHERE categoryId = $1)
      `, [subcat.id]);

      await pool.query('DELETE FROM products WHERE categoryId = $1', [subcat.id]);
    }

    // Supprimer les sous-catégories
    await pool.query('DELETE FROM categories WHERE parentId = $1', [id]);

    // Supprimer la catégorie principale
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

// Réorganiser une catégorie (Admin) - Drag and drop
export const reorderCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetCategoryId } = req.body;

    console.log(`🔄 Reorder request: source=${id}, target=${targetCategoryId}`);

    // Récupérer les deux catégories
    const sourceCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    const targetCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [targetCategoryId]);

    if (sourceCategory.rows.length === 0 || targetCategory.rows.length === 0) {
      console.log('❌ One of the categories not found');
      return res.status(404).json({ error: 'Category not found' });
    }

    const source = sourceCategory.rows[0];
    const target = targetCategory.rows[0];

    console.log(`Source: id=${source.id}, parentId=${source.parentid}, order=${source.order}`);
    console.log(`Target: id=${target.id}, parentId=${target.parentid}, order=${target.order}`);

    // Les deux catégories doivent être au même niveau (même parentId)
    if (source.parentid !== target.parentid) {
      console.log(`❌ Different levels: source.parentid=${source.parentid}, target.parentid=${target.parentid}`);
      return res.status(400).json({ error: 'Categories must be at the same level to reorder' });
    }

    // Récupérer toutes les catégories au même niveau, triées par "order"
    const siblingCategories = await pool.query(
      'SELECT id, "order" FROM categories WHERE parentId IS NOT DISTINCT FROM $1 ORDER BY "order" ASC, id ASC',
      [source.parentid]
    );

    const siblings = siblingCategories.rows;
    console.log(`📋 Siblings at level: ${siblings.map(s => `id=${s.id},order=${s.order}`).join(', ')}`);

    const sourceIndex = siblings.findIndex(s => s.id === source.id);
    const targetIndex = siblings.findIndex(s => s.id === target.id);

    console.log(`📍 sourceIndex=${sourceIndex}, targetIndex=${targetIndex}`);

    // Créer un nouvel tableau ordonné en déplaçant l'élément source
    let newOrder = siblings.map(s => s.id);
    
    if (sourceIndex !== targetIndex) {
      // Retirer l'élément source
      newOrder.splice(sourceIndex, 1);
      // L'insérer à la position cible
      if (sourceIndex < targetIndex) {
        newOrder.splice(targetIndex - 1, 0, source.id);
      } else {
        newOrder.splice(targetIndex, 0, source.id);
      }
    }

    console.log(`📊 New order: ${newOrder.join(', ')}`);

    // Mettre à jour les positions avec des valeurs séquentielles
    for (let i = 0; i < newOrder.length; i++) {
      const newOrderValue = i + 1; // Commencer à 1
      console.log(`  Setting id=${newOrder[i]} to order=${newOrderValue}`);
      await pool.query('UPDATE categories SET "order" = $1 WHERE id = $2', [newOrderValue, newOrder[i]]);
    }

    console.log(`✅ Reorder completed successfully`);

    // Récupérer la catégorie mise à jour
    const updatedCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);

    res.json(updatedCategory.rows[0]);
  } catch (err) {
    console.error('❌ Reorder category error:', err);
    res.status(500).json({ error: 'Failed to reorder category', details: err.message });
  }
};
