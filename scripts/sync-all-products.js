/**
 * Script de synchronisation de tous les produits vers Shopify
 * Utilisation: node scripts/sync-all-products.js [limit]
 * Exemple: node scripts/sync-all-products.js 50
 * 
 * Ce script synchronise TOUS les produits de la BD vers Shopify
 * avec leurs variants (tailles, couleurs), images et options complètes
 */

import dotenv from 'dotenv';
import shopifySync from '../src/services/shopifySync.js';

dotenv.config();

async function syncAllProducts() {
  try {
    const limit = process.argv[2] ? parseInt(process.argv[2]) : null;
    
    console.log('\n' + '='.repeat(70));
    console.log('🚀 SYNCHRONISATION DES PRODUITS VERS SHOPIFY');
    console.log('='.repeat(70) + '\n');
    
    if (limit) {
      console.log(`📦 Limite: ${limit} produits\n`);
    } else {
      console.log('📦 Aucune limite: synchronisation de TOUS les produits\n');
    }

    const startTime = Date.now();
    
    const result = await shopifySync.syncProductsToShopify(limit);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSULTATS DE LA SYNCHRONISATION');
    console.log('='.repeat(70));
    console.log(`✅ Réussis: ${result.synced}`);
    console.log(`❌ Échoués: ${result.failed}`);
    console.log(`📦 Total traité: ${result.total}`);
    console.log(`⏱️  Durée: ${duration}s`);
    console.log('='.repeat(70) + '\n');

    if (result.errors && result.errors.length > 0) {
      console.log('⚠️  ERREURS RENCONTRÉES:\n');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. Produit ${error.productId} (${error.productName})`);
        console.log(`   Erreur: ${error.error}\n`);
      });
    }

    if (result.failed === 0) {
      console.log('🎉 Synchronisation terminée avec succès!\n');
    } else {
      console.log(`⚠️  ${result.failed} produit(s) n'ont pas pu être synchronisés.\n`);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error.message);
    console.error(error);
    process.exit(1);
  }
}

syncAllProducts();
