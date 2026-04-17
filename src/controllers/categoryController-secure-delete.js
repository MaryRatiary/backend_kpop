import pool from '../config/database.js';

/**
 * ✅ NOUVELLE FONCTION: Vérifier ce qui sera supprimé AVANT suppression
 * Retourne un résumé complet des données imbriquées
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

    // 1️⃣ Récupérer les sous-catégories directes avec détails
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

    // 2️⃣ Récupérer TOUS les enfants récursifs (pour compter les données)
    const allChildrenResult = await pool.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id, name FROM categories WHERE parentid = $1
        UNION ALL
        SELECT c.id, c.name FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      SELECT id, name FROM category_tree
    `, [categoryId]);

    const allChildrenIds = allChildrenResult.rows.map(r => r.id);

    // 3️⃣ Récupérer les produits dans la catégorie principale ET les enfants
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
    
    // Grouper les produits par catégorie
    const productsByCategory = {};
    allProducts.forEach(product => {
      if (!productsByCategory[product.categoryId]) {
        productsByCategory[product.categoryId] = {
          categoryName: product.categoryName,
          products: []
        };
      }
      productsByCategory[product.categoryId].products.push({
        id: product.id,
        name: product.name
      });
    });

    // 4️⃣ Compter les enfants à plusieurs niveaux
    const totalChildrenCount = allChildrenIds.length;
    const productsInDirectCategory = allProducts.filter(p => p.categoryId === categoryId).length;
    const productsInChildCategories = allProducts.filter(p => p.categoryId !== categoryId).length;
    const totalProductsCount = allProducts.length;

    // Déterminer si la suppression est "dangereuse"
    const isDangerous = directChildren.length > 0 || totalProductsCount > 0;

    // Générer le texte de confirmation requis
    let confirmationTextRequired = '';
    if (isDangerous) {
      confirmationTextRequired = `Je veux effacer tout`;
    }

    res.json({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        level: category.level
      },
      isDangerous: isDangerous,
      summary: {
        totalChildCategories: totalChildrenCount,
        directChildCategories: directChildren.length,
        totalProducts: totalProductsCount,
        productsInMainCategory: productsInDirectCategory,
        productsInChildCategories: productsInChildCategories
      },
      warningMessage: isDangerous 
        ? `⚠️ ATTENTION ! Cette catégorie contient ${totalProductsCount > 0 ? totalProductsCount + ' produit(s)' : ''}${totalProductsCount > 0 && directChildren.length > 0 ? ' et ' : ''}${directChildren.length > 0 ? directChildren.length + ' sous-catégorie(s)' : ''}. La suppression est IRRÉVERSIBLE !`
        : '✅ Cette catégorie est vide et peut être supprimée immédiatement.',
      confirmationTextRequired: confirmationTextRequired,
      data: {
        directChildren: directChildren.map(child => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          productCount: child.productCount,
          childCategoryCount: child.childCategoryCount,
          hasData: child.productCount > 0 || child.childCategoryCount > 0
        })),
        productsByCategory: productsByCategory,
        allProductsCount: totalProductsCount
      }
    });
  } catch (err) {
    console.error('Pre-delete check error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification', details: err.message });
  }
};

/**
 * ✅ SUPPRESSION SÉCURISÉE: Exiger une confirmation explicite
 * Les catégories vides sont supprimées immédiatement
 * Les catégories avec données doivent être confirmées avec le texte exact
 */
export const deleteCategory = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { confirmationText, force } = req.body;

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

    // Vérifier s'il y a des données dangereuses
    const dataCheck = await client.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE id = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      SELECT 
        COUNT(DISTINCT CASE WHEN c.parentid = $1 THEN c.id ELSE NULL END)::integer as directChildren,
        COUNT(DISTINCT CASE WHEN c.parentid != $1 OR c.parentid IS NULL THEN c.id ELSE NULL END)::integer as allChildren,
        COUNT(DISTINCT p.id)::integer as productCount
      FROM categories c
      LEFT JOIN products p ON p.categoryId = c.id
      WHERE c.id IN (SELECT id FROM category_tree) OR c.parentid = $1
    `, [categoryId]);

    const data = dataCheck.rows[0];
    const hasDangerousData = data.directChildren > 0 || data.productCount > 0;

    // 🔐 SÉCURITÉ: Si y'a des données dangereuses, exiger la confirmation
    if (hasDangerousData && !force) {
      // Vérifier que le texte de confirmation est exact
      if (confirmationText !== 'Je veux effacer tout') {
        return res.status(400).json({
          error: 'Confirmation non validée',
          message: `Vous devez taper exactement: "Je veux effacer tout" pour confirmer la suppression`,
          expected: 'Je veux effacer tout',
          received: confirmationText,
          requiresConfirmation: true,
          isDangerous: true,
          summary: {
            directChildren: data.directChildren,
            allChildren: data.allChildren,
            productCount: data.productCount
          }
        });
      }
    }

    // DÉBUT TRANSACTION
    await client.query('BEGIN');
    console.log(`🗑️ SUPPRESSION CONFIRMÉE: Catégorie "${category.name}" (ID: ${categoryId})`);

    // 1️⃣ Récupérer TOUS les IDs de produits (catégorie + enfants récursifs)
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
    console.log(`📊 Produits à supprimer: ${productIds.length}`);

    // 2️⃣ Supprimer les données liées aux produits
    if (productIds.length > 0) {
      await client.query('DELETE FROM reviews WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_images WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_colors WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM product_sizes WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM order_items WHERE productId = ANY($1)', [productIds]);
      await client.query('DELETE FROM products WHERE id = ANY($1)', [productIds]);
    }

    // 3️⃣ Supprimer les catégories enfants (récursivement)
    await client.query(`
      WITH RECURSIVE category_tree AS (
        SELECT id FROM categories WHERE parentid = $1
        UNION ALL
        SELECT c.id FROM categories c
        INNER JOIN category_tree ct ON c.parentid = ct.id
      )
      DELETE FROM categories WHERE id IN (SELECT id FROM category_tree)
    `, [categoryId]);

    // 4️⃣ Supprimer la catégorie principale
    await client.query('DELETE FROM categories WHERE id = $1', [categoryId]);

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    console.log(`✅ Catégorie "${category.name}" et ses données supprimées`);
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
