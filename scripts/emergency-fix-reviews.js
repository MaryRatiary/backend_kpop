/**
 * 🚨 SCRIPT D'URGENCE - Fix immediate des migrations
 * Exécute directement la migration 023 qui corrige tout
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

async function emergencyFix() {
  const client = await pool.connect();
  try {
    console.log('\n🚨 RÉPARATION D\'URGENCE DES MIGRATIONS\n');
    
    // Étape 1: Lire la migration de correction
    console.log('📍 Étape 1: Lecture de la migration correctrice');
    const migrationPath = path.join(__dirname, '../migrations/023_fix_schema_migrations_and_reviews.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Fichier migration lu\n');

    // Étape 2: Exécuter avec gestion d'erreur complète
    console.log('📍 Étape 2: Exécution de la migration');
    console.log('   ⏳ Cela peut prendre 10-30 secondes...\n');

    // Diviser les requêtes SQL pour exécuter chacune séparément
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      try {
        const statement = statements[i] + ';';
        console.log(`   [${i + 1}/${statements.length}] Exécution...`);
        await client.query(statement);
        console.log(`   ✅ Succès\n`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Erreur: ${error.message}\n`);
        errorCount++;
        // Continuer même en cas d'erreur
      }
    }

    console.log('📊 Résultats:');
    console.log(`   ✅ ${successCount} requêtes réussies`);
    console.log(`   ❌ ${errorCount} requêtes échouées\n`);

    // Étape 3: Vérification finale
    console.log('📍 Étape 3: Vérification finale');
    
    try {
      // Vérifier les tables
      const tablesCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('schema_migrations', 'reviews', 'review_images')
        ORDER BY table_name;
      `);
      
      console.log('   📋 Tables créées:');
      tablesCheck.rows.forEach(row => {
        console.log(`      ✅ ${row.table_name}`);
      });
      console.log('');

      // Vérifier les colonnes de reviews
      const columnsCheck = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'reviews'
        ORDER BY ordinal_position;
      `);

      if (columnsCheck.rows.length > 0) {
        console.log('   🔍 Colonnes de la table reviews:');
        columnsCheck.rows.forEach(col => {
          console.log(`      ✓ ${col.column_name} (${col.data_type})`);
        });
        console.log('');
      }

      // Vérifier les migrations enregistrées
      const migrationsCheck = await client.query(
        'SELECT migration, executed_at FROM schema_migrations ORDER BY executed_at DESC LIMIT 5'
      );

      console.log('   📅 5 dernières migrations exécutées:');
      migrationsCheck.rows.forEach(row => {
        console.log(`      ✅ ${row.migration} (${new Date(row.executed_at).toLocaleString()})`);
      });

    } catch (verifyError) {
      console.error('   ⚠️  Erreur lors de la vérification:', verifyError.message);
    }

    console.log('\n🎉 RÉPARATION TERMINÉE!\n');
    console.log('💡 Prochaines étapes:');
    console.log('   1. Redémarrer le serveur');
    console.log('   2. Tester la création d\'avis: POST /api/reviews/product/1');
    console.log('   3. Les avis devraient fonctionner maintenant!\n');

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

// Exécuter
console.log('🔌 Connexion à la base de données...');
emergencyFix();
