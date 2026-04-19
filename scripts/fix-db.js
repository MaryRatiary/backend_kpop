#!/usr/bin/env node
/**
 * Script de fix automatique du schéma de base de données
 * À exécuter avant le démarrage du serveur
 * ES6 Module version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixDatabaseSchema() {
  console.log('🔧 Démarrage du fix de schéma...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connexion établie');

    // Lire le script SQL de fix
    const fixScript = fs.readFileSync(
      path.join(__dirname, '../migrations/fix-db-schema.sql'),
      'utf8'
    );

    // Exécuter le script
    await client.query(fixScript);
    console.log('✅ Schema fix appliqué avec succès!');

    // Vérifier les colonnes critiques
    const schemaCheck = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('schema_migrations', 'orders')
      ORDER BY table_name, column_name;
    `);

    console.log('\n📋 Colonnes actuelles:');
    schemaCheck.rows.forEach(row => {
      console.log(`   - ${row.table_name}.${row.column_name}`);
    });

    console.log('✨ Schema fix complété!');
    return true;

  } catch (error) {
    console.error('❌ Erreur lors du fix:', error.message);
    return false;

  } finally {
    await client.end();
  }
}

// Exécuter si appelé directement
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  fixDatabaseSchema()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default fixDatabaseSchema;
