import dotenv from 'dotenv';
import shopifySync from '../src/services/shopifySync.js';
import pool from '../src/config/database.js';

dotenv.config();

/**
 * Script pour synchroniser les commandes depuis Shopify
 */

async function syncOrders() {
  try {
    console.log('🔄 Synchronisation des commandes depuis Shopify...\n');
    
    const result = await shopifySync.syncOrdersFromShopify();
    
    console.log('\n✅ Synchronisation terminée!');
    console.log(`   📦 Commandes synchronisées: ${result.synced}`);
    console.log(`   ❌ Commandes échouées: ${result.failed}`);
    
  } catch (error) {
    console.error('\n❌ Erreur synchronisation:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

syncOrders();
