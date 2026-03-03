import pool from '../config/database.js';

// Créer une commande à partir du panier
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, shippingAddress, paymentMethod } = req.body;

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

    // Créer la commande
    const order = await pool.query(
      `INSERT INTO orders (userId, totalPrice, shippingAddress, paymentMethod, status, paymentStatus)
       VALUES ($1, $2, $3, $4, 'pending', 'unpaid')
       RETURNING *`,
      [userId, totalPrice, shippingAddress, paymentMethod]
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

// Obtenir les détails d'une commande
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
      `SELECT oi.*, p.name, p.slug, p.image
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       WHERE oi.orderId = $1`,
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
