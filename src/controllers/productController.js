import pool from '../config/database.js';
import { formatProductData, formatProductsArray } from '../utils/dataFormatter.js';

// Obtenir tous les produits
export const getAllProducts = async (req, res) => {
  try {
    const { category_id, group_id, featured, limit = 50000, offset = 0 } = req.query;
    let query = `
      SELECT 
        p.*,
         c.name as category_name, 
        g.name as groupName,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_main_image = true ORDER BY "order" ASC LIMIT 1) as image,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_hover_image = true ORDER BY "order" ASC LIMIT 1) as hoverImage,
        (SELECT json_agg(image_url ORDER BY "order" ASC) FROM product_images WHERE product_id = p.id) as images,
        (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.product_id = p.id) as sizes,
        (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.product_id = p.id) as colors
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      LEFT JOIN kpop_groups g ON p.group_id = g.id 
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND p.category_id = $' + (params.length + 1);
      params.push(parseInt(category_id));
    }
    if (group_id) {
      query += ' AND p.group_id = $' + (params.length + 1);
      params.push(parseInt(group_id));
    }
    if (featured) {
      query += ' AND p.featured = true';
    }

    // ✅ CORRIGÉ: Math.min supprimé — la limite est maintenant respectée telle quelle
    // Avant : Math.min(parseInt(limit) || 50, 100) → bloquait à 100 produits max
    query += ' ORDER BY p.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit) || 50000, parseInt(offset) || 0);

    const result = await pool.query(query, params);
    const formattedProducts = formatProductsArray(result.rows);
    res.json(formattedProducts);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
};

// Obtenir un produit par ID avec tous les détails
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const product = await pool.query(`
      SELECT p.*, 
              c.name as category_name, 
             g.name as groupName,
             (SELECT json_agg(image_url ORDER BY "order" ASC) FROM product_images WHERE product_id = p.id) as images,
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.product_id = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.product_id = p.id) as colors
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN kpop_groups g ON p.group_id = g.id
      WHERE p.id = $1
    `, [parseInt(id)]);

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const reviews = await pool.query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [id]);

    const formattedProduct = formatProductData({
      ...product.rows[0],
      reviews: reviews.rows
    });

    res.json(formattedProduct);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
};

// Créer un produit (Admin)
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      description,
      price, 
      original_price, 
      category_id, 
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
        price, original_price, category_id, stock
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, slug, description || null, price, original_price || null, category_id || null, stock || 0]
    );

    const product_id = result.rows[0].id;

    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      for (const size of sizes) {
        const defaultStock = ['XS', 'XXL'].includes(size) ? 10 : 15;
        await pool.query(
          'INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3) ON CONFLICT (product_id, size) DO NOTHING',
          [product_id, size, defaultStock]
        );
      }
    }

    if (colors && Array.isArray(colors) && colors.length > 0) {
      for (const color of colors) {
        const colorName = color.name || color;
        const defaultStock = ['noir', 'Noir', 'black', 'Black'].includes(colorName) ? 20 : 15;
        await pool.query(
          'INSERT INTO product_colors (product_id, colorName, colorHex, stock) VALUES ($1, $2, $3, $4) ON CONFLICT (product_id, colorName) DO NOTHING',
          [product_id, colorName, color.hex || '#000000', defaultStock]
        );
      }
    }

    const completeProduct = await pool.query(`
      SELECT p.*, 
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.product_id = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.product_id = p.id) as colors
      FROM products p
      WHERE p.id = $1
    `, [product_id]);

    const formatted = formatProductData(completeProduct.rows[0]);
    res.status(201).json(formatted);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
};

// Mettre à jour un produit (Admin)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      original_price,
      category_id,
      stock,
      featured,
      sizes,
      colors
    } = req.body;

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

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      params.push(price);
    }
    if (original_price !== undefined) {
      updates.push(`original_price = $${paramIndex++}`);
      params.push(original_price);
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramIndex++}`);
      params.push(Math.max(0, stock));
    }
    if (category_id !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      params.push(category_id ? parseInt(category_id) : null);
    }
    if (featured !== undefined) {
      updates.push(`featured = $${paramIndex++}`);
      params.push(featured);
    }
    if (slug) {
      updates.push(`slug = $${paramIndex++}`);
      params.push(slug);
    }

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

    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      await pool.query('DELETE FROM product_sizes WHERE product_id = $1', [parseInt(id)]);
      
      for (const size of sizes) {
        await pool.query(
          'INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)',
          [parseInt(id), size, 0]
        );
      }
    }

    if (colors && Array.isArray(colors) && colors.length > 0) {
      await pool.query('DELETE FROM product_colors WHERE product_id = $1', [parseInt(id)]);
      
      for (const color of colors) {
        await pool.query(
          'INSERT INTO product_colors (product_id, colorName, colorHex, stock) VALUES ($1, $2, $3, $4)',
          [parseInt(id), color.name || color, color.hex || '#000000', 0]
        );
      }
    }

    const completeProduct = await pool.query(`
      SELECT p.*, 
              c.name as category_name,
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.product_id = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.product_id = p.id) as colors
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `, [parseInt(id)]);

    const formatted = formatProductData(completeProduct.rows[0]);
    res.json(formatted);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
};

