import crypto from 'crypto';
import pool from '../config/database.js';

/**
 * Service pour gérer les webhooks Shopify
 */
class ShopifyWebhooks {
  /**
   * Vérifier la signature du webhook
   */
  verifyWebhookSignature(req) {
    try {
      const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
      const body = req.rawBody; // Body brut avant JSON parse
      const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

      if (!hmacHeader || !body || !secret) {
        console.warn('⚠️ Webhook signature verification: données manquantes');
        return false;
      }

      const hash = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');

      return hash === hmacHeader;
    } catch (error) {
      console.error('Erreur vérification signature webhook:', error.message);
      return false;
    }
  }

  /**
   * Traiter un webhook de nouvelle commande
   */
  async handleOrderCreated(order) {
    try {
      console.log(`📦 Nouvelle commande: ${order.id}`);

      await pool.query(
        `INSERT INTO shopify_orders 
        (shopify_order_id, customer_email, total_price, currency, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (shopify_order_id) DO UPDATE SET
          status = $5,
          updated_at = NOW()`,
        [
          order.id,
          order.customer?.email || 'unknown@example.com',
          order.total_price,
          order.currency,
          order.financial_status,
          new Date(order.created_at),
        ]
      );

      // Stocker les items de la commande
      for (const item of order.line_items) {
        await pool.query(
          `INSERT INTO shopify_order_items 
          (shopify_order_id, product_title, quantity, price)
          VALUES ($1, $2, $3, $4)`,
          [order.id, item.title, item.quantity, item.price]
        );
      }

      return { success: true, orderId: order.id };
    } catch (error) {
      console.error('Erreur traitement commande:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de mise à jour de commande
   */
  async handleOrderUpdated(order) {
    try {
      console.log(`🔄 Mise à jour commande: ${order.id}`);

      await pool.query(
        `UPDATE shopify_orders 
        SET status = $1, updated_at = NOW()
        WHERE shopify_order_id = $2`,
        [order.financial_status, order.id]
      );

      return { success: true, orderId: order.id };
    } catch (error) {
      console.error('Erreur mise à jour commande:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de paiement confirmé
   */
  async handleOrderPaid(order) {
    try {
      console.log(`�� Paiement confirmé: ${order.id}`);

      await pool.query(
        `UPDATE shopify_orders 
        SET status = 'paid', updated_at = NOW()
        WHERE shopify_order_id = $1`,
        [order.id]
      );

      return { success: true, orderId: order.id };
    } catch (error) {
      console.error('Erreur traitement paiement:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook d'expédition
   */
  async handleFulfillmentCreated(fulfillment) {
    try {
      console.log(`📮 Expédition créée: ${fulfillment.id}`);

      await pool.query(
        `INSERT INTO shopify_shipments 
        (shopify_order_id, tracking_number, status)
        VALUES ($1, $2, $3)
        ON CONFLICT (shopify_order_id) DO UPDATE SET
          tracking_number = $2,
          status = $3,
          updated_at = NOW()`,
        [fulfillment.order_id, fulfillment.tracking_info?.number || null, fulfillment.status]
      );

      return { success: true, fulfillmentId: fulfillment.id };
    } catch (error) {
      console.error('Erreur traitement expédition:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de refund
   */
  async handleRefundCreated(refund) {
    try {
      console.log(`↩️ Remboursement: ${refund.id}`);

      await pool.query(
        `INSERT INTO shopify_refunds 
        (shopify_order_id, amount, reason)
        VALUES ($1, $2, $3)`,
        [refund.order_id, refund.transactions[0]?.amount, refund.note]
      );

      return { success: true, refundId: refund.id };
    } catch (error) {
      console.error('Erreur traitement refund:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de création de produit
   */
  async handleProductCreated(product) {
    try {
      console.log(`✨ Nouveau produit Shopify: ${product.id}`);

      await pool.query(
        `INSERT INTO shopify_products (shopify_id, title, synced_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (shopify_id) DO UPDATE SET
          title = $2,
          synced_at = NOW()`,
        [product.id, product.title]
      );

      return { success: true, productId: product.id };
    } catch (error) {
      console.error('Erreur traitement création produit:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de mise à jour de produit
   */
  async handleProductUpdated(product) {
    try {
      console.log(`🔄 Produit Shopify mis à jour: ${product.id}`);

      await pool.query(
        `UPDATE shopify_products 
         SET title = $1, synced_at = NOW()
         WHERE shopify_id = $2`,
        [product.title, product.id]
      );

      return { success: true, productId: product.id };
    } catch (error) {
      console.error('Erreur traitement mise à jour produit:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de suppression de produit
   */
  async handleProductDeleted(product) {
    try {
      console.log(`🗑️ Produit Shopify supprimé: ${product.id}`);

      await pool.query(
        `DELETE FROM shopify_products 
         WHERE shopify_id = $1`,
        [product.id]
      );

      return { success: true, productId: product.id };
    } catch (error) {
      console.error('Erreur traitement suppression produit:', error.message);
      throw error;
    }
  }

  /**
   * Traiter un webhook de mise à jour d'inventaire
   */
  async handleInventoryUpdate(inventory) {
    try {
      console.log(`📦 Mise à jour inventaire: ${inventory.inventory_item_id}`);

      return { success: true, inventoryId: inventory.inventory_item_id };
    } catch (error) {
      console.error('Erreur traitement mise à jour inventaire:', error.message);
      throw error;
    }
  }
}

export default new ShopifyWebhooks();
