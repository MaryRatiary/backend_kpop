#!/usr/bin/env node
/**
 * Script de nettoyage complet et recréation de la BD stable
 * Usage: node scripts/reset-database-stable.js
 */

import fs from 'fs';
import path from 'path';
import pool from '../src/config/database.js';

const __dirname = new URL('.', import.meta.url).pathname;

async function resetDatabase() {
  try {
    console.log('\n�� NETTOYAGE ET RECONSTRUCTION DE LA BASE DE DONNÉES\n');
    console.log('⚠️  ATTENTION: Cette opération va SUPPRIMER toutes les données\n');

    // Lire et exécuter la migration 050
    const migrationPath = path.join(__dirname, '../migrations/050_complete_stable_rebuild.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('⏳ Exécution de la migration 050...\n');
    await pool.query(sql);
    
    console.log('✅ Migration 050 exécutée avec succès!\n');

    // Vérifier les tables créées
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tables créées:');
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Vérifier les colonnes de la table orders
    console.log('\n📊 Colonnes de la table orders:');
    const ordersColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);

    ordersColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✨ Base de données stable créée avec succès!');
    console.log('🎉 Vous pouvez maintenant redémarrer votre serveur\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erreur lors du nettoyage:', err.message);
    console.error('\nDétails:', err);
    process.exit(1);
  }
}

resetDatabase();
