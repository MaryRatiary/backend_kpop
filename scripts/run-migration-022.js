import pool from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('📦 Exécution de la migration 022_add_reviews.sql...\n');

    // Lire le fichier SQL
    const migrationPath = path.join(__dirname, '../migrations/022_add_reviews.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf-8');

    // Exécuter la migration
    await pool.query(sqlContent);

    console.log('✅ Migration 022_add_reviews.sql exécutée avec succès!\n');

    // Vérifier que les tables ont été créées
    console.log('📋 Vérification des tables créées...\n');

    const reviewsTableCheck = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews')`
    );
    console.log(`✓ Table 'reviews': ${reviewsTableCheck.rows[0].exists ? '✅ Créée' : '❌ Non créée'}`);

    const reviewImagesTableCheck = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'review_images')`
    );
    console.log(`✓ Table 'review_images': ${reviewImagesTableCheck.rows[0].exists ? '✅ Créée' : '❌ Non créée'}`);

    // Vérifier les colonnes du produit
    const productsColumnsCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('averageRating', 'reviewCount')`
    );
    console.log(`✓ Colonnes produit: ${productsColumnsCheck.rows.length} ajoutées ✅`);

    console.log('\n🎉 Tout est prêt! Les avis peuvent maintenant être créés.\n');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
