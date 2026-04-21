import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import shopifyOrdersService from '../services/shopifyOrders.js';

const router = express.Router();

/**
 * POST /api/payment/shopify/process
 * Traiter le paiement via Shopify Payments
 * Frontend envoie: infos panier + infos client + infos carte
 * Backend: crée checkout Shopify et redirige le client
 */
router.post('/shopify/process', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      orderId,
      items,
      cardNumber,
      cardExpiry,
      cardCvc,
      cardName,
      firstName,
      lastName,
      email,
      phone,
      shippingAddress,
      city,
      postalCode,
      country,
      latitude,
      longitude,
    } = req.body;

    // Validation basique
    if (!orderId || !items?.length) {
      return res.status(400).json({ error: 'Données de commande invalides' });
    }

    if (!cardNumber || !cardExpiry || !cardCvc) {
      return res.status(400).json({ error: 'Données de carte incomplètes' });
    }

    // Vérifier que la commande appartient à l'utilisateur
    const orderCheck = await pool.query(
      'SELECT id, user_id, total_price FROM orders WHERE id = $1',
      [parseInt(orderId)]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    if (orderCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const totalPrice = orderCheck.rows[0].total_price;

    // ========== ÉTAPE 1: Créer un checkout Shopify avec les infos de paiement ==========
    const shopUrl = process.env.SHOPIFY_SHOP_URL;
    const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
    const apiVersion = '2024-04';

    if (!shopUrl || !storefrontToken) {
      console.error('❌ Tokens Shopify manquants');
      return res.status(500).json({ error: 'Configuration Shopify incomplète' });
    }

    // Transformer les articles pour Shopify
    const cartLines = items.map(item => ({
      quantity: item.quantity,
      merchandiseId: `gid://shopify/ProductVariant/${item.product_id || item.id}`,
    }));

    // Créer le panier Shopify avec les informations client
    const createCartQuery = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            buyerIdentity {
              customer {
                id
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    console.log('📦 Création du panier Shopify...');
    const cartResponse = await axios.post(
      `https://${shopUrl}/api/${apiVersion}/graphql.json`,
      {
        query: createCartQuery,
        variables: {
          input: {
            lines: cartLines,
            buyerIdentity: {
              email: email || 'client@sinoa-kpop.com',
              phone: phone,
              address: {
                address1: shippingAddress,
                city: city,
                provinceCode: '',
                countryCode: country === 'Madagascar' ? 'MG' : country,
                zip: postalCode,
              },
            },
          }
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': storefrontToken,
        }
      }
    );

    if (cartResponse.data.errors) {
      console.error('❌ Erreur GraphQL Shopify:', cartResponse.data.errors);
      return res.status(500).json({
        error: 'Erreur lors de la création du panier',
        details: cartResponse.data.errors[0]?.message
      });
    }

    const { userErrors, cart } = cartResponse.data.data.cartCreate;

    if (userErrors?.length > 0) {
      console.error('❌ Erreurs Shopify:', userErrors);
      return res.status(400).json({
        error: 'Erreur lors de la création du panier',
        details: userErrors[0]?.message
      });
    }

    if (!cart?.checkoutUrl) {
      return res.status(500).json({ error: 'URL de checkout non reçue' });
    }

    console.log('✅ Panier créé. Checkout URL:', cart.checkoutUrl);

    // ========== ÉTAPE 2: Enregistrer l'info de paiement en attente ==========
    await pool.query(
      `UPDATE orders 
       SET shopify_checkout_id = $1, 
           payment_method = 'shopify_payments',
           payment_status = 'processing',
           updated_at = NOW()
       WHERE id = $2`,
      [cart.id, parseInt(orderId)]
    );

    // Enregistrer les détails de paiement (chiffré en production)
    await pool.query(
      `INSERT INTO payment_sessions (order_id, payment_method, amount, currency, status, created_at)
       VALUES ($1, 'shopify_payments', $2, 'EUR', 'pending', NOW())`,
      [parseInt(orderId), totalPrice]
    );

    // ========== ÉTAPE 3: Retourner l'URL de checkout ==========
    // Le frontend redirigera l'utilisateur vers cette URL
    // Shopify gérera ensuite tout le paiement
    res.json({
      success: true,
      checkoutUrl: cart.checkoutUrl,
      checkoutId: cart.id,
      orderId: parseInt(orderId),
      message: 'Redirection vers Shopify Checkout pour finaliser le paiement'
    });

  } catch (error) {
    console.error('❌ Erreur traitement paiement:', error.message);
    res.status(500).json({
      error: 'Erreur lors du traitement du paiement',
      details: error.message
    });
  }
});

/**
 * POST /api/payment/shopify/confirm
 * Webhook: Confirmer que le paiement a été fait (appelé après redirection Shopify)
 */
router.post('/shopify/confirm', authenticateToken, async (req, res) => {
  try {
    const { orderId, checkoutId, shopifyOrderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId requis' });
    }

    // Mettre à jour le statut de la commande
    const result = await pool.query(
      `UPDATE orders 
       SET payment_status = 'paid',
           status = 'processing',
           shopify_order_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [shopifyOrderId || null, parseInt(orderId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = result.rows[0];

    // ========== ÉTAPE 4: Synchroniser la commande avec Shopify ==========
    // Créer la commande dans Shopify si elle n'existe pas
    if (!order.shopify_order_id) {
      try {
        const syncResult = await shopifyOrdersService.sendOrderToShopify(order);
        console.log(`✅ Commande #${orderId} synchronisée avec Shopify`);
      } catch (syncError) {
        console.warn(`⚠️ Erreur sync Shopify (non bloquant): ${syncError.message}`);
        // Continuer même si la sync échoue
      }
    }

    res.json({
      success: true,
      message: 'Paiement confirmé et commande créée',
      order: order
    });

  } catch (error) {
    console.error('❌ Erreur confirmation paiement:', error.message);
    res.status(500).json({
      error: 'Erreur lors de la confirmation du paiement',
      details: error.message
    });
  }
});

export default router;
