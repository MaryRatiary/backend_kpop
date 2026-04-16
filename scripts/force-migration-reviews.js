/**
 * Script pour forcer l'exécution de la migration reviews
 * Utilise le fichier 022_add_reviews.sql directement
 * Utile quand le serveur a besoin d'une mise à jour rapide
 */

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function forceMigration() {
  const client = await pool.connect();
  try {
    console.log('\n🔧 FORCER LA MIGRATION DES REVIEWS\n');
    console.log('📍 Étape 1: Créer la table schema_migrations si elle n\'existe pas');
    
    // Créer la table schema_migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table schema_migrations prête\n');

    console.log('📍 Étape 2: Lire le fichier de migration 022_add_reviews.sql');
    const migrationPath = path.join(__dirname, '../migrations/022_add_reviews.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Fichier lu avec succès\n');

    console.log('📍 Étape 3: Vérifier si la migration a déjà été exécutée');
    const checkResult = await client.query(
      'SELECT * FROM schema_migrations WHERE migration = $1',
      ['022_add_reviews.sql']
    );

    if (checkResult.rows.length > 0) {
      console.log('⚠️  La migration 022_add_reviews.sql a déjà été exécutée');
      console.log('📅 Exécutée à:', checkResult.rows[0].executed_at);
      console.log('\n💡 Si tu veux recommencer, utilise: DELETE FROM schema_migrations WHERE migration = \'022_add_reviews.sql\';\n');
      return;
    }

    console.log('✅ Migration pas encore exécutée, on continue\n');

    console.log('📍 Étape 4: Exécuter la migration');
    await client.query('BEGIN');
    try {
      // Exécuter la migration
      await client.query(migrationSQL);
      
      // Enregistrer la migration
      await client.query(
        'INSERT INTO schema_migrations (migration) VALUES ($1)',
        ['022_add_reviews.sql']
      );
      
      await client.query('COMMIT');
      console.log('✅ Migration exécutée avec succès!\n');

      // Vérifier que les tables existent
      console.log('📍 Étape 5: Vérification des tables créées');
      
      const reviewsCheck = await client.query(`
        SELECT EXISTS(
          SELECT FROM information_schema.tables 
          WHERE table_name = 'reviews'
        ) AS exists;
      `);
      
      const reviewImagesCheck = await client.query(`
        SELECT EXISTS(
          SELECT FROM information_schema.tables 
          WHERE table_name = 'review_images'
        ) AS exists;
      `);

      console.log(`  - Table 'reviews': ${reviewsCheck.rows[0].exists ? '✅ Existe' : '❌ N\'existe pas'}`);
      console.log(`  - Table 'review_images': ${reviewImagesCheck.rows[0].exists ? '✅ Existe' : '❌ N\'existe pas'}\n`);

      // Vérifier les colonnes de la table reviews
      if (reviewsCheck.rows[0].exists) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'reviews'
          ORDER BY ordinal_position;
        `);
        
        console.log('📋 Colonnes de la table reviews:');
        columnsResult.rows.forEach(col => {
          console.log(`  ✓ ${col.column_name} (${col.data_type})`);
        });
      }

      console.log('\n🎉 Migration réussie! Le système de reviews est maintenant fonctionnel.\n');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter
forceMigration().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
