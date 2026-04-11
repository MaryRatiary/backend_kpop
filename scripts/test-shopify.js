import dotenv from 'dotenv';
import shopifyClient from '../src/services/shopifyClient.js';
import pool from '../src/config/database.js';

dotenv.config();

/**
 * Script de test pour vérifier la connexion Shopify
 */

async function testShopifyConnection() {
  try {
    console.log('\n🔍 Test de connexion Shopify...\n');

    // 1. Tester la connexion
    console.log('1️⃣  Vérification de la connexion...');
    const shop = await shopifyClient.testConnection();
    console.log(`   ✅ Connecté à: ${shop.name}`);
    console.log(`   📍 Domaine: ${shop.domain}`);
    console.log(`   ✉️  Email: ${shop.email}`);

    // 2. Récupérer les produits
    console.log('\n2️⃣  Récupération des produits Shopify...');
    const products = await shopifyClient.getProducts(5);
    console.log(`   ✅ ${products.length} produits trouvés`);
    products.forEach(p => {
      console.log(`   - ${p.title} (ID: ${p.id})`);
    });

    // 3. Récupérer les commandes
    console.log('\n3️⃣  Récupération des commandes Shopify...');
    const orders = await shopifyClient.getOrders(5, 'any');
    console.log(`   ✅ ${orders.length} commandes trouvées`);
    orders.forEach(o => {
      console.log(`   - Commande #${o.id} - ${o.financial_status} - ${o.total_price} ${o.currency}`);
    });

    // 4. Récupérer les clients
    console.log('\n4️⃣  Récupération des clients Shopify...');
    const customers = await shopifyClient.getCustomers(5);
    console.log(`   ✅ ${customers.length} clients trouvés`);
    customers.forEach(c => {
      console.log(`   - ${c.first_name} ${c.last_name} (${c.email})`);
    });

    // 5. Vérifier les webhooks
    console.log('\n5️⃣  Vérification des webhooks...');
    const webhooks = await shopifyClient.getWebhooks();
    console.log(`   ✅ ${webhooks.length} webhooks configurés`);
    webhooks.forEach(w => {
      console.log(`   - ${w.topic} → ${w.address}`);
    });

    // 6. Vérifier la base de données
    console.log('\n6️⃣  Vérification de la base de données...');
    const dbTest = await pool.query('SELECT COUNT(*) FROM shopify_orders');
    console.log(`   ✅ Table shopify_orders: ${dbTest.rows[0].count} enregistrements`);

    console.log('\n✅ Tous les tests sont passés!\n');

  } catch (error) {
    console.error('\n❌ Erreur lors du test:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testShopifyConnection();