// Supprimer un produit (Admin) - AVEC TRANSACTIONS
export const deleteProduct = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const product_id = parseInt(id);

    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    await client.query('BEGIN');
    console.log(`🗑️ Suppression du produit ${product_id}`);

    await client.query('DELETE FROM reviews WHERE product_id = $1', [product_id]);
    await client.query('DELETE FROM product_images WHERE product_id = $1', [product_id]);
    await client.query('DELETE FROM product_sizes WHERE product_id = $1', [product_id]);
    await client.query('DELETE FROM product_colors WHERE product_id = $1', [product_id]);
    await client.query('DELETE FROM order_items WHERE product_id = $1', [product_id]);
    await client.query('DELETE FROM products WHERE id = $1', [product_id]);

    await client.query('COMMIT');

    console.log(`✅ Produit ${product_id} supprimé`);
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      console.error('Rollback error:', e);
    }
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  } finally {
    client.release();
  }
};

// Ajouter une image à un produit
export const addProductImage = async (req, res) => {
  try {
    const { product_id } = req.params;
    const { image_url, is_main_image, is_hover_image, order } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: 'L\'URL de l\'image est obligatoire' });
    }

    if (!product_id || isNaN(product_id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const productExists = await pool.query('SELECT id FROM products WHERE id = $1', [parseInt(product_id)]);
    if (productExists.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }
    
    const result = await pool.query(
      'INSERT INTO product_images (product_id, image_url, is_main_image, is_hover_image, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [parseInt(product_id), image_url, is_main_image || false, is_hover_image || false, order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product image error:', err);
    
    if (err.code === '22001') {
      return res.status(400).json({ error: 'L\'URL de l\'image est trop longue pour la base de données' });
    }
    
    if (err.message && err.message.includes('too long')) {
      return res.status(400).json({ error: 'L\'image est trop volumineux' });
    }
    
    res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'image' });
  }
};

// Ajouter une taille avec stock
export const addProductSize = async (req, res) => {
  try {
    const { product_id } = req.params;
    const { size, stock } = req.body;

    if (!size) {
      return res.status(400).json({ error: 'La taille est obligatoire' });
    }

    if (!product_id || isNaN(product_id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const result = await pool.query(
      'INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3) ON CONFLICT (product_id, size) DO UPDATE SET stock = EXCLUDED.stock RETURNING *',
      [parseInt(product_id), size, Math.max(0, stock || 0)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product size error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la taille' });
  }
};

// Ajouter une couleur avec stock
export const addProductColor = async (req, res) => {
  try {
    const { product_id } = req.params;
    const { colorName, colorHex, stock } = req.body;

    if (!colorName) {
      return res.status(400).json({ error: 'Le nom de la couleur est obligatoire' });
    }

    if (!product_id || isNaN(product_id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const result = await pool.query(
      'INSERT INTO product_colors (product_id, colorName, colorHex, stock) VALUES ($1, $2, $3, $4) ON CONFLICT (product_id, colorName) DO UPDATE SET stock = EXCLUDED.stock RETURNING *',
      [parseInt(product_id), colorName, colorHex || '#000000', Math.max(0, stock || 0)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product color error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la couleur' });
  }
};

// Mettre à jour le stock d'une taille
export const updateSizeStock = async (req, res) => {
  try {
    const { product_id, sizeId } = req.params;
    const { stock } = req.body;

    if (stock === undefined || isNaN(stock)) {
      return res.status(400).json({ error: 'Le stock doit être un nombre' });
    }

    if (!product_id || isNaN(product_id) || !sizeId || isNaN(sizeId)) {
      return res.status(400).json({ error: 'IDs invalides' });
    }

    const result = await pool.query(
      'UPDATE product_sizes SET stock = $1 WHERE id = $2 AND product_id = $3 RETURNING *',
      [Math.max(0, stock), parseInt(sizeId), parseInt(product_id)]
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

// Mettre à jour le stock d'une couleur
export const updateColorStock = async (req, res) => {
  try {
    const { product_id, colorId } = req.params;
    const { stock } = req.body;

    if (stock === undefined || isNaN(stock)) {
      return res.status(400).json({ error: 'Le stock doit être un nombre' });
    }

    if (!product_id || isNaN(product_id) || !colorId || isNaN(colorId)) {
      return res.status(400).json({ error: 'IDs invalides' });
    }

    const result = await pool.query(
      'UPDATE product_colors SET stock = $1 WHERE id = $2 AND product_id = $3 RETURNING *',
      [Math.max(0, stock), parseInt(colorId), parseInt(product_id)]
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
// Obtenir un produit par slug avec tous les détails
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    if (!slug || slug.trim() === '') {
      return res.status(400).json({ error: 'Slug de produit invalide' });
    }

    const product = await pool.query(`
      SELECT p.*, 
              c.name as category_name, 
             g.name as groupName,
             (SELECT json_agg(image_url ORDER BY "order" ASC) FROM product_images WHERE product_id = p.id) as images,
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.product_id = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.product_id = p.id) as colors
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN kpop_groups g ON p.group_id = g.id
      WHERE p.slug = $1
    `, [slug]);

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const reviews = await pool.query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [product.rows[0].id]);

    const formattedProduct = formatProductData({
      ...product.rows[0],
      reviews: reviews.rows
    });

    res.json(formattedProduct);
  } catch (err) {
    console.error('Get product by slug error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
};
