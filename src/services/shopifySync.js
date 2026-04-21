import pool from '../config/database.js';
import shopifyClient from './shopifyClient.js';

/**
 * Service de synchronisation entre votre base de données et Shopify
 */
class ShopifySync {
  /**
   * Construire les données de produit au format Shopify complet
   */
  async buildShopifyProduct(dbProduct) {
    try {
      // Récupérer les images
      const imagesResult = await pool.query(
        'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY "order" ASC',
        [dbProduct.id]
      );

      // Récupérer les tailles
      const sizesResult = await pool.query(
        'SELECT id, size, stock FROM product_sizes WHERE product_id = $1',
        [dbProduct.id]
      );

      // Récupérer les couleurs — snake_case pour correspondre à la migration 050
      const colorsResult = await pool.query(
        'SELECT id, color_name, color_hex, stock FROM product_colors WHERE product_id = $1',
        [dbProduct.id]
      );

      const images = imagesResult.rows;
      const sizes = sizesResult.rows;
      const colors = colorsResult.rows;

      // Construire les variants avec tailles et couleurs
      const variants = [];
      if (sizes.length > 0 && colors.length > 0) {
        for (const color of colors) {
          for (const size of sizes) {
            variants.push({
              title: `${size.size} / ${color.color_name}`,
              price: dbProduct.price.toString(),
              sku: `SINOA-${dbProduct.id}-${size.id}-${color.id}`,
              inventory_quantity: size.stock + color.stock,
              option1: size.size,
              option2: color.color_name,
              requires_shipping: true,
            });
          }
        }
      } else if (sizes.length > 0) {
        for (const size of sizes) {
          variants.push({
            title: size.size,
            price: dbProduct.price.toString(),
            sku: `SINOA-${dbProduct.id}-${size.id}`,
            inventory_quantity: size.stock,
            option1: size.size,
            requires_shipping: true,
          });
        }
      } else if (colors.length > 0) {
        for (const color of colors) {
          variants.push({
            title: color.color_name,
            price: dbProduct.price.toString(),
            sku: `SINOA-${dbProduct.id}-${color.id}`,
            inventory_quantity: color.stock,
            option1: color.color_name,
            requires_shipping: true,
          });
        }
      } else {
        variants.push({
          price: dbProduct.price.toString(),
          sku: `SINOA-${dbProduct.id}`,
          inventory_quantity: dbProduct.stock || 0,
          requires_shipping: true,
        });
      }

      // Construire les images au format Shopify
      const shopifyImages = images.map((img, index) => ({
        src: img.image_url,
        alt: `${dbProduct.name} - Image ${index + 1}`,
      }));

      // Construire les options produit — color_name corrigé ici aussi
      const options = [];
      if (sizes.length > 0 && colors.length > 0) {
        options.push({ name: 'Taille', values: sizes.map(s => s.size) });
        options.push({ name: 'Couleur', values: colors.map(c => c.color_name) });
      } else if (sizes.length > 0) {
        options.push({ name: 'Taille', values: sizes.map(s => s.size) });
      } else if (colors.length > 0) {
        options.push({ name: 'Couleur', values: colors.map(c => c.color_name) });
      }

      // Construire le produit Shopify
      const productData = {
        title: dbProduct.name,
        body_html: dbProduct.description || '',
        vendor: 'Sinoa KPOP',
        product_type: 'K-POP Merchandise',
        variants,
        images: shopifyImages,
        options,
        published: true,
        tags: ['kpop', 'merchandise'],
      };

      if (dbProduct.category_name) {
        productData.tags.push(dbProduct.category_name);
      }

      return productData;
    } catch (error) {
      console.error(`❌ Erreur construction produit ${dbProduct.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Synchroniser TOUS les produits vers Shopify
   */
  async syncProductsToShopify(limit = null) {
    try {
      console.log('🔄 Synchronisation de TOUS les produits vers Shopify...');

      let query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.created_at DESC
      `;

      if (limit) {
        query += ` LIMIT ${parseInt(limit)}`;
      }

      const result = await pool.query(query);
      const products = result.rows;

      console.log(`📦 ${products.length} produits à synchroniser`);

      let synced = 0;
      let failed = 0;
      const errors = [];

      for (const product of products) {
        try {
          const productData = await this.buildShopifyProduct(product);
          const existingShopifyId = await this.getShopifyProductId(product.id);

          if (existingShopifyId) {
            console.log(`🔄 Mise à jour produit Shopify: ${existingShopifyId}`);
            await shopifyClient.updateProduct(existingShopifyId, productData);
          } else {
            console.log(`✨ Création produit Shopify: ${product.name}`);
            const shopifyProduct = await shopifyClient.createProduct(productData);

            await pool.query(
              `INSERT INTO shopify_products (product_id, shopify_id, synced_at) 
               VALUES ($1, $2, NOW())
               ON CONFLICT (product_id) DO UPDATE SET shopify_id = $2, synced_at = NOW()`,
              [product.id, shopifyProduct.id]
            );

            console.log(`✅ Produit créé: ${shopifyProduct.id}`);
          }

          synced++;
        } catch (error) {
          console.error(`❌ Erreur synchronisation produit ${product.id}:`, error.message);
          errors.push({
            productId: product.id,
            productName: product.name,
            error: error.message,
          });
          failed++;
        }
      }

      const summary = `✅ Synchronisation terminée: ${synced} réussi(s), ${failed} échoué(s)`;
      console.log(summary);

      return {
        success: true,
        synced,
        failed,
        total: products.length,
        errors: errors.length > 0 ? errors : [],
        message: summary,
      };
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation des produits:', error.message);
      throw error;
    }
  }

  /**
   * Synchroniser un produit unique vers Shopify
   */
  async syncProductById(productId) {
    try {
      console.log(`🔄 Synchronisation produit ${productId}`);

      const result = await pool.query(
        `SELECT p.*, c.name as category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE p.id = $1`,
        [productId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Produit ${productId} non trouvé`);
      }

      const product = result.rows[0];
      const productData = await this.buildShopifyProduct(product);
      const existingShopifyId = await this.getShopifyProductId(productId);

      if (existingShopifyId) {
        await shopifyClient.updateProduct(existingShopifyId, productData);
        console.log(`✅ Produit Shopify mis à jour: ${existingShopifyId}`);
      } else {
        const shopifyProduct = await shopifyClient.createProduct(productData);
        await pool.query(
          `INSERT INTO shopify_products (product_id, shopify_id, synced_at) 
           VALUES ($1, $2, NOW())
           ON CONFLICT (product_id) DO UPDATE SET shopify_id = $2, synced_at = NOW()`,
          [productId, shopifyProduct.id]
        );
        console.log(`✅ Produit Shopify créé: ${shopifyProduct.id}`);
      }

      return { success: true, productId, message: 'Produit synchronisé' };
    } catch (error) {
      console.error(`❌ Erreur synchronisation produit ${productId}:`, error.message);
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
          const existing = await pool.query(
            'SELECT id FROM shopify_orders WHERE shopify_order_id = $1',
            [order.id]
          );

          if (existing.rows.length === 0) {
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