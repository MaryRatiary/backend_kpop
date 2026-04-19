import pool from '../config/database.js';

// Dashboard Admin - Statistiques globales
export const getAdminDashboard = async (req, res) => {
  try {
    // Le middleware authorizeAdmin vérifie déjà que c'est un admin
    // Total des ventes
    const totalSales = await pool.query(`
      SELECT COUNT(*) as orderCount, SUM(total_price) as totalRevenue
      FROM orders
      WHERE status = 'completed'
    `);

    // Produits les plus vendus
    const topProducts = await pool.query(`
      SELECT p.id, p.name, p.price, COUNT(oi.id) as salesCount, SUM(oi.quantity) as totalQuantity
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      GROUP BY p.id, p.name, p.price
      ORDER BY salesCount DESC
      LIMIT 10
    `);

    // Catégories populaires
    const topCategories = await pool.query(`
      SELECT c.id, c.name, COUNT(DISTINCT p.id) as productCount, COUNT(DISTINCT oi.id) as salesCount
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      GROUP BY c.id, c.name
      ORDER BY salesCount DESC
      LIMIT 5
    `);

    // Commandes récentes
    const recentOrders = await pool.query(`
      SELECT o.id, o.user_id, u.email, o.total_price, o.status, o.created_at
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    // Stock bas
    const lowStock = await pool.query(`
      SELECT id, name, stock, price
      FROM products
      WHERE stock < 10
      ORDER BY stock ASC
      LIMIT 10
    `);

    res.json({
      dashboard: {
        totalOrders: totalSales.rows[0]?.orderCount || 0,
        totalRevenue: totalSales.rows[0]?.totalRevenue || 0,
        topProducts: topProducts.rows,
        topCategories: topCategories.rows,
        recentOrders: recentOrders.rows,
        lowStock: lowStock.rows
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard' });
  }
};

// Statistiques par période
export const getSalesStats = async (req, res) => {
  try {
    const { period = '7days' } = req.query;
    let dateFilter = "INTERVAL '7 days'";
    
    if (period === '30days') dateFilter = "INTERVAL '30 days'";
    if (period === '90days') dateFilter = "INTERVAL '90 days'";
    if (period === 'all') dateFilter = "INTERVAL '1000 years'";

    const stats = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as orderCount,
        SUM(total_price) as totalRevenue,
        COUNT(DISTINCT user_id) as uniqueCustomers
      FROM orders
      WHERE created_at >= NOW() - ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json({ stats: stats.rows });
  } catch (err) {
    console.error('Sales stats error:', err);
    res.status(500).json({ error: 'Failed to get sales stats' });
  }
};

// Détails d'une commande
export const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await pool.query(`
      SELECT o.*, u.email, u.first_name, u.last_name, u.phone, u.address
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = $1
    `, [orderId]);

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await pool.query(`
      SELECT oi.*, p.name, p.price
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [orderId]);

    res.json({
      order: order.rows[0],
      items: items.rows
    });
  } catch (err) {
    console.error('Order details error:', err);
    res.status(500).json({ error: 'Failed to get order details' });
  }
};

// Mettre à jour le statut d'une commande
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, trackingNumber } = req.body;

    const updates = [];
    const params = [orderId];
    let paramIndex = 2;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (paymentStatus) {
      updates.push(`payment_status = $${paramIndex++}`);
      params.push(paymentStatus);
    }
    if (trackingNumber) {
      updates.push(`tracking_number = $${paramIndex++}`);
      params.push(trackingNumber);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order updated', order: result.rows[0] });
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

// Toutes les commandes (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT o.*, u.email, u.first_name, u.last_name FROM orders o JOIN users u ON o.user_id = u.id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND o.status = $' + (params.length + 1);
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ error: 'Failed to get orders' });
  }
};
