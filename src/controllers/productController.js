import pool from '../config/database.js';

// Obtenir tous les produits
export const getAllProducts = async (req, res) => {
  try {
    const { categoryId, groupId, featured, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT 
        p.*,
        c.name as categoryName, 
        g.name as groupName,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isMainImage = true ORDER BY "order" ASC LIMIT 1) as image,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isHoverImage = true ORDER BY "order" ASC LIMIT 1) as hoverImage,
        (SELECT json_agg(imageUrl ORDER BY "order" ASC) FROM product_images WHERE productId = p.id) as images,
        (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.productId = p.id) as sizes,
        (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.productId = p.id) as colors
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
    if (featured) {
      query += ' AND p.featured = true';
    }

    query += ' ORDER BY p.createdAt DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(Math.min(parseInt(limit) || 50, 100), parseInt(offset) || 0);

    const result = await pool.query(query, params);
    res.json(result.rows);
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
             c.name as categoryName, 
             g.name as groupName,
             (SELECT json_agg(imageUrl ORDER BY "order" ASC) FROM product_images WHERE productId = p.id) as images,
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.productId = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.productId = p.id) as colors
      FROM products p
      LEFT JOIN categories c ON p.categoryId = c.id
      LEFT JOIN kpop_groups g ON p.groupId = g.id
      WHERE p.id = $1
    `, [parseInt(id)]);

    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    const reviews = await pool.query('SELECT * FROM reviews WHERE productId = $1 ORDER BY createdAt DESC', [id]);

    res.json({
      ...product.rows[0],
      reviews: reviews.rows
    });
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
      originalPrice, 
      categoryId, 
      stock,
      sizes,
      colors
    } = req.body;

    // Validation
    if (!name || !price) {
      return res.status(400).json({ error: 'Le nom et le prix sont obligatoires' });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Le prix doit être un nombre positif' });
    }

    // Générer un slug unique avec timestamp si nécessaire
    let slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Vérifier si ce slug existe déjà
    const existingSlug = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (existingSlug.rows.length > 0) {
      // Ajouter un timestamp pour rendre le slug unique
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

    // Ajouter les tailles si fournies
    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      for (const size of sizes) {
        // Déterminer le stock par défaut selon la taille
        const defaultStock = ['XS', 'XXL'].includes(size) ? 10 : 15;
        await pool.query(
          'INSERT INTO product_sizes (productId, size, stock) VALUES ($1, $2, $3) ON CONFLICT (productId, size) DO NOTHING',
          [productId, size, defaultStock]
        );
      }
    }

    // Ajouter les couleurs si fournies
    if (colors && Array.isArray(colors) && colors.length > 0) {
      for (const color of colors) {
        // Déterminer le stock par défaut selon la couleur
        const colorName = color.name || color;
        const defaultStock = ['noir', 'Noir', 'black', 'Black'].includes(colorName) ? 20 : 15;
        await pool.query(
          'INSERT INTO product_colors (productId, colorName, colorHex, stock) VALUES ($1, $2, $3, $4) ON CONFLICT (productId, colorName) DO NOTHING',
          [productId, colorName, color.hex || '#000000', defaultStock]
        );
      }
    }

    // Récupérer le produit complète avec ses relations
    const completeProduct = await pool.query(`
      SELECT p.*, 
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.productId = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.productId = p.id) as colors
      FROM products p
      WHERE p.id = $1
    `, [productId]);

    res.status(201).json(completeProduct.rows[0]);
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
      originalPrice, 
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
      // Générer un slug limité à 50 caractères max
      let baseSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Limiter la longueur pour laisser de la place au timestamp
      if (baseSlug.length > 40) {
        baseSlug = baseSlug.substring(0, 40);
      }
      
      slug = baseSlug;
      
      // Vérifier si ce slug existe déjà (et qu'il n'appartient pas au produit actuel)
      const existingSlug = await pool.query('SELECT id FROM products WHERE slug = $1 AND id != $2', [slug, parseInt(id)]);
      if (existingSlug.rows.length > 0) {
        // Ajouter un timestamp pour rendre le slug unique
        const timestamp = Math.floor(Date.now() / 1000).toString();
        // Réduire le slug si nécessaire pour laisser de la place au timestamp
        const maxBaseLength = 50 - timestamp.length - 1; // -1 pour le tiret
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
    if (originalPrice !== undefined) {
      updates.push(`originalPrice = $${paramIndex++}`);
      params.push(originalPrice);
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramIndex++}`);
      params.push(Math.max(0, stock));
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

    // Mettre à jour les tailles si fournies
    if (sizes && Array.isArray(sizes) && sizes.length > 0) {
      // Supprimer les anciennes tailles
      await pool.query('DELETE FROM product_sizes WHERE productId = $1', [parseInt(id)]);
      
      // Ajouter les nouvelles tailles
      for (const size of sizes) {
        await pool.query(
          'INSERT INTO product_sizes (productId, size, stock) VALUES ($1, $2, $3)',
          [parseInt(id), size, 0]
        );
      }
    }

    // Mettre à jour les couleurs si fournies
    if (colors && Array.isArray(colors) && colors.length > 0) {
      // Supprimer les anciennes couleurs
      await pool.query('DELETE FROM product_colors WHERE productId = $1', [parseInt(id)]);
      
      // Ajouter les nouvelles couleurs
      for (const color of colors) {
        await pool.query(
          'INSERT INTO product_colors (productId, colorName, colorHex, stock) VALUES ($1, $2, $3, $4)',
          [parseInt(id), color.name || color, color.hex || '#000000', 0]
        );
      }
    }

    // Récupérer le produit complète avec ses relations
    const completeProduct = await pool.query(`
      SELECT p.*, 
             (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.productId = p.id) as sizes,
             (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.productId = p.id) as colors
      FROM products p
      WHERE p.id = $1
    `, [parseInt(id)]);

    res.json(completeProduct.rows[0]);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du produit' });
  }
};

// Supprimer un produit (Admin)
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

// Ajouter une image à un produit
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

    // Vérifier que le produit existe
    const productExists = await pool.query('SELECT id FROM products WHERE id = $1', [parseInt(productId)]);
    if (productExists.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // PostgreSQL TEXT peut accepter des données très grandes (jusqu'à environ 1GB)
    // Pas besoin de valider la longueur pour les images Base64
    
    const result = await pool.query(
      'INSERT INTO product_images (productId, imageUrl, isMainImage, isHoverImage, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [parseInt(productId), imageUrl, isMainImage || false, isHoverImage || false, order || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add product image error:', err);
    
    // Gérer les erreurs spécifiques
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

// Ajouter une couleur avec stock
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

// Mettre à jour le stock d'une taille (temps réel)
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

// Mettre à jour le stock d'une couleur (temps réel)
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
