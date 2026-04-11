import express from 'express';
import shopifyClient from '../services/shopifyClient.js';
import shopifySync from '../services/shopifySync.js';
import shopifyWebhooks from '../services/shopifyWebhooks.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * ============================================
 * ROUTES PUBLIQUES - INFORMATIONS SHOPIFY
 * ============================================
 */

/**
 * GET /api/shopify/health
 * Vérifier la connexion à Shopify
 */
router.get('/health', async (req, res) => {
  try {
    const shop = await shopifyClient.testConnection();
    res.json({ 
      status: 'connected',
      shop: shop.name,
      domain: shop.domain,
      email: shop.email
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Impossible de se connecter à Shopify' 
    });
  }
});

/**
 * ============================================
 * WEBHOOKS - ÉVÉNEMENTS SHOPIFY
 * ============================================
 */

/**
 * POST /api/shopify/webhooks/orders/create
 * Webhook: Nouvelle commande créée
 */
router.post('/webhooks/orders/create', async (req, res) => {
  try {
    // Vérifier la signature
    if (!shopifyWebhooks.verifyWebhookSignature(req)) {
      console.warn('⚠️ Signature webhook invalide');
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const order = req.body;
    await shopifyWebhooks.handleOrderCreated(order);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur webhook order/create:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shopify/webhooks/orders/updated
 * Webhook: Commande mise à jour
 */
router.post('/webhooks/orders/updated', async (req, res) => {
  try {
    if (!shopifyWebhooks.verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const order = req.body;
    await shopifyWebhooks.handleOrderUpdated(order);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur webhook order/updated:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shopify/webhooks/orders/paid
 * Webhook: Paiement confirmé
 */
router.post('/webhooks/orders/paid', async (req, res) => {
  try {
    if (!shopifyWebhooks.verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const order = req.body;
    await shopifyWebhooks.handleOrderPaid(order);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur webhook order/paid:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shopify/webhooks/fulfillments/create
 * Webhook: Expédition créée
 */
router.post('/webhooks/fulfillments/create', async (req, res) => {
  try {
    if (!shopifyWebhooks.verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const fulfillment = req.body;
    await shopifyWebhooks.handleFulfillmentCreated(fulfillment);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur webhook fulfillment/create:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shopify/webhooks/refunds/create
 * Webhook: Remboursement créé
 */
router.post('/webhooks/refunds/create', async (req, res) => {
  try {
    if (!shopifyWebhooks.verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const refund = req.body;
    await shopifyWebhooks.handleRefundCreated(refund);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur webhook refund/create:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * ROUTES ADMIN - SYNCHRONISATION
 * ============================================
 */

/**
 * POST /api/shopify/sync/products
 * Synchroniser les produits vers Shopify (Admin)
 */
router.post('/sync/products', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await shopifySync.syncProductsToShopify();
    res.json({ 
      success: true,
      message: `${result.synced} produits synchronisés`,
      ...result
    });
  } catch (error) {
    console.error('Erreur synchronisation produits:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shopify/sync/orders
 * Synchroniser les commandes depuis Shopify (Admin)
 */
router.post('/sync/orders', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await shopifySync.syncOrdersFromShopify();
    res.json({ 
      success: true,
      message: `${result.synced} commandes synchronisées`,
      ...result
    });
  } catch (error) {
    console.error('Erreur synchronisation commandes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ============================================
 * ROUTES ADMIN - ANALYTICS
 * ============================================
 */

/**
 * GET /api/shopify/analytics/sales
 * Récupérer les métriques de ventes (Admin)
 */
router.get('/analytics/sales', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const metrics = await shopifySync.getSalesMetrics();
    res.json({ 
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Erreur récupération métriques:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shopify/orders
 * Récupérer toutes les commandes Shopify (Admin)
 */
router.get('/orders', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, shopify_order_id, customer_email, total_price, currency, status, created_at
      FROM shopify_orders
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({ 
      success: true,
      total: result.rows.length,
      orders: result.rows
    });
  } catch (error) {
    console.error('Erreur récupération commandes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shopify/orders/:orderId
 * Récupérer les détails d'une commande (Admin)
 */
router.get('/orders/:orderId', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await pool.query(
      'SELECT * FROM shopify_orders WHERE id = $1',
      [orderId]
    );

    const items = await pool.query(
      'SELECT * FROM shopify_order_items WHERE shopify_order_id = $1',
      [order.rows[0].shopify_order_id]
    );

    const shipment = await pool.query(
      'SELECT * FROM shopify_shipments WHERE shopify_order_id = $1',
      [order.rows[0].shopify_order_id]
    );

    res.json({ 
      success: true,
      order: order.rows[0],
      items: items.rows,
      shipment: shipment.rows[0] || null
    });
  } catch (error) {
    console.error('Erreur récupération détails commande:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shopify/customers
 * Récupérer les clients Shopify (Admin)
 */
router.get('/customers', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const customers = await shopifyClient.getCustomers(100);
    res.json({ 
      success: true,
      total: customers.length,
      customers
    });
  } catch (error) {
    console.error('Erreur récupération clients:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
