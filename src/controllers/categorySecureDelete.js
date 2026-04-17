import pool from '../config/database.js';

/**
 * ✅ VÉRIFICATION PRÉ-SUPPRESSION
 * Retourne les détails sur ce qui sera supprimé
 */
export const preDeleteCategoryCheck = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    const categoryId = parseInt(id);

    // Vérifier si la catégorie existe
    const categoryResult = await pool.query(
      'SELECT id, name, slug, level FROM categories WHERE id = $1',
      [categoryId]
    );
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    const category = categoryResult.rows[0];

    // Récupérer les sous-catégories directes
    const directChildrenResult = await pool.query(`
      SELECT c.id, c.name, c.slug,
        COUNT(DISTINCT p.id)::integer as productCount,
        COUNT(DISTINCT gc.id)::integer as childCategoryCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.categoryId
      LEFT JOIN categories gc ON c.id = gc.parentid
      WHERE c.parentid = $1
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.name ASC
    `, [categoryId]);

    const directChildren = directChildrenResult.rows;

    // Récupérer les produits dans la catégorie + enfants
    const productsResult = await pool.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE id = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      SELECT p.id, p.name, p.categoryId,
        c.name as categoryName
      FROM products p
      LEFT JOIN categories c ON p.categoryId = c.id
      WHERE p.categoryId IN (SELECT id FROM category_tree)
      ORDER BY p.categoryId, p.name ASC
    `, [categoryId]);

    const allProducts = productsResult.rows;
    const totalProductsCount = allProducts.length;
    const isDangerous = directChildren.length > 0 || totalProductsCount > 0;

    res.json({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        level: category.level
      },
      isDangerous: isDangerous,
      summary: {
        directChildCategories: directChildren.length,
        totalProducts: totalProductsCount
      },
      warningMessage: isDangerous 
        ? `⚠️ ATTENTION ! La catégorie "${category.name}" contient ${totalProductsCount > 0 ? totalProductsCount + ' produit(s)' : ''}${totalProductsCount > 0 && directChildren.length > 0 ? ' et ' : ''}${directChildren.length > 0 ? directChildren.length + ' sous-catégorie(s)' : ''}. La suppression est IRRÉVERSIBLE !`
        : `✅ La catégorie "${category.name}" est vide et peut être supprimée immédiatement.`,
      confirmationTextRequired: isDangerous ? 'Je veux effacer tout' : null,
      data: {
        directChildren: directChildren.map(child => ({
          id: child.id,
          name: child.name,
          productCount: child.productCount,
          childCategoryCount: child.childCategoryCount
        })),
        products: allProducts
      }
    });
  } catch (err) {
    console.error('Pre-delete check error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification', details: err.message });
  }
};

/**
 * ✅ SUPPRESSION SÉCURISÉE
 * Exige une confirmation explicite pour les catégories avec données
 */
export const deleteCategorySecure = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { confirmationText } = req.body;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID de catégorie invalide' });
    }

    const categoryId = parseInt(id);

    // Vérifier si la catégorie existe
    const categoryCheck = await client.query(
      'SELECT id, name FROM categories WHERE id = $1',
      [categoryId]
    );
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    const category = categoryCheck.rows[0];

    // Vérifier les données dangereuses
    const dataCheck = await client.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE id = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      SELECT 
        COUNT(DISTINCT CASE WHEN c.parentid = $1 THEN c.id ELSE NULL END)::integer as directChildren,
        COUNT(DISTINCT p.id)::integer as productCount
      FROM categories c
      LEFT JOIN products p ON p.categoryId = c.id
      WHERE c.id IN (SELECT id FROM category_tree) OR c.parentid = $1
    `, [categoryId]);

    const data = dataCheck.rows[0];
    const hasDangerousData = data.directChildren > 0 || data.productCount > 0;

    // 🔐 SÉCURITÉ: Vérifier la confirmation
    if (hasDangerousData) {
      if (confirmationText !== 'Je veux effacer tout') {
        return res.status(400).json({
          error: 'Confirmation non validée',
          message: `Vous devez taper exactement: "Je veux effacer tout"`,
          isDangerous: true,
          summary: {
            directChildren: data.directChildren,
            productCount: data.productCount
          }
        });
      }
    }

    // DÉBUT TRANSACTION
    await client.query('BEGIN');
    console.log(`��️ SUPPRESSION CONFIRMÉE: "${category.name}"`);

    // Récupérer tous les IDs de produits
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

    // Supprimer les données liées aux produits
    if (productIds.length > 0) {
      await client.query('DELETE FROM reviews WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_images WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_colors WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_sizes WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM order_items WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM products WHERE id = ANY($1)', [productIds]);
    }

    // Supprimer les catégories enfants
    await client.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE parentid = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      DELETE FROM categories WHERE id IN (SELECT id FROM category_tree)
    `, [categoryId]);

    // Supprimer la catégorie principale
    await client.query('DELETE FROM categories WHERE id = $1', [categoryId]);

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    console.log(`✅ Catégorie supprimée avec succès`);
    res.json({
      success: true,
      message: `La catégorie "${category.name}" a été supprimée avec succès`,
      deleted: {
        category: category.name,
        productsCount: productIds.length,
        childCategoriesCount: data.directChildren
      }
    });
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
