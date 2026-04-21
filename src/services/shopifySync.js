import pool from '../config/database.js';
import shopifyClient from './shopifyClient.js';

class ShopifySync {

  // ============================================================
  // UPSERT SHOPIFY PRODUCT (sans doublon)
  // ============================================================
  async upsertShopifyProduct(productId, shopifyId) {
    const existing = await pool.query(
      'SELECT id FROM shopify_products WHERE product_id = $1',
      [productId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE shopify_products SET shopify_id = $1, synced_at = NOW() WHERE product_id = $2',
        [shopifyId, productId]
      );
    } else {
      await pool.query(
        'INSERT INTO shopify_products (product_id, shopify_id, synced_at) VALUES ($1, $2, NOW())',
        [productId, shopifyId]
      );
    }
  }

  // ============================================================
  // CONSTRUIRE LE PAYLOAD SHOPIFY (avec catégorie complète)
  // ============================================================
  async buildShopifyProduct(dbProduct) {
    try {
      const imagesResult = await pool.query(
        'SELECT image_url FROM product_images WHERE product_id = $1 ORDER BY "order" ASC',
        [dbProduct.id]
      );
      const sizesResult = await pool.query(
        'SELECT id, size, stock FROM product_sizes WHERE product_id = $1',
        [dbProduct.id]
      );
      const colorsResult = await pool.query(
        'SELECT id, color_name, color_hex, stock FROM product_colors WHERE product_id = $1',
        [dbProduct.id]
      );

      // Récupérer la hiérarchie complète des catégories
      const categoryChain = await this.getCategoryChain(dbProduct.category_id);

      const images = imagesResult.rows;
      const sizes = sizesResult.rows;
      const colors = colorsResult.rows;

      // Variants
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

      // Images
      const shopifyImages = images.map((img, index) => ({
        src: img.image_url,
        alt: `${dbProduct.name} - Image ${index + 1}`,
      }));

      // Options
      const options = [];
      if (sizes.length > 0 && colors.length > 0) {
        options.push({ name: 'Taille', values: sizes.map(s => s.size) });
        options.push({ name: 'Couleur', values: colors.map(c => c.color_name) });
      } else if (sizes.length > 0) {
        options.push({ name: 'Taille', values: sizes.map(s => s.size) });
      } else if (colors.length > 0) {
        options.push({ name: 'Couleur', values: colors.map(c => c.color_name) });
      }

      // Tags : kpop + merchandise + toute la chaîne de catégories
      const tags = ['kpop', 'merchandise'];
      for (const cat of categoryChain) {
        if (cat && cat.trim() !== '') tags.push(cat.trim());
      }

      // product_type = catégorie racine si disponible
      const productType = categoryChain.length > 0
        ? categoryChain[0]
        : 'K-POP Merchandise';

      const productData = {
        title: dbProduct.name,
        body_html: dbProduct.description || '',
        vendor: 'Sinoa KPOP',
        product_type: productType,
        variants,
        images: shopifyImages,
        options,
        published: true,
        tags: [...new Set(tags)], // pas de doublons dans les tags
      };

      return productData;
    } catch (error) {
      console.error(`❌ Erreur construction produit ${dbProduct.id}:`, error.message);
      throw error;
    }
  }

  // ============================================================
  // RÉCUPÉRER LA CHAÎNE DE CATÉGORIES (ex: ["Vêtements", "Sweats"])
  // ============================================================
  async getCategoryChain(categoryId) {
    if (!categoryId) return [];

    try {
      // Remonte la hiérarchie via parent_id récursif
      const result = await pool.query(`
        WITH RECURSIVE cat_chain AS (
          SELECT id, name, parent_id, 0 AS depth
          FROM categories
          WHERE id = $1
          UNION ALL
          SELECT c.id, c.name, c.parent_id, cc.depth + 1
          FROM categories c
          INNER JOIN cat_chain cc ON c.id = cc.parent_id
        )
        SELECT name FROM cat_chain ORDER BY depth DESC
      `, [categoryId]);

      return result.rows.map(r => r.name);
    } catch (err) {
      console.error('Erreur getCategoryChain:', err.message);
      return [];
    }
  }

