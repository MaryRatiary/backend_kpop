const db = require('../config/database');

// Récupérer la description complète d'une catégorie
exports.getCategoryDescription = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const query = `
      SELECT id, name, description, full_description 
      FROM categories 
      WHERE id = ? OR slug = ?
    `;
    
    const [category] = await db.query(query, [categoryId, categoryId]);
    
    if (!category || category.length === 0) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.json(category[0]);
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Mettre à jour la description d'une catégorie
exports.updateCategoryDescription = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { description, full_description } = req.body;
    
    // Vérifier que l'utilisateur est admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    const query = `
      UPDATE categories 
      SET description = ?, full_description = ?, updated_at = NOW()
      WHERE id = ? OR slug = ?
    `;
    
    const result = await db.query(query, [
      description,
      full_description,
      categoryId,
      categoryId
    ]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.json({ 
      message: 'Description mise à jour avec succès',
      categoryId,
      description,
      full_description
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Récupérer toutes les catégories avec leurs descriptions
exports.getAllCategoriesWithDescriptions = async (req, res) => {
  try {
    const query = `
      SELECT id, name, slug, description, full_description, image
      FROM categories
      ORDER BY order_index ASC
    `;
    
    const [categories] = await db.query(query);
    
    res.json(categories);
  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
