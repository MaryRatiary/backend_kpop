#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

/**
 * Script de Configuration des Webhooks Shopify
 * Configure automatiquement tous les webhooks nécessaires
 * 
 * Utilisation:
 *   node scripts/setup-shopify-webhooks-final.js
 *
 * Environnement requis dans .env:
 *   - SHOPIFY_SHOP_URL
 *   - SHOPIFY_ACCESS_TOKEN
 *   - BACKEND_URL
 */

// Configuration
const SHOPIFY_SHOP_URL = process.env.SHOPIFY_SHOP_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend-kpop-9wn7.onrender.com';
const API_VERSION = '2026-04';

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  step: (num, msg) => console.log(`\n${colors.cyan}${num}️⃣  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.magenta}${'='.repeat(60)}${colors.reset}\n${colors.magenta}${msg}${colors.reset}\n${colors.magenta}${'='.repeat(60)}${colors.reset}\n`)
};

// Webhooks à configurer
const WEBHOOKS_TO_CREATE = [
  {
    topic: 'orders/create',
    name: 'Nouvelle commande créée',
    description: 'Déclenché quand une nouvelle commande est créée'
  },
  {
    topic: 'orders/updated',
    name: 'Commande mise à jour',
    description: 'Déclenché quand une commande est mise à jour'
  },
  {
    topic: 'orders/paid',
    name: 'Commande payée',
    description: 'Déclenché quand une commande est marquée comme payée'
  },
  {
    topic: 'orders/cancelled',
    name: 'Commande annulée',
    description: 'Déclenché quand une commande est annulée'
  },
  {
    topic: 'orders/fulfilled',
    name: 'Commande livrée',
    description: 'Déclenché quand une commande est complètement livrée'
  },
  {
    topic: 'fulfillments/create',
    name: 'Fulfillment créé',
    description: 'Déclenché quand un fulfillment est créé'
  },
  {
    topic: 'fulfillments/update',
    name: 'Fulfillment mis à jour',
    description: 'Déclenché quand un fulfillment est mis à jour'
  },
  {
    topic: 'refunds/create',
    name: 'Remboursement créé',
    description: 'Déclenché quand un remboursement est créé'
  }
];

/**
 * Vérifier la configuration
 */
async function checkConfiguration() {
  log.header('🔍 VÉRIFICATION DE LA CONFIGURATION');

  log.info(`Shop URL: ${SHOPIFY_SHOP_URL}`);
  log.info(`Access Token: ${SHOPIFY_ACCESS_TOKEN ? '✅ Configuré' : '❌ Manquant'}`);
  log.info(`Backend URL: ${BACKEND_URL}`);
  log.info(`API Version: ${API_VERSION}`);

  if (!SHOPIFY_SHOP_URL || !SHOPIFY_ACCESS_TOKEN) {
    log.error('Configuration manquante!');
    log.error('Vérifiez votre .env avec:');
    console.log('  - SHOPIFY_SHOP_URL');
    console.log('  - SHOPIFY_ACCESS_TOKEN');
    console.log('  - BACKEND_URL');
    process.exit(1);
  }

  // Vérifier que le backend est accessible
  log.step('1', 'Vérification que le backend est public');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, {
      timeout: 5000
    });
    log.success(`Backend est accessible: ${response.status}`);
  } catch (error) {
    log.error(`Backend n'est pas accessible: ${error.message}`);
    log.warning('Assurez-vous que BACKEND_URL est correct et public');
    process.exit(1);
  }
}

/**
 * Récupérer les webhooks existants
 */
async function getExistingWebhooks() {
  log.step('2', 'Récupération des webhooks existants');

  try {
    const response = await axios.get(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const webhooks = response.data.webhooks;
    log.success(`${webhooks.length} webhook(s) existant(s) trouvé(s)`);

    webhooks.forEach((webhook) => {
      console.log(`  • ${webhook.topic} → ${webhook.address}`);
    });

    return webhooks;
  } catch (error) {
    log.error(`Erreur: ${error.response?.data?.errors || error.message}`);
    throw error;
  }
}

/**
 * Supprimer les anciens webhooks pointant vers le backend
 */
async function deleteOldWebhooks(existingWebhooks) {
  log.step('3', 'Nettoyage des anciens webhooks');

  const webhooksToDelete = existingWebhooks.filter(w => 
    w.address.includes(BACKEND_URL) || w.address.includes('localhost')
  );

  if (webhooksToDelete.length === 0) {
    log.success('Aucun ancien webhook à supprimer');
    return;
  }

  log.warning(`${webhooksToDelete.length} webhook(s) à supprimer`);

  for (const webhook of webhooksToDelete) {
    try {
      await axios.delete(
        `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks/${webhook.id}.json`,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        }
      );
      log.success(`Supprimé: ${webhook.topic}`);
    } catch (error) {
      log.error(`Erreur suppression ${webhook.topic}: ${error.message}`);
    }
  }
}

