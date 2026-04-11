import shopifyClient from '../src/services/shopifyClient.js';
import pool from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const WEBHOOK_TOPICS = [
  { topic: 'orders/create', path: '/api/shopify/webhooks/orders/create' },
  { topic: 'orders/updated', path: '/api/shopify/webhooks/orders/updated' },
  { topic: 'orders/paid', path: '/api/shopify/webhooks/orders/paid' },
  { topic: 'fulfillments/create', path: '/api/shopify/webhooks/fulfillments/create' },
  { topic: 'refunds/create', path: '/api/shopify/webhooks/refunds/create' },
];

async function setupShopify() {
  try {
    console.log('🚀 Initialisation de l\'intégration Shopify...\n');

    // 1. Tester la connexion
    console.log('1️⃣  Test de connexion à Shopify...');
    const shop = await shopifyClient.testConnection();
    console.log(`   ✅ Connecté à: ${shop.name} (${shop.domain})\n`);

    // 2. Récupérer les webhooks existants
    console.log('2️⃣  Vérification des webhooks existants...');
    const existingWebhooks = await shopifyClient.getWebhooks();
    console.log(`   ✅ ${existingWebhooks.length} webhook(s) trouvé(s)\n`);

    // 3. Créer les webhooks manquants
    console.log('3️⃣  Création des webhooks...');
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    
    for (const webhook of WEBHOOK_TOPICS) {
      const exists = existingWebhooks.some(w => w.topic === webhook.topic);
      
      if (!exists) {
        const address = `${backendUrl}${webhook.path}`;
        await shopifyClient.createWebhook(webhook.topic, address);
        console.log(`   ✅ Webhook créé: ${webhook.topic} → ${address}`);
      } else {
        console.log(`   ⏭️  Webhook existe déjà: ${webhook.topic}`);
      }
    }

    // 4. Appliquer la migration
    console.log('\n4️⃣  Application de la migration...');
    const migrationFile = await import('fs').then(fs => 
      fs.promises.readFile('./migrations/021_shopify_integration.sql', 'utf8')
    );
    
    await pool.query(migrationFile);
    console.log('   ✅ Migration appliquée avec succès');

    // 5. Récupérer les métriques initiales
    console.log('\n5️⃣  Récupération des métriques Shopify...');
    const metrics = await shopifyClient.getSalesMetrics();
    console.log(`   📊 Commandes totales: ${metrics.totalOrders}`);
    console.log(`   💰 Revenu total: $${metrics.totalRevenue.toFixed(2)}`);
    console.log(`   ✅ Commandes payées: ${metrics.paidOrders}`);
    console.log(`   ⏳ Commandes en attente: ${metrics.pendingOrders}`);
    console.log(`   📈 Panier moyen: $${metrics.averageOrderValue.toFixed(2)}`);

    console.log('\n✨ Configuration Shopify terminée avec succès!');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Configurer BACKEND_URL en production');
    console.log('   2. Déployer le backend');
    console.log('   3. Vérifier les webhooks dans Shopify Admin');
    console.log('   4. Commencer à synchroniser les données');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    await pool.end();
    process.exit(1);
  }
}

setupShopify();
