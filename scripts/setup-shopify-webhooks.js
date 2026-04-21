/**
 * Script de configuration des webhooks Shopify
 * Utilisation: node scripts/setup-shopify-webhooks.js
 * 
 * Ce script enregistre tous les webhooks nécessaires auprès de Shopify
 */

import dotenv from 'dotenv';
import shopifyClient from '../src/services/shopifyClient.js';

dotenv.config();

const WEBHOOKS = [
  // Webhooks Commandes
  {
    topic: 'orders/create',
    url: '/api/shopify/webhooks/orders/create',
    description: 'Nouvelle commande créée'
  },
  {
    topic: 'orders/updated',
    url: '/api/shopify/webhooks/orders/updated',
    description: 'Commande mise à jour'
  },
  {
    topic: 'orders/paid',
    url: '/api/shopify/webhooks/orders/paid',
    description: 'Paiement confirmé'
  },
  {
    topic: 'fulfillments/create',
    url: '/api/shopify/webhooks/fulfillments/create',
    description: 'Expédition créée'
  },
  {
    topic: 'refunds/create',
    url: '/api/shopify/webhooks/refunds/create',
    description: 'Remboursement créé'
  },
  // Webhooks Produits
  {
    topic: 'products/create',
    url: '/api/shopify/webhooks/products/create',
    description: 'Produit créé'
  },
  {
    topic: 'products/update',
    url: '/api/shopify/webhooks/products/update',
    description: 'Produit mis à jour'
  },
  {
    topic: 'products/delete',
    url: '/api/shopify/webhooks/products/delete',
    description: 'Produit supprimé'
  },
  {
    topic: 'inventory_items/update',
    url: '/api/shopify/webhooks/inventory/update',
    description: 'Inventaire mis à jour'
  }
];

async function setupWebhooks() {
  try {
    console.log('🚀 Configuration des webhooks Shopify...\n');

    // Tester la connexion
    const shop = await shopifyClient.testConnection();
    console.log(`✅ Connecté à: ${shop.name} (${shop.domain})\n`);

    // Récupérer les webhooks existants
    console.log('📋 Récupération des webhooks existants...');
    const existingWebhooks = await shopifyClient.getWebhooks();
    console.log(`   ${existingWebhooks.length} webhooks trouvés\n`);

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';

    // Créer les nouveaux webhooks
    let created = 0;
    let skipped = 0;

    for (const webhook of WEBHOOKS) {
      const fullUrl = baseUrl + webhook.url;
      
      // Vérifier si le webhook existe déjà
      const existing = existingWebhooks.find(w => 
        w.topic === webhook.topic && w.address === fullUrl
      );

      if (existing) {
        console.log(`⏭️  ${webhook.topic} - Déjà existant (ID: ${existing.id})`);
        skipped++;
      } else {
        try {
          const createdWebhook = await shopifyClient.createWebhook(webhook.topic, fullUrl);
          console.log(`✅ ${webhook.topic} - Créé (ID: ${createdWebhook.id})`);
          console.log(`   URL: ${fullUrl}`);
          console.log(`   Description: ${webhook.description}\n`);
          created++;
        } catch (error) {
          console.error(`❌ ${webhook.topic} - Erreur: ${error.message}\n`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('�� Résumé:');
    console.log(`   ✅ Créés: ${created}`);
    console.log(`   ⏭️  Ignorés: ${skipped}`);
    console.log(`   📦 Total: ${created + skipped}/${WEBHOOKS.length}`);
    console.log('='.repeat(60) + '\n');

    if (created > 0) {
      console.log('🎉 Configuration des webhooks terminée avec succès!');
    } else {
      console.log('ℹ️  Tous les webhooks étaient déjà configurés.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error.message);
    process.exit(1);
  }
}

setupWebhooks();
