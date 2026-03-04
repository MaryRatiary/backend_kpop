import pool from '../config/database.js';

// Obtenir toutes les catégories avec leurs sous-catégories
export const getAllCategories = async (req, res) => {
  try {
    // Récupérer toutes les catégories (parents et enfants)
    const result = await pool.query(`
      SELECT c.*, 
        COUNT(DISTINCT p.id) as productCount,
        COUNT(DISTINCT child.id) as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentId
      GROUP BY c.id
      ORDER BY c.parentid ASC, c.name ASC
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
    res.status(500).json({ error: 'Failed to get categories' });
  }
};

// Obtenir toutes les catégories (plates - parents ET enfants)
export const getAllCategoriesFlat = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
        COUNT(DISTINCT p.id) as productCount,
        COUNT(DISTINCT child.id) as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentId
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
};

// Obtenir une catégorie avec toutes ses sous-catégories
export const getCategoryWithChildren = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (category.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const children = await pool.query(`
      SELECT c.*, 
        COUNT(DISTINCT p.id) as productCount,
        COUNT(DISTINCT child.id) as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentId
      WHERE c.parentId = $1
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [id]);

    const products = await pool.query(`
      SELECT id, name, slug, price, originalPrice, stock, featured, image
      FROM products 
      WHERE categoryId = $1
      ORDER BY name ASC
    `, [id]);

    res.json({
      ...category.rows[0],
      children: children.rows,
      products: products.rows
    });
  } catch (err) {
    console.error('Get category error:', err);
    res.status(500).json({ error: 'Failed to get category' });
  }
};

// Obtenir les sous-catégories d'une catégorie
export const getChildCategories = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    const result = await pool.query(`
      SELECT c.*, 
        COUNT(DISTINCT p.id) as productCount,
        COUNT(DISTINCT child.id) as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories child ON c.id = child.parentId
      WHERE c.parentId = $1
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [parentId]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get child categories error:', err);
    res.status(500).json({ error: 'Failed to get child categories' });
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
