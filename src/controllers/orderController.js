import pool from '../config/database.js';

// Créer une commande à partir du panier
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      items, 
      shippingAddress, 
      paymentMethod,
      firstName,
      lastName,
      email,
      phone,
      city,
      postalCode,
      country,
      latitude,
      longitude,
      notes
    } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article est obligatoire' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: 'L\'adresse de livraison est obligatoire' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'La méthode de paiement est obligatoire' });
    }

    // Calculer le prix total et valider les articles
    let totalPrice = 0;
    const itemsData = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: 'Données d\'article invalides' });
      }

      const product = await pool.query('SELECT * FROM products WHERE id = $1', [parseInt(item.productId)]);
      if (product.rows.length === 0) {
        return res.status(404).json({ error: `Produit ${item.productId} non trouvé` });
      }

      if (product.rows[0].stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuffisant pour ${product.rows[0].name}` });
      }

      const price = parseFloat(product.rows[0].price);
      totalPrice += price * item.quantity;
      itemsData.push({ ...item, price, productId: parseInt(item.productId) });
    }

    // Créer la commande avec tous les détails (utiliser les noms corrects de colonnes)
    const order = await pool.query(
      `INSERT INTO orders (
        userId, 
        totalPrice, 
        shippingAddress, 
        paymentMethod, 
        status, 
        paymentStatus,
        "firstName",
        "lastName",
        email,
        phone,
        city,
        "postalCode",
        country,
        latitude,
        longitude,
        notes
      )
       VALUES ($1, $2, $3, $4, 'pending', 'unpaid', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        userId, 
        totalPrice, 
        shippingAddress, 
        paymentMethod,
        firstName || null,
        lastName || null,
        email || null,
        phone || null,
        city || null,
        postalCode || null,
        country || null,
        latitude || null,
        longitude || null,
        notes || null
      ]
    );

    const orderId = order.rows[0].id;

    // Ajouter les articles de la commande
    for (const item of itemsData) {
      await pool.query(
        `INSERT INTO order_items (orderId, productId, quantity, price, size, color)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.productId, item.quantity, item.price, item.size || null, item.color || null]
      );

      // Réduire le stock du produit
      await pool.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    res.status(201).json({
      message: 'Commande créée avec succès',
      order: order.rows[0],
      items: itemsData
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
};

// Obtenir les commandes de l'utilisateur
export const getUserOrders = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    if (isNaN(limit) || isNaN(offset) || limit < 1) {
      return res.status(400).json({ error: 'Paramètres de pagination invalides' });
    }

    const orders = await pool.query(
      `SELECT * FROM orders WHERE userId = $1 ORDER BY createdAt DESC LIMIT $2 OFFSET $3`,
      [userId, Math.min(parseInt(limit), 100), parseInt(offset)]
    );

    res.json(orders.rows);
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
};

// Obtenir les détails complets d'une commande (utilisateur)
export const getOrderById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND userId = $2',
      [parseInt(orderId), userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const items = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.price, pi.imageUrl
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       LEFT JOIN product_images pi ON p.id = pi.productId AND pi.isMainImage = true
       WHERE oi.orderId = $1
       ORDER BY oi.id`,
      [parseInt(orderId)]
    );

    res.json({
      ...order.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// Obtenir les détails complets d'une commande (ADMIN)
export const getOrderByIdAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [parseInt(orderId)]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const items = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.price, pi.imageUrl
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       LEFT JOIN product_images pi ON p.id = pi.productId AND pi.isMainImage = true
       WHERE oi.orderId = $1
       ORDER BY oi.id`,
      [parseInt(orderId)]
    );

    res.json({
      ...order.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// Annuler une commande
export const cancelOrder = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    // Vérifier que la commande appartient à l'utilisateur
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND userId = $2',
      [parseInt(orderId), userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    if (order.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Seules les commandes en attente peuvent être annulées' });
    }

    // Restaurer le stock
    const items = await pool.query('SELECT * FROM order_items WHERE orderId = $1', [parseInt(orderId)]);
    for (const item of items.rows) {
      await pool.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    // Mettre à jour le statut
    const result = await pool.query(
      'UPDATE orders SET status = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', parseInt(orderId)]
    );

    res.json({ message: 'Commande annulée', order: result.rows[0] });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la commande' });
  }
};

// Mettre à jour le statut d'une commande (ADMIN)
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, trackingNumber, notes } = req.body;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    // Valider les statuts
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const validPaymentStatuses = ['unpaid', 'paid', 'refunded'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut de commande invalide' });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Statut de paiement invalide' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = COALESCE($1, status),
           paymentStatus = COALESCE($2, paymentStatus),
           trackingNumber = COALESCE($3, trackingNumber),
           notes = COALESCE($4, notes),
           updatedAt = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING *`,
      [status || null, paymentStatus || null, trackingNumber || null, notes || null, parseInt(orderId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json({ message: 'Commande mise à jour', order: result.rows[0] });
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande' });
  }
};
