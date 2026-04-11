import dotenv from 'dotenv';
import shopifySync from '../src/services/shopifySync.js';
import pool from '../src/config/database.js';

dotenv.config();

/**
 * Script pour synchroniser les produits vers Shopify
 */

async function syncProducts() {
  try {
    console.log('🔄 Synchronisation des produits vers Shopify...\n');
    
    const result = await shopifySync.syncProductsToShopify();
    
    console.log('\n✅ Synchronisation terminée!');
    console.log(`   📦 Produits synchronisés: ${result.synced}`);
    console.log(`   ❌ Produits échoués: ${result.failed}`);
    
  } catch (error) {
    console.error('\n❌ Erreur synchronisation:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

syncProducts();
