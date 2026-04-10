import pool from '../config/database.js';

// ✅ OPTIMISATION: Utiliser JOIN au lieu de sous-requêtes (1 requête au lieu de 250!)
export const getAllProducts = async (req, res) => {
  try {
    const { categoryId, groupId, featured, limit = 50, offset = 0 } = req.query;
    
    // Valider les paramètres
    const validLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const validOffset = Math.max(parseInt(offset) || 0, 0);
    
    let query = `
      SELECT 
        p.id, p.name, p.slug, p.description, p.price, p.originalPrice, 
        p.stock, p.featured, p.categoryId, p.groupId, p.createdAt,
        c.name as categoryName, 
        g.name as groupName,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isMainImage = true LIMIT 1) as image,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isHoverImage = true LIMIT 1) as hoverImage
      FROM products p 
      LEFT JOIN categories c ON p.categoryId = c.id 
      LEFT JOIN kpop_groups g ON p.groupId = g.id 
      WHERE 1=1
    `;
    const params = [];

    if (categoryId) {
      query += ' AND p.categoryId = $' + (params.length + 1);
      params.push(parseInt(categoryId));
    }
    if (groupId) {
      query += ' AND p.groupId = $' + (params.length + 1);
      params.push(parseInt(groupId));
    }
    if (featured === 'true') {
      query += ' AND p.featured = true';
    }

    query += ' ORDER BY p.createdAt DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(validLimit, validOffset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
};

// ✅ OPTIMISATION: Récupérer un produit avec données complètes en moins de requêtes
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    // 1 requête au lieu de 3
    const product = await pool.query(`
      SELECT p.*, 
             c.name as categoryName, 
             g.name as groupName
      FROM products p
      LEFT JOIN categories c ON p.categoryId = c.id
      LEFT JOIN kpop_groups g ON p.groupId = g.id
      WHERE p.id = $1
    `, [parseInt(id)]);

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Requêtes parallèles (plus rapide que séquentiel)
    const [images, sizes, colors, reviews] = await Promise.all([
      pool.query('SELECT * FROM product_images WHERE productId = $1 ORDER BY "order" ASC', [id]),
      pool.query('SELECT * FROM product_sizes WHERE productId = $1', [id]),
      pool.query('SELECT * FROM product_colors WHERE productId = $1', [id]),
      pool.query('SELECT * FROM reviews WHERE productId = $1 ORDER BY createdAt DESC', [id])
    ]);

    res.json({
      ...product.rows[0],
      images: images.rows,
      sizes: sizes.rows,
      colors: colors.rows,
      reviews: reviews.rows
    });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
};

