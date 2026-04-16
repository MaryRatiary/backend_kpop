// ✅ CORRIGÉ: Supprimer un produit (Admin) - AVEC TRANSACTIONS ET CASCADE COMPLET
export const deleteProduct = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID de produit invalide' });
    }

    const productId = parseInt(id);

    // Vérifier que le produit existe
    const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // DÉBUT TRANSACTION
    await client.query('BEGIN');
    console.log(`🗑️ Suppression du produit ${productId}`);

    // 1️⃣ Supprimer les reviews
    await client.query('DELETE FROM reviews WHERE productId = $1', [productId]);

    // 2️⃣ Supprimer les images
    await client.query('DELETE FROM product_images WHERE productId = $1', [productId]);

    // 3️⃣ Supprimer les tailles
    await client.query('DELETE FROM product_sizes WHERE productId = $1', [productId]);

    // 4️⃣ Supprimer les couleurs
    await client.query('DELETE FROM product_colors WHERE productId = $1', [productId]);

    // 5️⃣ Supprimer les items de commande
    await client.query('DELETE FROM order_items WHERE productId = $1', [productId]);

    // 6️⃣ Supprimer le produit
    await client.query('DELETE FROM products WHERE id = $1', [productId]);

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    console.log(`✅ Produit ${productId} supprimé`);
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
