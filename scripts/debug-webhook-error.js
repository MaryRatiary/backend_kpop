#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL || 'kpop-shop-7871.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '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';
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-kpop-9wn7.onrender.com';
const API_VERSION = '2024-01';

console.log(`\n🔍 DEBUG: Erreur Webhook 422\n`);

async function debug() {
  try {
    console.log('Création d\'un webhook de test...\n');

    const webhookData = {
      webhook: {
        topic: 'orders/create',
        address: `${BACKEND_URL}/api/shopify/webhooks/orders-create`,
        format: 'json'
      }
    };

    console.log('Payload envoyé:');
    console.log(JSON.stringify(webhookData, null, 2));
    console.log('\n');

    const response = await axios.post(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
      webhookData,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Succès!');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Erreur 422 - Détails complets:\n');
    console.log('Status:', error.response?.status);
    console.log('StatusText:', error.response?.statusText);
    console.log('\nReponse Data:');
    console.log(JSON.stringify(error.response?.data, null, 2));
    
    // Analyse
    console.log('\n\n📋 ANALYSE:\n');
    
    const errors = error.response?.data?.errors;
    if (errors) {
      if (Array.isArray(errors)) {
        console.log('Erreurs:');
        errors.forEach((err, i) => {
          console.log(`  ${i+1}. ${err}`);
        });
      } else if (typeof errors === 'object') {
        console.log('Erreurs par champ:');
        Object.entries(errors).forEach(([key, value]) => {
          console.log(`  ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
        });
      }
    }
    
    // Solutions possibles
    console.log('\n\n💡 SOLUTIONS POSSIBLES:\n');
    console.log('1. Permissions manquantes:');
    console.log('   - Allez à: https://admin.shopify.com/admin/apps-and-integrations/develop/apps');
    console.log('   - Cliquez votre app "kpopshop"');
    console.log('   - Configuration → Admin API access scopes');
    console.log('   - Ajoutez: write_webhooks, read_webhooks');
    console.log('   - Sauvegardez et actualisez le token\n');
    
    console.log('2. Token expiré:');
    console.log('   - Régénérez le token');
    console.log('   - Mettez à jour .env\n');
    
    console.log('3. URL invalide:');
    console.log('   - Vérifiez que BACKEND_URL est correct et accessible');
    console.log(`   - Testez: curl ${BACKEND_URL}/api/health\n`);
  }
}

debug();
