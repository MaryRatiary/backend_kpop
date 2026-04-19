import axios from 'axios';
import pool from '../config/database.js';
import shopifyClient from './shopifyClient.js';

class ShopifyOrdersService {
  constructor() {
    this.shopUrl = process.env.SHOPIFY_SHOP_URL;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = '2024-01';
  }

  async sendOrderToShopify(orderData) {
    try {
      console.log(`📤 Envoi de la commande #${orderData.id} vers Shopify...`);

      // Vérifier si la commande existe déjà dans Shopify
      const existing = await pool.query(
        'SELECT shopify_order_id FROM orders_to_shopify_sync WHERE local_order_id = $1',
        [orderData.id]
      );

      if (existing.rows.length > 0 && existing.rows[0].shopify_order_id) {
        console.log(`⚠️  Commande #${orderData.id} déjà synchronisée avec Shopify`);
        return { alreadySynced: true, shopifyOrderId: existing.rows[0].shopify_order_id };
      }

      // Récupérer les articles de la commande
      const itemsResult = await pool.query(
        `SELECT oi.*, p.name, p.id as product_id
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [orderData.id]
      );

      const lineItems = itemsResult.rows.map(item => ({
        title: item.name,
        quantity: item.quantity,
        price: item.price.toString(),
        sku: `SINOA-${item.product_id}`,
        variant_id: item.variant_id || null,
      }));

      // Construire la commande pour Shopify
      const shopifyOrderData = {
        email: orderData.email || 'client@sinoa-kpop.com',
        financial_status: 'pending',
        fulfillment_status: null,
        line_items: lineItems,
        customer: {
          email: orderData.email,
          first_name: orderData.first_name || 'Client',
          last_name: orderData.last_name || 'Sinoa',
        },
        shipping_address: {
          first_name: orderData.first_name || 'Client',
          last_name: orderData.last_name || 'Sinoa',
          address1: orderData.shipping_address || 'Non spécifiée',
          city: orderData.city || '',
          province_code: '',
          country_code: orderData.country || 'MG',
          zip: orderData.postal_code || '',
          phone: orderData.phone || '',
        },
        billing_address: {
          first_name: orderData.first_name || 'Client',
          last_name: orderData.last_name || 'Sinoa',
          address1: orderData.shipping_address || 'Non spécifiée',
          city: orderData.city || '',
          province_code: '',
          country_code: orderData.country || 'MG',
          zip: orderData.postal_code || '',
          phone: orderData.phone || '',
        },
        tags: 'sinoa_kpop_website',
        note: orderData.notes || 'Commande depuis le site Sinoa KPOP',
      };

      // Créer la commande dans Shopify
      const response = await axios.post(
        `https://${this.shopUrl}/admin/api/${this.apiVersion}/orders.json`,
        { order: shopifyOrderData },
        {
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json',
          }
        }
      );

      const shopifyOrder = response.data.order;
      console.log(`✅ Commande créée dans Shopify avec l'ID: ${shopifyOrder.id}`);

      // Enregistrer la synchronisation
      await this.trackSyncedOrder(orderData.id, shopifyOrder.id);

      return {
        success: true,
        shopifyOrderId: shopifyOrder.id,
        shopifyOrderNumber: shopifyOrder.order_number,
      };
    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi de la commande #${orderData.id} vers Shopify:`, error.response?.data || error.message);
      
      // Enregistrer l'erreur
      await this.trackSyncError(orderData.id, error.message);
      
      throw new Error(`Impossible d'envoyer la commande à Shopify: ${error.message}`);
    }
  }

  async trackSyncedOrder(localOrderId, shopifyOrderId) {
    try {
      await pool.query(
        `INSERT INTO orders_to_shopify_sync (local_order_id, shopify_order_id, sync_status, synced_at)
         VALUES ($1, $2, 'completed', NOW())
         ON CONFLICT (local_order_id) DO UPDATE SET
           shopify_order_id = $2,
           sync_status = 'completed',
           synced_at = NOW()`,
        [localOrderId, shopifyOrderId]
      );
      console.log(`📍 Synchronisation enregistrée: commande locale #${localOrderId} → Shopify #${shopifyOrderId}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de la synchronisation:', error.message);
    }
  }

  async trackSyncError(localOrderId, errorMessage) {
    try {
      // Vérifier si l'entrée existe déjà
      const existing = await pool.query(
        'SELECT id FROM orders_to_shopify_sync WHERE local_order_id = $1',
        [localOrderId]
      );

      if (existing.rows.length > 0) {
        // Mettre à jour l'erreur si l'entrée existe
        await pool.query(
          `UPDATE orders_to_shopify_sync 
           SET sync_status = 'failed', error_message = $1, updated_at = NOW()
           WHERE local_order_id = $2`,
          [errorMessage, localOrderId]
        );
      } else {
        // Créer une nouvelle entrée si elle n'existe pas
        await pool.query(
          `INSERT INTO orders_to_shopify_sync (local_order_id, sync_status, error_message)
           VALUES ($1, 'failed', $2)`,
          [localOrderId, errorMessage]
        );
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de l\'erreur:', error.message);
    }
  }

  async getSyncStatus(localOrderId) {
    try {
      const result = await pool.query(
        `SELECT * FROM orders_to_shopify_sync WHERE local_order_id = $1`,
        [localOrderId]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du statut:', error.message);
      return null;
    }
  }

  async retrySyncedOrders() {
    try {
      console.log('🔄 Tentative de resynchronisation des commandes échouées...');

      const failedOrders = await pool.query(
        `SELECT o.* FROM orders o
         JOIN orders_to_shopify_sync ots ON o.id = ots.local_order_id
         WHERE ots.sync_status = 'failed'
         ORDER BY o.created_at ASC
         LIMIT 10`
      );

      let retried = 0;
      let success = 0;

      for (const order of failedOrders.rows) {
        try {
          await this.sendOrderToShopify(order);
          success++;
        } catch (error) {
          console.error(`⚠️  Échec de la resynchronisation de la commande #${order.id}`);
        }
        retried++;
      }

      console.log(`✅ Resynchronisation terminée: ${success}/${retried} réussie(s)`);
      return { retried, success };
    } catch (error) {
      console.error('❌ Erreur lors de la resynchronisation:', error.message);
      throw error;
    }
  }

  async getSyncStats() {
    try {
      const result = await pool.query(
        `SELECT 
          sync_status,
          COUNT(*) as count
         FROM orders_to_shopify_sync
         GROUP BY sync_status`
      );

      return result.rows.reduce((acc, row) => {
        acc[row.sync_status] = row.count;
        return acc;
      }, {});
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error.message);
      return {};
    }
  }
}

export default new ShopifyOrdersService();
