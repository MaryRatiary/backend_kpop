import pool from '../config/database.js';

// Obtenir les sous-catégories d'une catégorie
export const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const result = await pool.query(`
      SELECT s.*,
        COUNT(DISTINCT p.id) as productCount
      FROM subcategories s
      LEFT JOIN products p ON s.id = p.subcategoryId
      WHERE s.categoryId = $1
      GROUP BY s.id
      ORDER BY s.name ASC
    `, [categoryId]);
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
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const result = await pool.query(
      'INSERT INTO subcategories (categoryId, name, description, image, slug) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [categoryId, name, description, image, slug]
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
    const slug = name.toLowerCase().replace(/\s+/g, '-');

    const result = await pool.query(
      'UPDATE subcategories SET name = $1, description = $2, image = $3, slug = $4, updatedAt = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [name, description, image, slug, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update subcategory error:', err);
    res.status(500).json({ error: 'Failed to update subcategory' });
  }
};

// Supprimer une sous-catégorie (Admin)
export const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM subcategories WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subcategory not found' });
    }

    res.json({ message: 'Subcategory deleted successfully' });
  } catch (err) {
    console.error('Delete subcategory error:', err);
    res.status(500).json({ error: 'Failed to delete subcategory' });
  }
};