/**
 * Créer les nouveaux webhooks
 */
async function createNewWebhooks() {
  log.step('4', 'Création des nouveaux webhooks');

  let created = 0;
  let failed = 0;

  for (const webhookConfig of WEBHOOKS_TO_CREATE) {
    try {
      const webhookAddress = `${BACKEND_URL}/api/shopify/webhooks/${webhookConfig.topic.replace('/', '-')}`;
      
      console.log(`\n📝 ${webhookConfig.name}`);
      console.log(`   Topic: ${webhookConfig.topic}`);
      console.log(`   Address: ${webhookAddress}`);

      const response = await axios.post(
        `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
        {
          webhook: {
            topic: webhookConfig.topic,
            address: webhookAddress,
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

      log.success(`Créé: ${webhookConfig.name}`);
      console.log(`   ID Shopify: ${response.data.webhook.id}`);
      created++;

      // Petit délai pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      const errorMsg = error.response?.data?.errors?.[0] || error.message;
      log.error(`Erreur: ${webhookConfig.name} - ${errorMsg}`);
      failed++;
    }
  }

  console.log(`\n📊 Résumé: ${created} créé(s), ${failed} échoué(s)`);
  return { created, failed };
}

/**
 * Vérifier que les webhooks fonctionnent
 */
async function verifyWebhooks() {
  log.step('5', 'Vérification des webhooks créés');

  try {
    const response = await axios.get(
      `https://${SHOPIFY_SHOP_URL}/admin/api/${API_VERSION}/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    const webhooks = response.data.webhooks.filter(w => w.address.includes(BACKEND_URL));
    
    if (webhooks.length === 0) {
      log.warning('Aucun webhook trouvé pour ce backend');
      return;
    }

    log.success(`${webhooks.length} webhook(s) actif(s):`);
    webhooks.forEach((webhook) => {
      console.log(`  ✓ ${webhook.topic}`);
      console.log(`    ID: ${webhook.id}`);
      console.log(`    Address: ${webhook.address}`);
      console.log(`    Created: ${webhook.created_at}`);
    });

  } catch (error) {
    log.error(`Erreur vérification: ${error.message}`);
  }
}

/**
 * Afficher les instructions finales
 */
function showFinalInstructions() {
  log.header('✅ CONFIGURATION TERMINÉE');

  console.log(`
${colors.green}Les webhooks sont maintenant configurés!${colors.reset}

${colors.cyan}Prochaines étapes:${colors.reset}

1. Vérifier dans Shopify Admin:
   ${colors.green}https://admin.shopify.com/admin/webhooks${colors.reset}

2. Tester avec une commande:
   ${colors.green}curl -X POST http://localhost:5000/api/orders \\${colors.reset}
     ${colors.green}-H "Authorization: Bearer YOUR_TOKEN" \\${colors.reset}
     ${colors.green}-H "Content-Type: application/json" \\${colors.reset}
     ${colors.green}-d '{ "items": [...], "email": "test@example.com", ... }'${colors.reset}

3. Vérifier le backend:
   ${colors.green}npm run dev${colors.reset}
   (Vous devriez voir les webhooks être reçus dans les logs)

4. Vérifier dans Shopify Admin:
   ${colors.green}https://admin.shopify.com/admin/orders${colors.reset}
   (Votre commande devrait apparaître!)

5. Vérifier la synchronisation:
   ${colors.green}curl -H "Authorization: Bearer TOKEN" \\${colors.reset}
     ${colors.green}http://localhost:5000/api/admin/shopify/sync/status${colors.reset}

${colors.yellow}⚠️  Important:${colors.reset}
- Les webhooks envoient des POST à: ${BACKEND_URL}/api/shopify/webhooks/*
- Assurez-vous que ces routes existent dans votre backend
- Vérifiez les logs pour les erreurs

${colors.magenta}Documentation:${colors.reset}
- Shopify Webhooks: https://shopify.dev/api/admin-rest/2026-04/resources/webhook
- Votre guide: ${colors.cyan}SHOPIFY_ORDERS_INTEGRATION.md${colors.reset}
  `);
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('\n');
    log.header('🚀 CONFIGURATION DES WEBHOOKS SHOPIFY');

    // Étape 1: Vérifier la configuration
    await checkConfiguration();

    // Étape 2: Récupérer les webhooks existants
    const existingWebhooks = await getExistingWebhooks();

    // Étape 3: Supprimer les anciens webhooks
    await deleteOldWebhooks(existingWebhooks);

    // Étape 4: Créer les nouveaux webhooks
    const result = await createNewWebhooks();

    if (result.failed > 0) {
      log.warning(`${result.failed} webhook(s) n'ont pas pu être créé(s)`);
    }

    // Étape 5: Vérifier les webhooks
    await verifyWebhooks();

    // Afficher les instructions
    showFinalInstructions();

    log.success('\n✅ Configuration complète!');

  } catch (error) {
    log.error(`Erreur: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Lancer le script
main();
