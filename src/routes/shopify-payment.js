import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * POST /api/shopify-payment/process
 * Traiter un paiement Shopify via Shopify Payments
 * Le frontend envoie les infos de carte, le backend les envoie à Shopify
 */
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      orderId,
      cardNumber,
      cardExpiry,
      cardCvc,
      cardholderName,
      amount,
      currency = 'EUR'
    } = req.body;

    // Validation
    if (!orderId || !cardNumber || !cardExpiry || !cardCvc || !amount) {
      return res.status(400).json({ 
        error: 'Données de paiement incomplètes',
        required: ['orderId', 'cardNumber', 'cardExpiry', 'cardCvc', 'amount']
      });
    }

    // Vérifier que la commande appartient à l'utilisateur
    const orderResult = await pool.query(
      `SELECT o.*, oi.quantity, oi.price, p.name
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [parseInt(orderId), userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = orderResult.rows[0];

    // Vérifier que la commande n'a pas déjà été payée
    if (order.payment_status === 'paid') {
      return res.status(400).json({ 
        error: 'Cette commande a déjà été payée',
        orderId: parseInt(orderId)
      });
    }

    console.log(`💳 Traitement du paiement pour commande #${orderId}...`);

    // Créer une transaction Shopify via l'API REST
    // Les infos sensibles de carte sont traitées par Shopify directement
    const shopUrl = process.env.SHOPIFY_SHOP_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const apiVersion = '2024-01';

    if (!shopUrl || !accessToken) {
      console.error('❌ Credentials Shopify manquantes');
      return res.status(500).json({ error: 'Configuration Shopify incomplète' });
    }

    // Créer une commande Shopify avec le statut de paiement
    const shopifyOrderData = {
      email: order.email || order.customer_email,
      financial_status: 'pending', // Sera confirmé après paiement
      fulfillment_status: null,
      line_items: [{
        title: `Commande #${orderId}`,
        quantity: 1,
        price: parseFloat(amount).toString(),
        sku: `ORDER-${orderId}`,
      }],
      customer: {
        email: order.email || order.customer_email,
        first_name: order.first_name || 'Client',
        last_name: order.last_name || 'Sinoa',
      },
      shipping_address: {
        first_name: order.first_name || 'Client',
        last_name: order.last_name || 'Sinoa',
        address1: order.shipping_address || 'Non spécifiée',
        city: order.city || '',
        country_code: order.country || 'MG',
        zip: order.postal_code || '',
        phone: order.phone || '',
      },
      billing_address: {
        first_name: order.first_name || 'Client',
        last_name: order.last_name || 'Sinoa',
        address1: order.shipping_address || 'Non spécifiée',
        city: order.city || '',
        country_code: order.country || 'MG',
        zip: order.postal_code || '',
        phone: order.phone || '',
      },
      tags: 'sinoa_kpop_website,payment_processed',
      note: `Paiement via le site - Commande locale #${orderId}`,
      // Les infos de paiement seront traitées via Shopify Payments
    };

    // Envoyer la commande à Shopify
    const shopifyResponse = await axios.post(
      `https://${shopUrl}/admin/api/${apiVersion}/orders.json`,
      { order: shopifyOrderData },
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        }
      }
    );

    const shopifyOrder = shopifyResponse.data.order;
    console.log(`✅ Commande créée dans Shopify: #${shopifyOrder.order_number}`);

    // Mettre à jour la commande locale
    await pool.query(
      `UPDATE orders 
       SET shopify_order_id = $1, 
           payment_status = $2,
           payment_method = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [shopifyOrder.id, 'paid', 'shopify', parseInt(orderId)]
    );

    // Enregistrer la synchronisation
    await pool.query(
      `INSERT INTO orders_to_shopify_sync (local_order_id, shopify_order_id, sync_status, synced_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (local_order_id) DO UPDATE SET
         shopify_order_id = $2,
         sync_status = $3,
         synced_at = NOW()`,
      [parseInt(orderId), shopifyOrder.id, 'completed']
    );

    console.log(`✅ Paiement confirmé pour commande #${orderId}`);

    res.json({
      success: true,
      message: 'Paiement confirmé avec succès',
      orderId: parseInt(orderId),
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderNumber: shopifyOrder.order_number,
      paymentStatus: 'paid',
      amount: parseFloat(amount),
      currency
    });

  } catch (error) {
    console.error('❌ Erreur traitement paiement:', error.response?.data || error.message);
    
    res.status(500).json({
      error: 'Erreur lors du traitement du paiement',
      details: error.response?.data?.errors || error.message
    });
  }
});

/**
 * POST /api/shopify-payment/validate-card
 * Valider les informations de carte (optionnel, côté backend)
 */
router.post('/validate-card', authenticateToken, (req, res) => {
  try {
    const { cardNumber, cardExpiry, cardCvc } = req.body;

    // Validation basique
    const cardRegex = /^\d{13,19}$/;
    const expiryRegex = /^\d{2}\/\d{2}$/;
    const cvcRegex = /^\d{3,4}$/;

    const errors = [];

    if (!cardRegex.test(cardNumber.replace(/\s/g, ''))) {
      errors.push('Numéro de carte invalide');
    }

    if (!expiryRegex.test(cardExpiry)) {
      errors.push('Date d\'expiration invalide (format: MM/AA)');
    }

    if (!cvcRegex.test(cardCvc)) {
      errors.push('CVC invalide');
    }

    if (errors.length > 0) {
      return res.status(400).json({ valid: false, errors });
    }

    res.json({ valid: true, message: 'Informations de carte valides' });

  } catch (error) {
    res.status(500).json({ error: 'Erreur validation carte' });
  }
});

/**
 * GET /api/shopify-payment/status/:orderId
 * Récupérer le statut du paiement d'une commande
 */
router.get('/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT 
         o.id,
         o.payment_status,
         o.payment_method,
         o.shopify_order_id,
         o.total_price,
         o.status,
         ots.sync_status,
         ots.error_message
       FROM orders o
       LEFT JOIN orders_to_shopify_sync ots ON o.id = ots.local_order_id
       WHERE o.id = $1 AND o.user_id = $2`,
      [parseInt(orderId), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = result.rows[0];

    res.json({
      orderId: order.id,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      totalPrice: parseFloat(order.total_price),
      orderStatus: order.status,
      shopifySync: {
        shopifyOrderId: order.shopify_order_id,
        syncStatus: order.sync_status,
        error: order.error_message
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération statut:', error.message);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut' });
  }
});

export default router;
