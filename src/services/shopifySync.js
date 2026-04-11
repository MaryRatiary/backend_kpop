import pool from '../config/database.js';
import shopifyClient from './shopifyClient.js';

/**
 * Service de synchronisation entre votre base de données et Shopify
 */
class ShopifySync {
  /**
   * Synchroniser les produits depuis votre BD vers Shopify
   */
  async syncProductsToShopify() {
    try {
      console.log('🔄 Synchronisation des produits vers Shopify...');
      
      // Récupérer les produits de votre BD
      const result = await pool.query(`
        SELECT id, name, description, price, created_at 
        FROM products 
        WHERE created_at > NOW() - INTERVAL '24 hours'
        LIMIT 100
      `);

      const products = result.rows;
      let synced = 0;
      let failed = 0;

      for (const product of products) {
        try {
          // Vérifier si le produit existe déjà dans Shopify
          const existingShopifyId = await this.getShopifyProductId(product.id);

          const productData = {
            title: product.name,
            body_html: product.description || '',
            vendor: 'Sinoa KPOP',
            product_type: 'KPOP',
            variants: [
              {
                price: product.price,
                sku: `SINOA-${product.id}`,
              },
            ],
          };

          if (existingShopifyId) {
            // Mettre à jour
            await shopifyClient.updateProduct(existingShopifyId, productData);
          } else {
            // Créer
            const shopifyProduct = await shopifyClient.createProduct(productData);
            
            // Stocker le mapping
            await pool.query(
              'INSERT INTO shopify_products (product_id, shopify_id) VALUES ($1, $2)',
              [product.id, shopifyProduct.id]
            );
          }

          synced++;
        } catch (error) {
          console.error(`❌ Erreur synchronisation produit ${product.id}:`, error.message);
          failed++;
        }
      }

      console.log(`✅ Synchronisation terminée: ${synced} réussi(s), ${failed} échoué(s)`);
      return { synced, failed };
    } catch (error) {
      console.error('Erreur lors de la synchronisation des produits:', error.message);
      throw error;
    }
  }

  /**
   * Récupérer les commandes Shopify et les stocker en BD
   */
  async syncOrdersFromShopify() {
    try {
      console.log('🔄 Synchronisation des commandes depuis Shopify...');

      const shopifyOrders = await shopifyClient.getOrders(250, 'any');
      let synced = 0;
      let failed = 0;

      for (const order of shopifyOrders) {
        try {
          // Vérifier si la commande existe déjà
          const existing = await pool.query(
            'SELECT id FROM shopify_orders WHERE shopify_order_id = $1',
            [order.id]
          );

          if (existing.rows.length === 0) {
            // Insérer la nouvelle commande
            await pool.query(
              `INSERT INTO shopify_orders 
              (shopify_order_id, customer_email, total_price, currency, status, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                order.id,
                order.customer?.email || 'unknown@example.com',
                order.total_price,
                order.currency,
                order.financial_status,
                new Date(order.created_at),
              ]
            );
          }

          synced++;
        } catch (error) {
          console.error(`❌ Erreur synchronisation commande ${order.id}:`, error.message);
          failed++;
        }
      }

      console.log(`✅ Synchronisation commandes terminée: ${synced} réussi(s), ${failed} échoué(s)`);
      return { synced, failed };
    } catch (error) {
      console.error('Erreur lors de la synchronisation des commandes:', error.message);
      throw error;
    }
  }

  /**
   * Récupérer l'ID Shopify d'un produit
   */
  async getShopifyProductId(productId) {
    const result = await pool.query(
      'SELECT shopify_id FROM shopify_products WHERE product_id = $1',
      [productId]
    );
    return result.rows[0]?.shopify_id || null;
  }

  /**
   * Récupérer les métriques de ventes Shopify
   */
  async getSalesMetrics() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CAST(total_price AS NUMERIC)) as total_revenue,
          AVG(CAST(total_price AS NUMERIC)) as avg_order_value,
          status,
          DATE_TRUNC('day', created_at) as date
        FROM shopify_orders
        GROUP BY status, DATE_TRUNC('day', created_at)
        ORDER BY date DESC
        LIMIT 30
      `);

      return result.rows;
    } catch (error) {
      console.error('Erreur lors de la récupération des métriques:', error.message);
      throw error;
    }
  }
}

export default new ShopifySync();
