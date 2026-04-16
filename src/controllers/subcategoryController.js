import pool from '../config/database.js';

// Obtenir les sous-catégories d'une catégorie
export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!categoryId || isNaN(parseInt(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    const result = await pool.query(`
      SELECT s.*,
        COUNT(DISTINCT p.id) as productCount
      FROM subcategories s
      LEFT JOIN products p ON s.id = p.subcategoryId
      WHERE s.categoryId = $1
      GROUP BY s.id
      ORDER BY s.name ASC
    `, [parseInt(categoryId)]);
    res.json(result.rows);
  } catch (err) {
    console.error('Get subcategories error:', err);
    res.status(500).json({ error: 'Failed to get subcategories' });
  }
};

// Créer une sous-catégorie (Admin)
export const createSubcategory = async (req, res) => {
  try {
    const { categoryId, name, description, image } = req.body;
    
    if (!categoryId || isNaN(parseInt(categoryId))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Le nom est obligatoire' });
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const result = await pool.query(
      'INSERT INTO subcategories (categoryId, name, description, image, slug) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [parseInt(categoryId), name, description || null, image || null, slug]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create subcategory error:', err);
    res.status(500).json({ error: 'Failed to create subcategory' });
  }
};

// Mettre à jour une sous-catégorie (Admin)
export const updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID invalide' });
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

    const query = `UPDATE subcategories SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update subcategory error:', err);
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
};

// ✅ CORRIGÉ: Supprimer une sous-catégorie (Admin) - AVEC TRANSACTIONS
export const deleteSubcategory = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID invalide' });
    }

    const subcategoryId = parseInt(id);

    // Vérifier que la sous-catégorie existe
    const subcatCheck = await client.query('SELECT id FROM subcategories WHERE id = $1', [subcategoryId]);
    if (subcatCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    // DÉBUT TRANSACTION
    await client.query('BEGIN');
    console.log(`🗑️ Suppression de la sous-catégorie ${subcategoryId}`);

    // 1️⃣ Récupérer tous les IDs de produits de cette sous-catégorie
    const productIds = await client.query('SELECT id FROM products WHERE subcategoryId = $1', [subcategoryId]);
    const productIdList = productIds.rows.map(r => r.id);

    // 2️⃣ Supprimer les dépendances des produits
    if (productIdList.length > 0) {
      await client.query('DELETE FROM reviews WHERE productId = ANY($1)', [productIdList]);
      await client.query('DELETE FROM product_images WHERE productId = ANY($1)', [productIdList]);
      await client.query('DELETE FROM product_colors WHERE productId = ANY($1)', [productIdList]);
      await client.query('DELETE FROM product_sizes WHERE productId = ANY($1)', [productIdList]);
      await client.query('DELETE FROM order_items WHERE productId = ANY($1)', [productIdList]);
      await client.query('DELETE FROM products WHERE subcategoryId = $1', [subcategoryId]);
    }

    // 3️⃣ Supprimer la sous-catégorie
    await client.query('DELETE FROM subcategories WHERE id = $1', [subcategoryId]);

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    console.log(`✅ Sous-catégorie ${subcategoryId} supprimée`);
    res.json({ message: 'Subcategory deleted successfully' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      console.error('Rollback error:', e);
    }
    console.error('Delete subcategory error:', err);
    res.status(500).json({ error: 'Failed to delete subcategory', details: err.message });
  } finally {
    client.release();
  }
};
