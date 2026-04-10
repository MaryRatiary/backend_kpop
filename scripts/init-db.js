import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ Configuration du pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ✅ Lire et exécuter les migrations
async function runMigrations() {
  try {
    console.log('🔄 Vérification des migrations...');

    // Créer la table schema_migrations si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      const version = file.replace('.sql', '');
      
      // Vérifier si la migration a déjà été exécutée
      const result = await pool.query(
        'SELECT * FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Migration ${version} déjà exécutée`);
        continue;
      }

      console.log(`⏳ Exécution de la migration ${version}...`);

      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        console.log(`✅ Migration ${version} exécutée avec succès`);
      } catch (err) {
        console.error(`❌ Erreur lors de l'exécution de ${version}:`, err.message);
        // Continuer avec la migration suivante au lieu de crasher
      }
    }

    console.log('✅ Toutes les migrations ont été vérifiées');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur fatale:', err);
    await pool.end();
    process.exit(1);
  }
}

// Exécuter les migrations
runMigrations();