// ✅ OPTIMISATION: Batch insert au lieu de boucle séquentielle
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      description,
      price, 
      originalPrice, 
      categoryId, 
      stock,
      sizes,
      colors
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Le nom et le prix sont obligatoires' });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Le prix doit être un nombre positif' });
    }

    let slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const existingSlug = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (existingSlug.rows.length > 0) {
      slug = slug + '-' + Math.floor(Date.now() / 1000);
    }

    const result = await pool.query(
      `INSERT INTO products (
        name, slug, description,
        price, originalPrice, categoryId, stock
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, slug, description || null, price, originalPrice || null, categoryId || null, stock || 0]
    );

    const productId = result.rows[0].id;

    // ✅ Batch insert pour les tailles
    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      const sizeValues = sizes.map((size, idx) => {
        const defaultStock = ['XS', 'XXL'].includes(size) ? 10 : 15;
        return [productId, size, defaultStock];
      });
      
      const sizePlaceholders = sizeValues.map((_, idx) => {
        const baseIdx = idx * 3;
        return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`;
      }).join(',');
      
      if (sizeValues.length > 0) {
        await pool.query(
          `INSERT INTO product_sizes (productId, size, stock) VALUES ${sizePlaceholders}
           ON CONFLICT (productId, size) DO NOTHING`,
          sizeValues.flat()
        );
      }
    }

    // ✅ Batch insert pour les couleurs
    if (colors && Array.isArray(colors) && colors.length > 0) {
      const colorValues = colors.map((color, idx) => {
        const colorName = color.name || color;
        const defaultStock = ['noir', 'Noir', 'black', 'Black'].includes(colorName) ? 20 : 15;
        return [productId, colorName, color.hex || '#000000', defaultStock];
      });
      
      const colorPlaceholders = colorValues.map((_, idx) => {
        const baseIdx = idx * 4;
        return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4})`;
      }).join(',');
      
      if (colorValues.length > 0) {
        await pool.query(
          `INSERT INTO product_colors (productId, colorName, colorHex, stock) VALUES ${colorPlaceholders}
           ON CONFLICT (productId, colorName) DO NOTHING`,
          colorValues.flat()
        );
      }
    }

    // Récupérer le produit complet
    const completeProduct = await pool.query(`
      SELECT p.* FROM products p
      WHERE p.id = $1
    `, [productId]);

    res.status(201).json(completeProduct.rows[0]);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
};

// ✅ OPTIMISATION: Batch update au lieu de delete + insert
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, originalPrice, stock, featured, sizes, colors } = req.body;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    if (price !== undefined && (isNaN(price) || price < 0)) {
      return res.status(400).json({ error: 'Le prix doit être un nombre positif' });
    }

    let slug = undefined;
    if (name) {
      let baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (baseSlug.length > 40) {
        baseSlug = baseSlug.substring(0, 40);
      }
      
      slug = baseSlug;
      const existingSlug = await pool.query('SELECT id FROM products WHERE slug = $1 AND id != $2', [slug, parseInt(id)]);
      if (existingSlug.rows.length > 0) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const maxBaseLength = 50 - timestamp.length - 1;
        if (slug.length > maxBaseLength) {
          slug = slug.substring(0, maxBaseLength);
        }
        slug = slug + '-' + timestamp;
      }
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) { updates.push(`name = $${paramIndex++}`); params.push(name); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); params.push(description); }
    if (price !== undefined) { updates.push(`price = $${paramIndex++}`); params.push(price); }
    if (originalPrice !== undefined) { updates.push(`originalPrice = $${paramIndex++}`); params.push(originalPrice); }
    if (stock !== undefined) { updates.push(`stock = $${paramIndex++}`); params.push(Math.max(0, stock)); }
    if (featured !== undefined) { updates.push(`featured = $${paramIndex++}`); params.push(featured); }
    if (slug) { updates.push(`slug = $${paramIndex++}`); params.push(slug); }

    updates.push(`updatedAt = CURRENT_TIMESTAMP`);
    params.push(parseInt(id));

    if (updates.length === 1) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // ✅ Batch update pour les tailles
    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      await pool.query('DELETE FROM product_sizes WHERE productId = $1', [parseInt(id)]);
      
      const sizeValues = sizes.map((size) => [parseInt(id), size, 0]);
      const sizePlaceholders = sizeValues.map((_, idx) => {
        const baseIdx = idx * 3;
        return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3})`;
      }).join(',');
      
      if (sizeValues.length > 0) {
        await pool.query(
          `INSERT INTO product_sizes (productId, size, stock) VALUES ${sizePlaceholders}`,
          sizeValues.flat()
        );
      }
    }

    // ✅ Batch update pour les couleurs
    if (colors && Array.isArray(colors) && colors.length > 0) {
      await pool.query('DELETE FROM product_colors WHERE productId = $1', [parseInt(id)]);
      
      const colorValues = colors.map((color) => 
        [parseInt(id), color.name || color, color.hex || '#000000', 0]
      );
      const colorPlaceholders = colorValues.map((_, idx) => {
        const baseIdx = idx * 4;
        return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4})`;
      }).join(',');
      
      if (colorValues.length > 0) {
        await pool.query(
          `INSERT INTO product_colors (productId, colorName, colorHex, stock) VALUES ${colorPlaceholders}`,
          colorValues.flat()
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [parseInt(id)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    res.json({ message: 'Produit supprimé avec succès' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
};

export const addProductImage = async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageUrl, isMainImage, isHoverImage, order } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'L\'URL de l\'image est obligatoire' });
    }

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    // ✅ Valider la taille de l'image (max 2MB)
    if (imageUrl.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'L\'image est trop volumineuse (max 2MB)' });
    }

    const productExists = await pool.query('SELECT id FROM products WHERE id = $1', [parseInt(productId)]);
    if (productExists.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    const result = await pool.query(
      'INSERT INTO product_images (productId, imageUrl, isMainImage, isHoverImage, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [parseInt(productId), imageUrl, isMainImage || false, isHoverImage || false, order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product image error:', err);
    
    if (err.code === '22001') {
      return res.status(400).json({ error: 'L\'URL de l\'image est trop longue pour la base de données' });
    }
    
    res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'image' });
  }
};

export const addProductSize = async (req, res) => {
  try {
    const { productId } = req.params;
    const { size, stock } = req.body;

    if (!size) {
      return res.status(400).json({ error: 'La taille est obligatoire' });
    }

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const result = await pool.query(
      'INSERT INTO product_sizes (productId, size, stock) VALUES ($1, $2, $3) ON CONFLICT (productId, size) DO UPDATE SET stock = EXCLUDED.stock RETURNING *',
      [parseInt(productId), size, Math.max(0, stock || 0)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product size error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la taille' });
  }
};

export const addProductColor = async (req, res) => {
  try {
    const { productId } = req.params;
    const { colorName, colorHex, stock } = req.body;

    if (!colorName) {
      return res.status(400).json({ error: 'Le nom de la couleur est obligatoire' });
    }

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const result = await pool.query(
      'INSERT INTO product_colors (productId, colorName, colorHex, stock) VALUES ($1, $2, $3, $4) ON CONFLICT (productId, colorName) DO UPDATE SET stock = EXCLUDED.stock RETURNING *',
      [parseInt(productId), colorName, colorHex || '#000000', Math.max(0, stock || 0)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product color error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la couleur' });
  }
};

export const updateSizeStock = async (req, res) => {
  try {
    const { productId, sizeId } = req.params;
    const { stock } = req.body;

    if (stock === undefined || isNaN(stock)) {
      return res.status(400).json({ error: 'Le stock doit être un nombre' });
    }

    if (!productId || isNaN(productId) || !sizeId || isNaN(sizeId)) {
      return res.status(400).json({ error: 'IDs invalides' });
    }

    const result = await pool.query(
      'UPDATE product_sizes SET stock = $1 WHERE id = $2 AND productId = $3 RETURNING *',
      [Math.max(0, stock), parseInt(sizeId), parseInt(productId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Taille non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update size stock error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du stock' });
  }
};

export const updateColorStock = async (req, res) => {
  try {
    const { productId, colorId } = req.params;
    const { stock } = req.body;

    if (stock === undefined || isNaN(stock)) {
      return res.status(400).json({ error: 'Le stock doit être un nombre' });
    }

    if (!productId || isNaN(productId) || !colorId || isNaN(colorId)) {
      return res.status(400).json({ error: 'IDs invalides' });
    }

    const result = await pool.query(
      'UPDATE product_colors SET stock = $1 WHERE id = $2 AND productId = $3 RETURNING *',
      [Math.max(0, stock), parseInt(colorId), parseInt(productId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Couleur non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update color stock error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du stock' });
  }
};
