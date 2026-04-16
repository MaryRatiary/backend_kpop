import pool from '../config/database.js';

// Obtenir tous les avis d'un produit
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10, offset = 0, sortBy = 'recent' } = req.query;

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'ID produit invalide' });
    }

    let orderBy = 'r.createdat DESC';
    if (sortBy === 'rating-high') orderBy = 'r.rating DESC, r.createdat DESC';
    if (sortBy === 'rating-low') orderBy = 'r.rating ASC, r.createdat DESC';
    if (sortBy === 'helpful') orderBy = 'r.helpful DESC, r.createdat DESC';

    const reviewsResult = await pool.query(
      `SELECT 
        r.id, r.productid, r.author, r.email, r.rating, r.title, r.content,
        r.verified, r.helpful, r.nothelpful, r.createdat,
        json_agg(json_build_object('id', ri.id, 'imageUrl', ri.imageurl, 'order', ri."order")) FILTER (WHERE ri.id IS NOT NULL) as images
      FROM reviews r
      LEFT JOIN review_images ri ON r.id = ri.reviewid
      WHERE r.productid = $1
      GROUP BY r.id
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3`,
      [parseInt(productId), parseInt(limit), parseInt(offset)]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM reviews WHERE productid = $1',
      [parseInt(productId)]
    );

    const avgResult = await pool.query(
      'SELECT AVG(rating) as averageRating FROM reviews WHERE productid = $1',
      [parseInt(productId)]
    );

    res.json({
      reviews: reviewsResult.rows,
      total: parseInt(countResult.rows[0].count),
      average: parseFloat(avgResult.rows[0].averageRating) || 0
    });
  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des avis' });
  }
};

// Créer un nouvel avis
export const createReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { author, email, rating, title, content, images = [] } = req.body;

    if (!productId || isNaN(productId)) {
      return res.status(400).json({ error: 'ID produit invalide' });
    }

    if (!author || !email || !rating || !title || !content) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    if (rating < 1 || rating > 5 || isNaN(rating)) {
      return res.status(400).json({ error: 'Note invalide (1-5)' });
    }

    if (!Array.isArray(images) || images.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 images autorisées' });
    }

    // Vérifier que le produit existe
    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [parseInt(productId)]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Créer l'avis
    const reviewResult = await pool.query(
      `INSERT INTO reviews (productid, author, email, rating, title, content, verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [parseInt(productId), author, email, parseInt(rating), title, content]
    );

    const reviewId = reviewResult.rows[0].id;

    // Ajouter les images
    if (images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        if (imageUrl && typeof imageUrl === 'string') {
          await pool.query(
            `INSERT INTO review_images (reviewid, imageurl, "order")
             VALUES ($1, $2, $3)`,
            [reviewId, imageUrl, i]
          );
        }
      }
    }

    // Récupérer l'avis complet avec images
    const completeReview = await pool.query(
      `SELECT 
        r.id, r.productid, r.author, r.email, r.rating, r.title, r.content,
        r.verified, r.helpful, r.nothelpful, r.createdat,
        json_agg(json_build_object('id', ri.id, 'imageUrl', ri.imageurl, 'order', ri."order")) FILTER (WHERE ri.id IS NOT NULL) as images
      FROM reviews r
      LEFT JOIN review_images ri ON r.id = ri.reviewid
      WHERE r.id = $1
      GROUP BY r.id`,
      [reviewId]
    );

    res.status(201).json(completeReview.rows[0]);
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'avis' });
  }
};

// Marquer comme utile
export const markAsHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!reviewId || isNaN(reviewId)) {
      return res.status(400).json({ error: 'ID avis invalide' });
    }

    const result = await pool.query(
      'UPDATE reviews SET helpful = helpful + 1 WHERE id = $1 RETURNING helpful',
      [parseInt(reviewId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    res.json({ helpful: result.rows[0].helpful });
  } catch (err) {
    console.error('Mark helpful error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};

// Marquer comme non utile
export const markAsNotHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!reviewId || isNaN(reviewId)) {
      return res.status(400).json({ error: 'ID avis invalide' });
    }

    const result = await pool.query(
      'UPDATE reviews SET nothelpful = nothelpful + 1 WHERE id = $1 RETURNING nothelpful',
      [parseInt(reviewId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    res.json({ notHelpful: result.rows[0].nothelpful });
  } catch (err) {
    console.error('Mark not helpful error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};

// ✅ CORRIGÉ: Supprimer un avis (admin ou auteur) - AVEC TRANSACTIONS
export const deleteReview = async (req, res) => {
  const client = await pool.connect();
  try {
    const { reviewId } = req.params;

    if (!reviewId || isNaN(reviewId)) {
      return res.status(400).json({ error: 'ID avis invalide' });
    }

    const reviewIdInt = parseInt(reviewId);

    // Vérifier que l'avis existe
    const reviewCheck = await client.query('SELECT id FROM reviews WHERE id = $1', [reviewIdInt]);
    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }

    // DÉBUT TRANSACTION
    await client.query('BEGIN');
    console.log(`🗑️ Suppression de l'avis ${reviewIdInt}`);

    // 1️⃣ Supprimer les images de l'avis
    await client.query('DELETE FROM review_images WHERE reviewid = $1', [reviewIdInt]);

    // 2️⃣ Supprimer l'avis
    await client.query('DELETE FROM reviews WHERE id = $1', [reviewIdInt]);

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    console.log(`✅ Avis ${reviewIdInt} supprimé`);
    res.json({ message: 'Avis supprimé avec succès' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (e) {
      console.error('Rollback error:', e);
    }
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression', details: err.message });
  } finally {
    client.release();
  }
};
