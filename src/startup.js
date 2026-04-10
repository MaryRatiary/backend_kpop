import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ✅ ÉTAPE 1: Exécuter les migrations
async function runMigrations() {
  try {
    console.log('📊 ÉTAPE 1: Vérification des migrations...');

    // Créer la table schema_migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    let executedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      const version = file.replace('.sql', '');
      const result = await pool.query(
        'SELECT * FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length > 0) {
        continue; // Déjà exécutée
      }

      console.log(`  ⏳ Migration ${version}...`);

      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        console.log(`  ✅ ${version}`);
        executedCount++;
      } catch (err) {
        console.warn(`  ⚠️  ${version}: ${err.message.split('\n')[0]}`);
      }
    }

    console.log(`✅ Migrations: ${executedCount} nouvelles, ${files.length - executedCount} déjà exécutées\n`);

  } catch (err) {
    console.error('❌ Erreur migrations:', err.message);
    throw err;
  }
}

// ✅ ÉTAPE 2: Créer les indexes de performance
async function createPerformanceIndexes() {
  try {
    console.log('📊 ÉTAPE 2: Création des indexes de performance...');

    const indexes = [
      // Products
      'CREATE INDEX IF NOT EXISTS idx_products_categoryId ON products(categoryId)',
      'CREATE INDEX IF NOT EXISTS idx_products_groupId ON products(groupId)',
      'CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured)',
      'CREATE INDEX IF NOT EXISTS idx_products_featured_createdAt ON products(featured, createdAt DESC)',

      // Product images
      'CREATE INDEX IF NOT EXISTS idx_product_images_productId ON product_images(productId)',
      'CREATE INDEX IF NOT EXISTS idx_product_images_isMainImage ON product_images(isMainImage)',

      // Product variants
      'CREATE INDEX IF NOT EXISTS idx_product_sizes_productId ON product_sizes(productId)',
      'CREATE INDEX IF NOT EXISTS idx_product_colors_productId ON product_colors(productId)',

      // Orders
      'CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt DESC)',

      // Order items
      'CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_productId ON order_items(productId)',

      // Reviews
      'CREATE INDEX IF NOT EXISTS idx_reviews_productId ON reviews(productId)',

      // Categories
      'CREATE INDEX IF NOT EXISTS idx_categories_parentId ON categories(parentId)',
    ];

    let createdCount = 0;
    for (const indexSql of indexes) {
      try {
        await pool.query(indexSql);
        createdCount++;
      } catch (err) {
        // Index peut déjà exister, c'est OK
      }
    }

    console.log(`✅ Indexes: ${createdCount} vérifiés\n`);

  } catch (err) {
    console.error('❌ Erreur indexes:', err.message);
    throw err;
  }
}

// ✅ ÉTAPE 3: Analyser les statistiques
async function analyzeStatistics() {
  try {
    console.log('📊 ÉTAPE 3: Analyse des statistiques...');

    const tables = [
      'products', 'product_images', 'product_sizes', 'product_colors',
      'orders', 'order_items', 'categories', 'users'
    ];

    for (const table of tables) {
      try {
        await pool.query(`ANALYZE ${table}`);
      } catch (err) {
        // Table peut ne pas exister, c'est OK
      }
    }

    console.log(`✅ Statistiques analysées\n`);

  } catch (err) {
    console.error('❌ Erreur analyse:', err.message);
    throw err;
  }
}

// ✅ Exécuter le startup complet
export async function initializeDatabase() {
  try {
    console.log('\n🚀 INITIALISATION DE LA BASE DE DONNÉES\n');
    console.log('═'.repeat(50));

    await runMigrations();
    await createPerformanceIndexes();
    await analyzeStatistics();

    console.log('═'.repeat(50));
    console.log('✅ INITIALISATION TERMINÉE\n');

    await pool.end();
  } catch (err) {
    console.error('\n❌ INITIALISATION ÉCHOUÉE\n', err);
    await pool.end();
    process.exit(1);
  }
}

// Si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}
