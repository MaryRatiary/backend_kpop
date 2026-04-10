import pool from '../config/database.js';

// ✅ OPTIMISATION: Batch insert au lieu de boucle séquentielle
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

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article est obligatoire' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: 'L\'adresse de livraison est obligatoire' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'La méthode de paiement est obligatoire' });
    }

    // ✅ Valider tous les articles EN PARALLÈLE (au lieu de séquentiel)
    let totalPrice = 0;
    const itemsData = [];
    const productIds = items.map(item => parseInt(item.productId));

    // Récupérer TOUS les produits en 1 requête
    const products = await pool.query(
      `SELECT * FROM products WHERE id = ANY($1)`,
      [productIds]
    );

    const productMap = new Map(products.rows.map(p => [p.id, p]));

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: 'Données d\'article invalides' });
      }

      const product = productMap.get(parseInt(item.productId));
      if (!product) {
        return res.status(404).json({ error: `Produit ${item.productId} non trouvé` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuffisant pour ${product.name}` });
      }

      const price = parseFloat(product.price);
      totalPrice += price * item.quantity;
      itemsData.push({ ...item, price, productId: parseInt(item.productId) });
    }

    // Créer la commande
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

    // ✅ BATCH INSERT au lieu de boucle séquentielle
    if (itemsData.length > 0) {
      const orderItemValues = itemsData.map((item, idx) => {
        const baseIdx = idx * 6;
        return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${baseIdx + 5}, $${baseIdx + 6})`;
      }).join(',');

      const orderItemParams = [];
      itemsData.forEach(item => {
        orderItemParams.push(orderId, item.productId, item.quantity, item.price, item.size || null, item.color || null);
      });

      await pool.query(
        `INSERT INTO order_items (orderId, productId, quantity, price, size, color)
         VALUES ${orderItemValues}`,
        orderItemParams
      );

      // ✅ BATCH UPDATE stock au lieu de boucle séquentielle
      const updateStockValues = itemsData.map((item, idx) => {
        const baseIdx = idx * 2;
        return `($${baseIdx + 1}, $${baseIdx + 2})`;
      }).join(',');

      const updateStockParams = [];
      itemsData.forEach(item => {
        updateStockParams.push(item.quantity, item.productId);
      });

      await pool.query(
        `UPDATE products SET stock = stock - data.quantity 
         FROM (VALUES ${updateStockValues}) AS data(quantity, id)
         WHERE products.id = data.id`,
        updateStockParams
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

// ✅ Obtenir les commandes de l'utilisateur
export const getUserOrders = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const userId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const orders = await pool.query(
      `SELECT id, userId, totalPrice, status, paymentStatus, createdAt 
       FROM orders WHERE userId = $1 
       ORDER BY createdAt DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(orders.rows);
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
};

// ✅ OPTIMISATION: Utiliser LEFT JOIN au lieu de 2 requêtes séquentielles
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

    // ✅ 1 requête avec JOIN au lieu de 2
    const result = await pool.query(
      `SELECT 
        o.id, o.userId, o.totalPrice, o.status, o.paymentStatus, o.createdAt,
        o."firstName", o."lastName", o.email, o.phone, o.city, o."postalCode", o.country,
        o.shippingAddress, o.paymentMethod, o.trackingNumber, o.notes,
        json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.productId,
            'quantity', oi.quantity,
            'price', oi.price,
            'size', oi.size,
            'color', oi.color,
            'productName', p.name,
            'productSlug', p.slug,
            'productPrice', p.price,
            'imageUrl', pi.imageUrl
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.orderId
       LEFT JOIN products p ON oi.productId = p.id
       LEFT JOIN product_images pi ON p.id = pi.productId AND pi.isMainImage = true
       WHERE o.id = $1 AND o.userId = $2
       GROUP BY o.id`,
      [parseInt(orderId), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// ✅ ADMIN version avec 1 requête JOIN
export const getOrderByIdAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    const result = await pool.query(
      `SELECT 
        o.id, o.userId, o.totalPrice, o.status, o.paymentStatus, o.createdAt,
        o."firstName", o."lastName", o.email, o.phone, o.city, o."postalCode", o.country,
        json_agg(
          json_build_object(
            'id', oi.id,
            'productId', oi.productId,
            'quantity', oi.quantity,
            'price', oi.price,
            'productName', p.name,
            'productSlug', p.slug,
            'imageUrl', pi.imageUrl
          )
        ) FILTER (WHERE oi.id IS NOT NULL) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.orderId
       LEFT JOIN products p ON oi.productId = p.id
       LEFT JOIN product_images pi ON p.id = pi.productId AND pi.isMainImage = true
       WHERE o.id = $1
       GROUP BY o.id`,
      [parseInt(orderId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// ...existing code...
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

    // ✅ BATCH restore stock
    const items = await pool.query('SELECT * FROM order_items WHERE orderId = $1', [parseInt(orderId)]);
    
    if (items.rows.length > 0) {
      const updateValues = items.rows.map((item, idx) => {
        const baseIdx = idx * 2;
        return `($${baseIdx + 1}, $${baseIdx + 2})`;
      }).join(',');

      const updateParams = [];
      items.rows.forEach(item => {
        updateParams.push(item.quantity, item.productId);
      });

      await pool.query(
        `UPDATE products SET stock = stock + data.quantity 
         FROM (VALUES ${updateValues}) AS data(quantity, id)
         WHERE products.id = data.id`,
        updateParams
      );
    }

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

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, trackingNumber, notes } = req.body;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

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
