import express from 'express';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';
import shopifyOrdersService from '../services/shopifyOrders.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/admin/shopify/sync/status
 * Récupérer l'état de synchronisation des commandes
 */
router.get('/sync/status', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    console.log('�� Récupération du statut de synchronisation...');

    // Récupérer les statistiques
    const stats = await shopifyOrdersService.getSyncStats();

    // Récupérer les commandes échouées
    const failedOrders = await pool.query(
      `SELECT local_order_id, error_message, synced_at 
       FROM orders_to_shopify_sync 
       WHERE sync_status = 'failed'
       ORDER BY synced_at DESC
       LIMIT 10`
    );

    // Récupérer les commandes en attente
    const pendingOrders = await pool.query(
      `SELECT COUNT(*) as count 
       FROM orders_to_shopify_sync 
       WHERE sync_status IN ('pending', 'retrying')`
    );

    res.json({
      success: true,
      stats: {
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        pending: stats.pending || 0,
        retrying: stats.retrying || 0
      },
      failedOrders: failedOrders.rows,
      pendingCount: parseInt(pendingOrders.rows[0]?.count || 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur récupération statut:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/shopify/sync/retry
 * Resynchroniser les commandes échouées
 */
router.post('/sync/retry', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    console.log('🔄 Lancement de la resynchronisation...');

    const result = await shopifyOrdersService.retrySyncedOrders();

    res.json({
      success: true,
      message: 'Resynchronisation lancée',
      retried: result.retried,
      success: result.success,
      failed: result.retried - result.success
    });
  } catch (error) {
    console.error('❌ Erreur resynchronisation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/shopify/sync/history
 * Récupérer l'historique de synchronisation
 */
router.get('/sync/history', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const history = await pool.query(
      `SELECT 
        ots.local_order_id,
        ots.shopify_order_id,
        ots.sync_status,
        ots.error_message,
        ots.synced_at,
        o.totalPrice,
        o.email,
        o.status as order_status
       FROM orders_to_shopify_sync ots
       LEFT JOIN orders o ON ots.local_order_id = o.id
       ORDER BY ots.synced_at DESC
       LIMIT $1 OFFSET $2`,
      [Math.min(parseInt(limit), 100), parseInt(offset)]
    );

    const total = await pool.query('SELECT COUNT(*) FROM orders_to_shopify_sync');

    res.json({
      success: true,
      total: parseInt(total.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      history: history.rows
    });
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/shopify/sync/order/:orderId
 * Resynchroniser une commande spécifique
 */
router.post('/sync/order/:orderId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`🔄 Resynchronisation de la commande #${orderId}...`);

    // Récupérer la commande
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [parseInt(orderId)]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = orderResult.rows[0];

    // Envoyer à Shopify
    const result = await shopifyOrdersService.sendOrderToShopify(order);

    res.json({
      success: true,
      message: `Commande #${orderId} resynchronisée`,
      shopifyOrderId: result.shopifyOrderId,
      shopifyOrderNumber: result.shopifyOrderNumber
    });
  } catch (error) {
    console.error(`❌ Erreur resynchronisation commande #${orderId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/shopify/sync/order/:orderId
 * Récupérer le statut de synchronisation d'une commande
 */
router.get('/sync/order/:orderId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const syncStatus = await shopifyOrdersService.getSyncStatus(parseInt(orderId));

    if (!syncStatus) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json({
      success: true,
      orderId: parseInt(orderId),
      syncStatus
    });
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
