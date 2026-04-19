#!/usr/bin/env node
/**
 * Script de fix automatique du schéma de base de données
 * À exécuter avant le démarrage du serveur
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
      path.join(__dirname, '../fix-db-schema.sql'),
      'utf8'
    );

    // Exécuter le script
    await client.query(fixScript);
    console.log('✅ Schema fix appliqué avec succès!');

    // Vérifier les colonnes critiques
    const schemaCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('schema_migrations', 'orders')
      ORDER BY table_name, column_name;
    `);

    console.log('\n📋 Colonnes actuelles:');
    schemaCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

    return true;

  } catch (error) {
    console.error('❌ Erreur lors du fix:', error.message);
    return false;

  } finally {
    await client.end();
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  fixDatabaseSchema()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = fixDatabaseSchema;