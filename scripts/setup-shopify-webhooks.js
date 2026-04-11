import dotenv from 'dotenv';
import shopifyClient from '../src/services/shopifyClient.js';

dotenv.config();

/**
 * Script pour configurer automatiquement les webhooks Shopify
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const WEBHOOKS = [
  {
    topic: 'orders/create',
    address: `${BACKEND_URL}/api/shopify/webhooks/orders/create`,
  },
  {
    topic: 'orders/updated',
    address: `${BACKEND_URL}/api/shopify/webhooks/orders/updated`,
  },
  {
    topic: 'orders/paid',
    address: `${BACKEND_URL}/api/shopify/webhooks/orders/paid`,
  },
  {
    topic: 'fulfillments/create',
    address: `${BACKEND_URL}/api/shopify/webhooks/fulfillments/create`,
  },
  {
    topic: 'refunds/create',
    address: `${BACKEND_URL}/api/shopify/webhooks/refunds/create`,
  },
];

async function setupWebhooks() {
  try {
    console.log('\n🔧 Configuration des webhooks Shopify...\n');
    console.log(`📍 Backend URL: ${BACKEND_URL}\n`);

    // Tester la connexion
    console.log('1️⃣  Vérification de la connexion Shopify...');
    const shop = await shopifyClient.testConnection();
    console.log(`   ✅ Connecté à: ${shop.name}\n`);

    // Récupérer les webhooks existants
    console.log('2️⃣  Récupération des webhooks existants...');
    const existingWebhooks = await shopifyClient.getWebhooks();
    console.log(`   ℹ️  ${existingWebhooks.length} webhook(s) existant(s)\n`);

    // Supprimer les anciens webhooks
    if (existingWebhooks.length > 0) {
      console.log('3️⃣  Suppression des anciens webhooks...');
      for (const webhook of existingWebhooks) {
        await shopifyClient.deleteWebhook(webhook.id);
        console.log(`   ❌ Supprimé: ${webhook.topic}`);
      }
      console.log();
    }

    // Créer les nouveaux webhooks
    console.log('4️⃣  Création des nouveaux webhooks...');
    for (const webhookConfig of WEBHOOKS) {
      try {
        const webhook = await shopifyClient.createWebhook(
          webhookConfig.topic,
          webhookConfig.address
        );
        console.log(`   ✅ Créé: ${webhook.topic} → ${webhook.address}`);
      } catch (error) {
        console.error(`   ❌ Erreur: ${webhookConfig.topic}`);
        console.error(`      ${error.message}`);
      }
    }

    console.log('\n✅ Configuration des webhooks terminée!\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de la configuration:', error.message);
    process.exit(1);
  }
}

setupWebhooks();
