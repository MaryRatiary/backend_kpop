#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script de test pour la synchronisation des commandes vers Shopify
 * Utilisation: node scripts/test-orders-shopify-sync.js
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const TEST_JWT_TOKEN = process.env.TEST_JWT_TOKEN || 'test-token';

console.log('🧪 Test de Synchronisation des Commandes Shopify');
console.log('===============================================\n');

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  step: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`)
};

async function test() {
  try {
    // ========================================
    // Test 1: Vérifier la configuration
    // ========================================
    log.step('1️⃣  Vérification de la configuration');

    log.info(`BACKEND_URL: ${BACKEND_URL}`);
    log.info(`Shopify Shop URL: ${process.env.SHOPIFY_SHOP_URL}`);
    log.info(`API Version: ${process.env.SHOPIFY_API_VERSION || '2026-04'}`);

    if (!process.env.SHOPIFY_ACCESS_TOKEN) {
      log.error('SHOPIFY_ACCESS_TOKEN manquant dans .env');
      process.exit(1);
    }

    log.success('Configuration OK');

    // ========================================
    // Test 2: Tester la connexion Shopify
    // ========================================
    log.step('2️⃣  Test de connexion Shopify');

    try {
      const shopifyHealthResponse = await axios.get(`${BACKEND_URL}/api/shopify/health`);
      log.success(`Connecté à: ${shopifyHealthResponse.data.shop}`);
      log.info(`Domaine: ${shopifyHealthResponse.data.domain}`);
    } catch (error) {
      log.error(`Erreur connexion Shopify: ${error.response?.data?.message || error.message}`);
      log.warning('⚠️  Shopify n\'est peut-être pas accessible. Continuons...');
    }

    // ========================================
    // Test 3: Récupérer le statut de sync
    // ========================================
    log.step('3️⃣  Récupération du statut de synchronisation');

    try {
      const syncStatus = await axios.get(
        `${BACKEND_URL}/api/admin/shopify/sync/status`,
        {
          headers: {
            'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      log.success('Statut de synchronisation récupéré:');
      console.log(`   ✓ Complétées: ${syncStatus.data.stats.completed}`);
      console.log(`   ✓ Échouées: ${syncStatus.data.stats.failed}`);
      console.log(`   ✓ En attente: ${syncStatus.data.stats.pending}`);
      console.log(`   ✓ En retry: ${syncStatus.data.stats.retrying}`);

      if (syncStatus.data.failedOrders.length > 0) {
        log.warning(`${syncStatus.data.failedOrders.length} commande(s) en erreur:`);
        syncStatus.data.failedOrders.forEach(order => {
          console.log(`   - Commande #${order.local_order_id}: ${order.error_message}`);
        });
      } else {
        log.success('Aucune commande en erreur');
      }
    } catch (error) {
      log.error(`Erreur récupération statut: ${error.response?.data?.error || error.message}`);
      
      if (error.response?.status === 401) {
        log.warning('Authentification échouée. Assurez-vous d\'avoir un JWT valide.');
      }
    }

    // ========================================
    // Test 4: Récupérer l'historique
    // ========================================
    log.step('4️⃣  Récupération de l\'historique de synchronisation');

    try {
      const history = await axios.get(
        `${BACKEND_URL}/api/admin/shopify/sync/history?limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      log.success(`${history.data.history.length} dernières synchronisations:`);
      
      history.data.history.forEach((item, index) => {
        console.log(`\n   ${index + 1}. Commande locale #${item.local_order_id}`);
        console.log(`      Status: ${item.sync_status}`);
        console.log(`      Shopify ID: ${item.shopify_order_id || 'N/A'}`);
        console.log(`      Montant: ${item.totalPrice} (Email: ${item.email})`);
        console.log(`      Date: ${new Date(item.synced_at).toLocaleString()}`);
        
        if (item.error_message) {
          console.log(`      ❌ Erreur: ${item.error_message}`);
        }
      });

      log.success(`Total: ${history.data.total} synchronisations enregistrées`);
    } catch (error) {
      log.error(`Erreur récupération historique: ${error.response?.data?.error || error.message}`);
    }

    // ========================================
    // Test 5: Instructions pour un test complet
    // ========================================
    log.step('5️⃣  Prochaines étapes pour tester la synchronisation complète');

    console.log(`
${colors.cyan}Pour tester une synchronisation COMPLÈTE:${colors.reset}

1️⃣  Créer une commande via l'API:
   ${colors.green}curl -X POST http://localhost:5000/api/orders \\${colors.reset}
     ${colors.green}-H "Authorization: Bearer YOUR_JWT_TOKEN" \\${colors.reset}
     ${colors.green}-H "Content-Type: application/json" \\${colors.reset}
     ${colors.green}-d '{${colors.reset}
       ${colors.green}"items": [{"productId": 1, "quantity": 1}],${colors.reset}
       ${colors.green}"shippingAddress": "123 Rue de Paris",${colors.reset}
       ${colors.green}"paymentMethod": "card",${colors.reset}
       ${colors.green}"email": "test@example.com",${colors.reset}
       ${colors.green}"firstName": "Test",${colors.reset}
       ${colors.green}"lastName": "User"${colors.reset}
     ${colors.green}}'${colors.reset}

2️⃣  Attendre quelques secondes (async sync)

3️⃣  Vérifier le statut:
   ${colors.green}curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\${colors.reset}
     ${colors.green}http://localhost:5000/api/admin/shopify/sync/status${colors.reset}

4️⃣  Vérifier dans Shopify Admin:
   ${colors.green}https://admin.shopify.com → Orders${colors.reset}

5️⃣  En cas d'erreur, resynchroniser:
   ${colors.green}curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \\${colors.reset}
     ${colors.green}http://localhost:5000/api/admin/shopify/sync/retry${colors.reset}
    `);

    log.success('\n✅ Test terminé avec succès!');

  } catch (error) {
    log.error(`Erreur générale: ${error.message}`);
    process.exit(1);
  }
}

// Lancer les tests
test();
