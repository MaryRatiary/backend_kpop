#!/usr/bin/env node
/**
 * Script de nettoyage COMPLET et reconstruction de la BD
 * À exécuter une seule fois pour nettoyer complètement
 * Usage: node scripts/force-rebuild-db.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function forceBuildDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('\n🔧 NETTOYAGE COMPLET DE LA BASE DE DONNÉES\n');
    console.log('⚠️  ATTENTION: Cette opération va SUPPRIMER TOUTES LES DONNÉES\n');

    // Lire la migration 050
    const migrationPath = path.join(__dirname, '../migrations/050_complete_stable_rebuild.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration 050 non trouvée!');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('⏳ Exécution de la migration 050...\n');
    await client.query(migrationSQL);
    
    console.log('✅ Migration 050 exécutée avec succès!\n');

    // Vérifier les tables créées
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Tables créées:');
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Vérifier la structure de la table orders
    const ordersColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 Colonnes de la table orders:');
    ordersColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    console.log('\n✨ Base de données reconstruite avec succès!');
    console.log('🎉 Vous pouvez maintenant relancer votre serveur\n');

    process.exit(0);

  } catch (err) {
    console.error('\n❌ Erreur:', err.message);
    console.error('\nDétails:', err);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignorer les erreurs de fermeture
    }
  }
}

forceBuildDatabase();