  // ============================================================
  // SYNC TOUS LES PRODUITS → SHOPIFY (sans doublons)
  // ============================================================
  async syncProductsToShopify(limit = null) {
    try {
      console.log('🔄 Synchronisation de TOUS les produits vers Shopify...');

      let query = `
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.created_at DESC
      `;
      if (limit) query += ` LIMIT ${parseInt(limit)}`;

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
            // Vérifier que le produit existe encore sur Shopify
            try {
              await shopifyClient.updateProduct(existingShopifyId, productData);
              console.log(`🔄 Mis à jour: ${product.name} (Shopify ID: ${existingShopifyId})`);
            } catch (err) {
              if (err.response?.status === 404 || err.message?.includes('404')) {
                // Produit supprimé sur Shopify → supprimer le lien et recréer
                console.log(`⚠️  Produit ${existingShopifyId} introuvable sur Shopify, recréation...`);
                await pool.query('DELETE FROM shopify_products WHERE product_id = $1', [product.id]);
                const shopifyProduct = await shopifyClient.createProduct(productData);
                await this.upsertShopifyProduct(product.id, shopifyProduct.id);
                console.log(`✅ Recréé: ${product.name} (Shopify ID: ${shopifyProduct.id})`);
              } else {
                throw err;
              }
            }
          } else {
            console.log(`✨ Création: ${product.name}`);
            const shopifyProduct = await shopifyClient.createProduct(productData);
            await this.upsertShopifyProduct(product.id, shopifyProduct.id);
            console.log(`✅ Créé: ${product.name} (Shopify ID: ${shopifyProduct.id})`);
          }

          synced++;

          // Petite pause pour ne pas dépasser le rate limit Shopify (2 req/sec)
          await new Promise(r => setTimeout(r, 500));
        } catch (error) {
          console.error(`❌ Erreur sync produit ${product.id} (${product.name}):`, error.message);
          errors.push({ productId: product.id, productName: product.name, error: error.message });
          failed++;
        }
      }

      const summary = `✅ Synchronisation terminée: ${synced} réussi(s), ${failed} échoué(s)`;
      console.log(summary);
      return { success: true, synced, failed, total: products.length, errors, message: summary };
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation des produits:', error.message);
      throw error;
    }
  }

  // ============================================================
  // SYNC UN PRODUIT PAR SON ID LOCAL
  // ============================================================
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

      if (result.rows.length === 0) throw new Error(`Produit ${productId} non trouvé`);

      const product = result.rows[0];
      const productData = await this.buildShopifyProduct(product);
      const existingShopifyId = await this.getShopifyProductId(productId);

      if (existingShopifyId) {
        try {
          await shopifyClient.updateProduct(existingShopifyId, productData);
          console.log(`✅ Produit Shopify mis à jour: ${existingShopifyId}`);
        } catch (err) {
          if (err.response?.status === 404 || err.message?.includes('404')) {
            // Produit supprimé sur Shopify → recréer
            await pool.query('DELETE FROM shopify_products WHERE product_id = $1', [productId]);
            const shopifyProduct = await shopifyClient.createProduct(productData);
            await this.upsertShopifyProduct(productId, shopifyProduct.id);
            console.log(`✅ Produit Shopify recréé: ${shopifyProduct.id}`);
          } else {
            throw err;
          }
        }
      } else {
        const shopifyProduct = await shopifyClient.createProduct(productData);
        await this.upsertShopifyProduct(productId, shopifyProduct.id);
        console.log(`✅ Produit Shopify créé: ${shopifyProduct.id}`);
      }

      return { success: true, productId, message: 'Produit synchronisé' };
    } catch (error) {
      console.error(`❌ Erreur synchronisation produit ${productId}:`, error.message);
      throw error;
    }
  }

  // ============================================================
  // SYNC COMMANDES DEPUIS SHOPIFY
  // ============================================================
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
          console.error(`❌ Erreur sync commande ${order.id}:`, error.message);
          failed++;
        }
      }

      console.log(`✅ Sync commandes: ${synced} réussi(s), ${failed} échoué(s)`);
      return { synced, failed };
    } catch (error) {
      console.error('Erreur synchronisation commandes:', error.message);
      throw error;
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  async getShopifyProductId(productId) {
    const result = await pool.query(
      'SELECT shopify_id FROM shopify_products WHERE product_id = $1',
      [productId]
    );
    return result.rows[0]?.shopify_id || null;
  }

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
      console.error('Erreur métriques:', error.message);
      throw error;
    }
  }
}

export default new ShopifySync();