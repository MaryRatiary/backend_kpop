/**
 * 🚨 SCRIPT D'URGENCE - Force la recréation de la table reviews
 * Supprime l'ancienne table et en crée une nouvelle avec la bonne structure
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

async function forceRecreateReviews() {
  const client = await pool.connect();
  try {
    console.log('\n🚨 FORCE RECRÉATION DE LA TABLE REVIEWS\n');
    
    // Étape 1: Lire la migration
    console.log('📍 Étape 1: Lecture de la migration 024');
    const migrationPath = path.join(__dirname, '../migrations/024_recreate_reviews_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Fichier migration lu\n');

    // Étape 2: Commencer la transaction
    console.log('📍 Étape 2: Début de la transaction');
    await client.query('BEGIN');
    console.log('✅ Transaction commencée\n');

    try {
      // Étape 3: Exécuter la migration
      console.log('📍 Étape 3: Exécution de la migration');
      console.log('   ⏳ Suppression des anciennes tables...');
      
      await client.query('DROP TABLE IF EXISTS review_images CASCADE');
      console.log('   ✅ review_images supprimée');
      
      await client.query('DROP TABLE IF EXISTS reviews CASCADE');
      console.log('   ✅ reviews supprimée\n');

      console.log('   ⏳ Création des nouvelles tables...');
      
      // Créer reviews
      await client.query(`
        CREATE TABLE reviews (
          id SERIAL PRIMARY KEY,
          productId INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
          author VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          verified BOOLEAN DEFAULT false,
          helpful INTEGER DEFAULT 0,
          notHelpful INTEGER DEFAULT 0,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Table reviews créée');

      // Créer review_images
      await client.query(`
        CREATE TABLE review_images (
          id SERIAL PRIMARY KEY,
          reviewId INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
          imageUrl TEXT NOT NULL,
          "order" INTEGER DEFAULT 0,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Table review_images créée\n');

      console.log('   ⏳ Création des index...');
      
      await client.query('CREATE INDEX idx_reviews_productId ON reviews(productId)');
      await client.query('CREATE INDEX idx_reviews_userId ON reviews(userId)');
      await client.query('CREATE INDEX idx_reviews_rating ON reviews(rating)');
      await client.query('CREATE INDEX idx_reviews_createdAt ON reviews(createdAt DESC)');
      await client.query('CREATE INDEX idx_review_images_reviewId ON review_images(reviewId)');
      console.log('   ✅ Index créés\n');

      console.log('   ⏳ Ajout des colonnes aux produits...');
      
      await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS averageRating DECIMAL(3,2) DEFAULT 0');
      await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewCount INTEGER DEFAULT 0');
      console.log('   ✅ Colonnes ajoutées\n');

      // Commiter la transaction
      await client.query('COMMIT');
      console.log('✅ Transaction commitée avec succès\n');

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur pendant la migration, transaction annulée');
      throw error;
    }

    // Étape 4: Vérification finale
    console.log('📍 Étape 4: Vérification finale');
    
    // Vérifier les colonnes de reviews
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reviews'
      ORDER BY ordinal_position
    `);

    console.log('   🔍 Colonnes de la table reviews:');
    columnsResult.rows.forEach(col => {
      console.log(`      ✓ ${col.column_name.padEnd(15)} (${col.data_type})`);
    });
    console.log('');

    // Vérifier les colonnes de review_images
    const imagesColumnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'review_images'
      ORDER BY ordinal_position
    `);

    console.log('   🔍 Colonnes de la table review_images:');
    imagesColumnsResult.rows.forEach(col => {
      console.log(`      ✓ ${col.column_name.padEnd(15)} (${col.data_type})`);
    });
    console.log('');

    // Compter les index
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('reviews', 'review_images')
      ORDER BY indexname
    `);

    console.log(`   📊 ${indexesResult.rows.length} index créés:`);
    indexesResult.rows.forEach(idx => {
      console.log(`      ✓ ${idx.indexname}`);
    });

    console.log('\n🎉 RECRÉATION RÉUSSIE!\n');
    console.log('💡 Prochaines étapes:');
    console.log('   1. Redémarrer le serveur');
    console.log('   2. Tester: POST /api/reviews/product/1');
    console.log('   3. Les avis devraient marcher parfaitement!\n');

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
forceRecreateReviews();
