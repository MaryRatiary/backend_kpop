#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script de configuration des webhooks Shopify CORRIGÉ
 * Utilise l'API version 2024-01 au lieu de 2026-04
 */

const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || 'kpop-shop-7871.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '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';
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-kpop-9wn7.onrender.com';

// 🔴 CORRECTION: Utiliser 2024-01 au lieu de 2026-04
const API_VERSION = '2024-01';

console.log(`
╔════════════════════════════════════════════════════════════╗
║         🚀 CONFIGURATION DES WEBHOOKS SHOPIFY              ║
║             (API Version: ${API_VERSION})                      ║
╚════════════════════════════════════════════════════════════╝
`);

console.log('📋 Configuration:');
console.log(`   Shop: ${SHOPIFY_SHOP_URL}`);
console.log(`   Backend: ${BACKEND_URL}`);
console.log(`   API: ${API_VERSION}`);
console.log(`   Token: ${SHOPIFY_ACCESS_TOKEN ? '✅ Présent' : '❌ Manquant'}`);

const webhooks = [
  'orders/create',
  'orders/updated',
  'orders/paid',
  'orders/cancelled',
  'orders/fulfilled',
  'fulfillments/create',
  'fulfillments/update',
  'refunds/create'
];

async function setupWebhooks() {
  try {
    // ========== ÉTAPE 1: Tester la connexion ==========
    console.log('\n\n1️⃣  Test de connexion à Shopify...');
    try {
      const shop = await axios.get(
        `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ Connecté à: ${shop.data.shop.name}`);
    } catch (error) {
      console.log(`❌ Erreur de connexion:`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.errors || error.message}`);
      return;
    }

    // ========== ÉTAPE 2: Récupérer les webhooks existants ==========
    console.log('\n2️⃣  Récupération des webhooks existants...');
    const existing = await axios.get(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );
    console.log(`✅ ${existing.data.webhooks.length} webhook(s) trouvé(s)`);

    // ========== ÉTAPE 3: Supprimer les anciens webhooks ==========
    console.log('\n3️⃣  Suppression des anciens webhooks...');
    for (const webhook of existing.data.webhooks) {
      if (webhook.address.includes(BACKEND_URL)) {
        console.log(`   ⏳ Suppression de: ${webhook.topic}`);
        await axios.delete(
          `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks/${webhook.id}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
          }
        );
        console.log(`   ✅ ${webhook.topic} supprimé`);
      }
    }

    // ========== ÉTAPE 4: Créer les nouveaux webhooks ==========
    console.log('\n4️⃣  Création des nouveaux webhooks...');
    let created = 0;
    let failed = 0;

    for (const topic of webhooks) {
      try {
        // Format l'URL avec des tirets
        const urlPath = topic.replace('/', '-');
        const address = `${BACKEND_URL}/api/shopify/webhooks/${urlPath}`;

        console.log(`\n   📝 ${topic}`);
        console.log(`      → ${address}`);

        const response = await axios.post(
          `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
          {
            webhook: {
              topic: topic,
              address: address,
              format: 'json'
            }
          },
          {
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(`      ✅ Créé (ID: ${response.data.webhook.id})`);
        created++;

        // Délai pour éviter le rate limiting
        await new Promise(r => setTimeout(r, 300));

      } catch (error) {
        console.log(`      ❌ Erreur`);
        console.log(`         Status: ${error.response?.status}`);
        console.log(`         Message: ${error.response?.data?.errors || error.message}`);
        failed++;
      }
    }

    // ========== RÉSUMÉ ==========
    console.log(`\n\n📊 Résumé:\n   ✅ ${created} webhook(s) créé(s)\n   ❌ ${failed} webhook(s) échoué(s)`);

    // ========== VÉRIFICATION FINALE ==========
    console.log('\n5️⃣  Vérification finale...');
    const final = await axios.get(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    const ourWebhooks = final.data.webhooks.filter(w => w.address.includes(BACKEND_URL));
    console.log(`\n✅ ${ourWebhooks.length} webhook(s) actif(s):\n`);
    ourWebhooks.forEach(w => {
      console.log(`   ✓ ${w.topic}`);
    });

    // ========== INSTRUCTIONS FINALES ==========
    console.log(`

╔════════════════════════════════════════════════════════════╗
║                   ✅ CONFIGURATION RÉUSSIE!                ║
╚════════════════════════════════════════════════════════════╝

📋 Prochaines étapes:

1. Vérifier dans Shopify Admin:
   https://admin.shopify.com/admin/webhooks

2. Tester une commande:
   curl -X POST https://backend-kpop-9wn7.onrender.com/api/orders \\
     -H "Authorization: Bearer YOUR_TOKEN" \\
     -H "Content-Type: application/json" \\
     -d '{"items":[{"productId":1,"quantity":1}],"email":"test@example.com","firstName":"Test","lastName":"User"}'

3. Vérifier dans Shopify Orders:
   https://admin.shopify.com/admin/orders

4. Vérifier la synchronisation:
   curl -H "Authorization: Bearer TOKEN" \\
     https://backend-kpop-9wn7.onrender.com/api/admin/shopify/sync/status

✨ Les webhooks sont maintenant configurés!
`);

  } catch (error) {
    console.error('\n❌ Erreur générale:', error.message);
    process.exit(1);
  }
}

setupWebhooks();
