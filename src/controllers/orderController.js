import pool from '../config/database.js';
import shopifyOrdersService from '../services/shopifyOrders.js';

// Créer une commande à partir du panier
export const createOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const { 
      items, 
      shippingAddress, 
      paymentMethod,
      firstName,
      lastName,
      email,
      phone,
      city,
      postalCode,
      country,
      latitude,
      longitude,
      notes
    } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Au moins un article est obligatoire' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: 'L\'adresse de livraison est obligatoire' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'La méthode de paiement est obligatoire' });
    }

    // Calculer le prix total et valider les articles
    let totalPrice = 0;
    const itemsData = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: 'Données d\'article invalides' });
      }

      const product = await client.query('SELECT * FROM products WHERE id = $1', [parseInt(item.productId)]);
      if (product.rows.length === 0) {
        return res.status(404).json({ error: `Produit ${item.productId} non trouvé` });
      }

      if (product.rows[0].stock < item.quantity) {
        return res.status(400).json({ error: `Stock insuffisant pour ${product.rows[0].name}` });
      }

      const price = parseFloat(product.rows[0].price);
      totalPrice += price * item.quantity;
      itemsData.push({ ...item, price, productId: parseInt(item.productId) });
    }

    // Créer la commande avec tous les détails
    const orderResult = await client.query(
      `INSERT INTO orders (
        user_id, 
        total_price, 
        shipping_address, 
        payment_method, 
        status, 
        payment_status,
        first_name,
        last_name,
        email,
        phone,
        city,
        postal_code,
        country,
        latitude,
        longitude,
        notes,
        created_at,
        updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, user_id, total_price, shipping_address, payment_method, status, payment_status, first_name, last_name, email, phone, city, postal_code, country, latitude, longitude, notes, created_at`,
      [
        userId, 
        totalPrice, 
        shippingAddress, 
        paymentMethod,
        'pending',
        'unpaid',
        firstName || null,
        lastName || null,
        email || null,
        phone || null,
        city || null,
        postalCode || null,
        country || null,
        latitude || null,
        longitude || null,
        notes || null
      ]
    );

    const orderId = orderResult.rows[0].id;
    const orderData = orderResult.rows[0];

    // Ajouter les articles de la commande
    for (const item of itemsData) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, size, color, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
        [orderId, item.productId, item.quantity, item.price, item.size || null, item.color || null]
      );

      // Réduire le stock du produit
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.productId]
      );
    }

    // ✅ Créer une entrée dans orders_to_shopify_sync avec le statut 'pending'
    await client.query(
      `INSERT INTO orders_to_shopify_sync (local_order_id, sync_status, created_at, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (local_order_id) DO UPDATE SET 
         sync_status = EXCLUDED.sync_status,
         updated_at = CURRENT_TIMESTAMP`,
      [orderId, 'pending']
    );

    await client.query('COMMIT');

    // 🔄 Envoyer la commande à Shopify en arrière-plan (asynchrone)
    const orderWithDetails = {
      id: orderId,
      ...orderData,
      items: itemsData
    };

    shopifyOrdersService.sendOrderToShopify(orderWithDetails)
      .then(() => {
        console.log(`✅ Commande #${orderId} synchronisée avec Shopify`);
        // Mettre à jour le statut de sync
        pool.query(
          `UPDATE orders_to_shopify_sync 
           SET sync_status = $1, synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE local_order_id = $2`,
          ['completed', orderId]
        ).catch(err => console.error(`Erreur mise à jour sync status pour commande #${orderId}:`, err));
      })
      .catch((error) => {
        console.error(`⚠️  Erreur synchronisation Shopify pour commande #${orderId}:`, error.message);
        // Enregistrer l'erreur dans la base de données
        pool.query(
          `UPDATE orders_to_shopify_sync 
           SET sync_status = $1, error_message = $2, retried_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE local_order_id = $3`,
          ['failed', error.message, orderId]
        ).catch(err => console.error(`Erreur mise à jour erreur sync pour commande #${orderId}:`, err));
      });

    res.status(201).json({
      message: 'Commande créée avec succès',
      order: {
        id: orderData.id,
        user_id: orderData.user_id,
        total_price: orderData.total_price,
        status: orderData.status,
        payment_status: orderData.payment_status,
        created_at: orderData.created_at
      },
      items: itemsData,
      shopifySync: {
        status: 'pending',
        message: 'La commande sera synchronisée avec Shopify...'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande: ' + err.message });
  } finally {
    client.release();
  }
};

// Obtenir les commandes de l'utilisateur
export const getUserOrders = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    if (isNaN(limit) || isNaN(offset) || limit < 1) {
      return res.status(400).json({ error: 'Paramètres de pagination invalides' });
    }

    const orders = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, Math.min(parseInt(limit), 100), parseInt(offset)]
    );

    res.json(orders.rows);
  } catch (err) {
    console.error('Get user orders error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
};

// Obtenir les détails complets d'une commande (utilisateur)
export const getOrderById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [parseInt(orderId), userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const items = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.price, pi.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_main_image = true
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [parseInt(orderId)]
    );

    // Récupérer le statut de synchronisation Shopify
    const syncStatus = await pool.query(
      `SELECT id, local_order_id, shopify_order_id, sync_status, error_message, synced_at, retried_at
       FROM orders_to_shopify_sync 
       WHERE local_order_id = $1`,
      [parseInt(orderId)]
    );

    res.json({
      ...order.rows[0],
      items: items.rows,
      shopifySync: syncStatus.rows[0] || { 
        sync_status: 'pending',
        error_message: null 
      }
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// Obtenir les détails complets d'une commande (ADMIN)
export const getOrderByIdAdmin = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [parseInt(orderId)]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const items = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.price, pi.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_main_image = true
       WHERE oi.order_id = $1
       ORDER BY oi.id`,
      [parseInt(orderId)]
    );

    // Récupérer le statut de synchronisation Shopify
    const syncStatus = await pool.query(
      `SELECT id, local_order_id, shopify_order_id, sync_status, error_message, synced_at, retried_at
       FROM orders_to_shopify_sync 
       WHERE local_order_id = $1`,
      [parseInt(orderId)]
    );

    res.json({
      ...order.rows[0],
      items: items.rows,
      shopifySync: syncStatus.rows[0] || { 
        sync_status: 'pending',
        error_message: null 
      }
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
};

// Annuler une commande
export const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const { orderId } = req.params;
    const userId = req.user.id;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    // Vérifier que la commande appartient à l'utilisateur
    const order = await client.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [parseInt(orderId), userId]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    if (order.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Seules les commandes en attente peuvent être annulées' });
    }

    // Restaurer le stock
    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [parseInt(orderId)]);
    for (const item of items.rows) {
      await client.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Mettre à jour le statut
    const result = await client.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['cancelled', parseInt(orderId)]
    );

    // Mettre à jour le statut Shopify
    await client.query(
      `UPDATE orders_to_shopify_sync 
       SET sync_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE local_order_id = $2`,
      ['failed', parseInt(orderId)]
    );

    await client.query('COMMIT');

    res.json({ message: 'Commande annulée', order: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'annulation de la commande' });
  } finally {
    client.release();
  }
};

// Mettre à jour le statut d'une commande (ADMIN)
export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, trackingNumber, notes } = req.body;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    // Valider les statuts
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const validPaymentStatuses = ['unpaid', 'paid', 'refunded'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut de commande invalide' });
    }

    if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Statut de paiement invalide' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = COALESCE($1, status),
           payment_status = COALESCE($2, payment_status),
           tracking_number = COALESCE($3, tracking_number),
           notes = COALESCE($4, notes),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5 
       RETURNING *`,
      [status || null, paymentStatus || null, trackingNumber || null, notes || null, parseInt(orderId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    res.json({ message: 'Commande mise à jour', order: result.rows[0] });
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande' });
  }
};

// ✨ NEW: Vérifier et réessayer la synchronisation Shopify pour les commandes échouées
export const retrySyncWithShopify = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({ error: 'ID de commande invalide' });
    }

    // Vérifier que la commande existe et est en statut 'failed'
    const syncStatus = await pool.query(
      `SELECT * FROM orders_to_shopify_sync WHERE local_order_id = $1`,
      [parseInt(orderId)]
    );

    if (syncStatus.rows.length === 0) {
      return res.status(404).json({ error: 'Statut de synchronisation non trouvé' });
    }

    if (syncStatus.rows[0].sync_status !== 'failed') {
      return res.status(400).json({ 
        error: `Impossible de réessayer pour une commande avec le statut: ${syncStatus.rows[0].sync_status}` 
      });
    }

    // Récupérer les détails complets de la commande
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [parseInt(orderId)]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    // Récupérer les articles
    const items = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [parseInt(orderId)]
    );

    // Mettre à jour le statut à 'retrying'
    await pool.query(
      `UPDATE orders_to_shopify_sync 
       SET sync_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE local_order_id = $2`,
      ['retrying', parseInt(orderId)]
    );

    // Réessayer la synchronisation Shopify en arrière-plan
    const orderWithDetails = {
      ...order.rows[0],
      items: items.rows
    };

    shopifyOrdersService.sendOrderToShopify(orderWithDetails)
      .then(() => {
        console.log(`✅ Commande #${orderId} resynchronisée avec Shopify`);
        pool.query(
          `UPDATE orders_to_shopify_sync 
           SET sync_status = $1, synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE local_order_id = $2`,
          ['completed', orderId]
        );
      })
      .catch((error) => {
        console.error(`⚠️  Erreur resynchronisation Shopify pour commande #${orderId}:`, error.message);
        pool.query(
          `UPDATE orders_to_shopify_sync 
           SET sync_status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
           WHERE local_order_id = $3`,
          ['failed', error.message, orderId]
        );
      });

    res.json({
      message: 'Tentative de synchronisation en cours',
      shopifySync: {
        status: 'retrying',
        message: 'La commande sera resynchronisée avec Shopify...'
      }
    });
  } catch (err) {
    console.error('Retry sync error:', err);
    res.status(500).json({ error: 'Erreur lors de la tentative de synchronisation' });
  }
};