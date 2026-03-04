import pool from '../config/database.js';

// Obtenir tous les produits
export const getAllProducts = async (req, res) => {
  try {
    const { categoryId, groupId, featured, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT p.*, c.name as categoryName, g.name as groupName FROM products p LEFT JOIN categories c ON p.categoryId = c.id LEFT JOIN kpop_groups g ON p.groupId = g.id WHERE 1=1';
    const params = [];

    if (categoryId) {
      query += ' AND p.categoryId = $' + (params.length + 1);
      params.push(categoryId);
    }
    if (groupId) {
      query += ' AND p.groupId = $' + (params.length + 1);
      params.push(groupId);
    }
    if (featured) {
      query += ' AND p.featured = true';
    }

    query += ' ORDER BY p.createdAt DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to get products' });
  }
};

// Obtenir un produit par ID avec tous les détails
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await pool.query(`
      SELECT p.*, c.name as categoryName, g.name as groupName
      FROM products p
      LEFT JOIN categories c ON p.categoryId = c.id
      LEFT JOIN kpop_groups g ON p.groupId = g.id
      WHERE p.id = $1
    `, [id]);

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const images = await pool.query('SELECT * FROM product_images WHERE productId = $1 ORDER BY "order" ASC', [id]);
    const sizes = await pool.query('SELECT * FROM product_sizes WHERE productId = $1', [id]);
    const colors = await pool.query('SELECT * FROM product_colors WHERE productId = $1', [id]);
    const reviews = await pool.query('SELECT * FROM reviews WHERE productId = $1 ORDER BY createdAt DESC', [id]);

    res.json({
      ...product.rows[0],
      images: images.rows,
      sizes: sizes.rows,
      colors: colors.rows,
      reviews: reviews.rows
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Failed to get product' });
  }
};

// Créer un produit (Admin)
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      description,
      price, 
      originalPrice, 
      categoryId, 
      stock 
    } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const result = await pool.query(
      `INSERT INTO products (
        name, slug, description,
        price, originalPrice, categoryId, stock
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, slug, description, price, originalPrice, categoryId, stock || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// Mettre à jour un produit (Admin)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      detailedDescription,
      composition,
      careInstructions,
      brand,
      price, 
      originalPrice, 
      stock, 
      featured, 
      sales,
      rating,
      reviews
    } = req.body;
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
    if (detailedDescription) {
      updates.push(`detailedDescription = $${paramIndex++}`);
      params.push(detailedDescription);
    }
    if (composition) {
      updates.push(`composition = $${paramIndex++}`);
      params.push(composition);
    }
    if (careInstructions) {
      updates.push(`careInstructions = $${paramIndex++}`);
      params.push(careInstructions);
    }
    if (brand) {
      updates.push(`brand = $${paramIndex++}`);
      params.push(brand);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      params.push(price);
    }
    if (originalPrice !== undefined) {
      updates.push(`originalPrice = $${paramIndex++}`);
      params.push(originalPrice);
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramIndex++}`);
      params.push(stock);
    }
    if (featured !== undefined) {
      updates.push(`featured = $${paramIndex++}`);
      params.push(featured);
    }
    if (sales !== undefined) {
      updates.push(`sales = $${paramIndex++}`);
      params.push(sales);
    }
    if (rating !== undefined) {
      updates.push(`rating = $${paramIndex++}`);
      params.push(rating);
    }
    if (reviews !== undefined) {
      updates.push(`reviews = $${paramIndex++}`);
      params.push(reviews);
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

    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// Supprimer un produit (Admin)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// Ajouter une image à un produit
export const addProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageUrl, isMainImage, isHoverImage, order } = req.body;

    const result = await pool.query(
      'INSERT INTO product_images (productId, imageUrl, isMainImage, isHoverImage, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [productId, imageUrl, isMainImage || false, isHoverImage || false, order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product image error:', err);
    res.status(500).json({ error: 'Failed to add image' });
  }
};

// Ajouter une taille avec stock
export const addProductSize = async (req, res) => {
  try {
    const { productId } = req.params;
    const { size, stock } = req.body;

    const result = await pool.query(
      'INSERT INTO product_sizes (productId, size, stock) VALUES ($1, $2, $3) ON CONFLICT (productId, size) DO UPDATE SET stock = EXCLUDED.stock RETURNING *',
      [productId, size, stock || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product size error:', err);
    res.status(500).json({ error: 'Failed to add size' });
  }
};

// Ajouter une couleur avec stock
export const addProductColor = async (req, res) => {
  try {
    const { productId } = req.params;
    const { colorName, colorHex, stock } = req.body;

    const result = await pool.query(
      'INSERT INTO product_colors (productId, colorName, colorHex, stock) VALUES ($1, $2, $3, $4) ON CONFLICT (productId, colorName) DO UPDATE SET stock = EXCLUDED.stock RETURNING *',
      [productId, colorName, colorHex, stock || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product color error:', err);
    res.status(500).json({ error: 'Failed to add color' });
  }
};

// Mettre à jour le stock d'une taille (temps réel)
export const updateSizeStock = async (req, res) => {
  try {
    const { productId, sizeId } = req.params;
    const { stock } = req.body;

    const result = await pool.query(
      'UPDATE product_sizes SET stock = $1 WHERE id = $2 AND productId = $3 RETURNING *',
      [stock, sizeId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Size not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update size stock error:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

// Mettre à jour le stock d'une couleur (temps réel)
export const updateColorStock = async (req, res) => {
  try {
    const { productId, colorId } = req.params;
    const { stock } = req.body;

    const result = await pool.query(
      'UPDATE product_colors SET stock = $1 WHERE id = $2 AND productId = $3 RETURNING *',
      [stock, colorId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Color not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update color stock error:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};
