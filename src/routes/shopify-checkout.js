import express from 'express';
import axios from 'axios';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * POST /api/shopify-checkout
 * Créer un checkout Shopify sécurisé via le backend
 * Pas d'exposition des tokens Shopify au frontend
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, orderId } = req.body;
    const userId = req.user?.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Articles obligatoires' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'ID de commande obligatoire' });
    }

    // Vérifier que la commande appartient à l'utilisateur
    const orderCheck = await pool.query(
      'SELECT id, user_id FROM orders WHERE id = $1',
      [parseInt(orderId)]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    if (orderCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Créer un checkout Shopify avec l'API Storefront GraphQL
    const shopUrl = process.env.SHOPIFY_SHOP_URL;
    const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
    const apiVersion = '2024-04';

    if (!shopUrl || !storefrontToken) {
      console.error('❌ Tokens Shopify manquants');
      return res.status(500).json({ error: 'Configuration Shopify incomplète' });
    }

    // Construire les articles pour le checkout
    const cartLines = items.map(item => ({
      quantity: item.quantity,
      merchandiseId: `gid://shopify/ProductVariant/${item.product_id}`,
    }));

    // Créer le checkout via GraphQL
    const query = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await axios.post(
      `https://${shopUrl}/api/${apiVersion}/graphql.json`,
      {
        query,
        variables: {
          input: {
            lines: cartLines,
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

    if (response.data.errors) {
      console.error('❌ Erreur GraphQL Shopify:', response.data.errors);
      return res.status(500).json({ 
        error: 'Erreur lors de la création du checkout',
        details: response.data.errors[0]?.message 
      });
    }

    const { userErrors, cart } = response.data.data.cartCreate;

    if (userErrors && userErrors.length > 0) {
      console.error('❌ Erreurs utilisateur Shopify:', userErrors);
      return res.status(400).json({ 
        error: 'Erreur lors de la création du checkout',
        details: userErrors[0]?.message 
      });
    }

    if (!cart || !cart.checkoutUrl) {
      return res.status(500).json({ error: 'URL de checkout non reçue' });
    }

    // Enregistrer le checkout ID associé à la commande
    await pool.query(
      `UPDATE orders 
       SET shopify_checkout_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [cart.id, parseInt(orderId)]
    );

    console.log(`✅ Checkout Shopify créé pour commande #${orderId}`);

    res.json({
      success: true,
      checkoutUrl: cart.checkoutUrl,
      checkoutId: cart.id,
      orderId: parseInt(orderId)
    });

  } catch (error) {
    console.error('❌ Erreur création checkout:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors de la création du checkout',
      details: error.message 
    });
  }
});

export default router;
