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

    // Calculer le prix total
    let totalPrice = 0;
    const itemsData = [];

    for (const item of items) {
      const product = await pool.query('SELECT * FROM products WHERE id = $1', [item.productId]);
      if (product.rows.length === 0) {
        return res.status(404).json({ error: `Product ${item.productId} not found` });
      }

      const price = parseFloat(product.rows[0].price);
      totalPrice += price * item.quantity;
      itemsData.push({ ...item, price });
    }

    // Créer la commande avec tous les détails
    const order = await pool.query(
      `INSERT INTO orders (
        userId, 
        totalPrice, 
        shippingAddress, 
        paymentMethod, 
        status, 
        paymentStatus,
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
      )
       VALUES ($1, $2, $3, $4, 'pending', 'unpaid', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        userId, 
        totalPrice, 
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
      message: 'Order created successfully',
      order: order.rows[0],
      items: itemsData
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// Obtenir les commandes de l'utilisateur
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    const orders = await pool.query(
      `SELECT * FROM orders WHERE userId = $1 ORDER BY createdAt DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(orders.rows);
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
};

// Obtenir les détails complets d'une commande (utilisateur)
export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND userId = $2',
      [orderId, userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.price, pi.imageUrl
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       LEFT JOIN product_images pi ON p.id = pi.productId AND pi.isMainImage = true
       WHERE oi.orderId = $1
       ORDER BY oi.id`,
      [orderId]
    );

    res.json({
      ...order.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Failed to get order' });
  }
};

// Obtenir les détails complets d'une commande (ADMIN)
export const getOrderByIdAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.price, pi.imageUrl
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       LEFT JOIN product_images pi ON p.id = pi.productId AND pi.isMainImage = true
       WHERE oi.orderId = $1
       ORDER BY oi.id`,
      [orderId]
    );

    res.json({
      ...order.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Failed to get order' });
  }
};

// Annuler une commande
export const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // Vérifier que la commande appartient à l'utilisateur
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND userId = $2',
      [orderId, userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }

    // Restaurer le stock
    const items = await pool.query('SELECT * FROM order_items WHERE orderId = $1', [orderId]);
    for (const item of items.rows) {
      await pool.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    // Mettre à jour le statut
    const result = await pool.query(
      'UPDATE orders SET status = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', orderId]
    );

    res.json({ message: 'Order cancelled', order: result.rows[0] });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// Mettre à jour le statut d'une commande (ADMIN)
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, trackingNumber, notes } = req.body;

    const result = await pool.query(
      `UPDATE orders 
       SET status = COALESCE($1, status),
           paymentStatus = COALESCE($2, paymentStatus),
           trackingNumber = COALESCE($3, trackingNumber),
           notes = COALESCE($4, notes),
           updatedAt = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING *`,
      [status, paymentStatus, trackingNumber, notes, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order updated', order: result.rows[0] });
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
};
