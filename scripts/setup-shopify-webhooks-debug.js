#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-kpop-9wn7.onrender.com';
const API_VERSION = '2026-04';

console.log('\n🔍 DEBUG: Configuration des Webhooks\n');
console.log('Shop URL:', SHOPIFY_SHOP_URL);
console.log('Backend URL:', BACKEND_URL);
console.log('API Version:', API_VERSION);
console.log('Token:', SHOPIFY_ACCESS_TOKEN ? '✅' : '❌');

async function debugWebhooks() {
  try {
    // Test 1: Vérifier que le token est valide
    console.log('\n\n1️⃣  Vérification du token...');
    const shopResponse = await axios.get(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Shop trouvé:', shopResponse.data.shop.name);

    // Test 2: Créer un webhook simple
    console.log('\n2️⃣  Création d\'un webhook de test...');
    
    const webhookData = {
      webhook: {
        topic: 'orders/create',
        address: `${BACKEND_URL}/api/shopify/webhooks/orders-create`,
        format: 'json'
      }
    };

    console.log('\nPayload envoyé à Shopify:');
    console.log(JSON.stringify(webhookData, null, 2));

    try {
      const webhookResponse = await axios.post(
        `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
        webhookData,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('\n✅ Webhook créé avec succès!');
      console.log(JSON.stringify(webhookResponse.data, null, 2));
    } catch (error) {
      console.log('\n❌ Erreur lors de la création du webhook:');
      console.log('Status:', error.response?.status);
      console.log('Erreur complète:', JSON.stringify(error.response?.data, null, 2));
      
      // Analyse de l'erreur
      if (error.response?.status === 422) {
        console.log('\n📋 Analyse de l\'erreur 422:');
        console.log('   Cela signifie que les données envoyées sont invalides');
        console.log('   Possibilités:');
        console.log('   - L\'URL du webhook est invalide');
        console.log('   - Le format est incorrect');
        console.log('   - L\'API version 2026-04 n\'existe pas ou a changé');
      }
    }

    // Test 3: Vérifier les webhooks existants
    console.log('\n3️⃣  Récupération des webhooks existants...');
    const existingWebhooks = await axios.get(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ ${existingWebhooks.data.webhooks.length} webhook(s) trouvé(s)`);
    existingWebhooks.data.webhooks.forEach(w => {
      console.log(`   - ${w.topic} → ${w.address}`);
    });

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    if (error.response?.data) {
      console.error('Réponse:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugWebhooks();
