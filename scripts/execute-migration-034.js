#!/usr/bin/env node
/**
 * Script pour exécuter la migration 034 et nettoyer la base de données
 * Usage: node scripts/execute-migration-034.js
 */

import fs from 'fs';
import path from 'path';
import pool from '../src/config/database.js';

const __dirname = new URL('.', import.meta.url).pathname;

async function executeMigration() {
  try {
    console.log('🔧 Démarrage de la migration 034...\n');

    // Lire le fichier SQL
    const migrationPath = path.join(__dirname, '../migrations/034_ultimate_orders_cleanup.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Exécuter la migration
    console.log('⏳ Exécution de la migration...');
    await pool.query(sql);
    console.log('✅ Migration 034 exécutée avec succès!\n');

    // Vérifier les colonnes finales
    console.log('📋 Colonnes de la table orders après migration:');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);

    result.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✨ Nettoyage complété!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', err.message);
    console.error('\nDétails:', err);
    process.exit(1);
  }
}

executeMigration();
