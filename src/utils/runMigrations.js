import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Exécute automatiquement toutes les migrations manquantes
 * Utilisé au démarrage du serveur pour s'assurer que la BD est à jour
 */
async function runMigrations() {
  try {
    console.log('🔄 Vérification des migrations...');

    // Vérifier si la table schema_migrations existe, sinon la créer
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Lire tous les fichiers de migration
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📋 Fichiers de migration trouvés: ${migrationFiles.length}`);

    // Récupérer les migrations déjà exécutées
    const executedResult = await pool.query(
      'SELECT migration FROM schema_migrations'
    );
    const executedMigrations = new Set(
      executedResult.rows.map(row => row.migration)
    );

    console.log(`✅ Migrations déjà exécutées: ${executedMigrations.size}`);

    // Exécuter les migrations manquantes
    let executedCount = 0;
    for (const file of migrationFiles) {
      if (!executedMigrations.has(file)) {
        try {
          console.log(`⏳ Exécution de la migration: ${file}`);
          
          const migrationPath = path.join(migrationsDir, file);
          const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
          
          // Exécuter la migration
          await pool.query(migrationSQL);
          
          // Enregistrer la migration comme exécutée
          await pool.query(
            'INSERT INTO schema_migrations (migration) VALUES ($1)',
            [file]
          );
          
          console.log(`✅ Migration exécutée avec succès: ${file}`);
          executedCount++;
        } catch (error) {
          console.error(`❌ Erreur lors de l'exécution de ${file}:`, error.message);
          // Ne pas arrêter, continuer avec les autres migrations
        }
      }
    }

    if (executedCount > 0) {
      console.log(`\n✨ ${executedCount} nouvelle(s) migration(s) exécutée(s)`);
    } else {
      console.log('\n✅ Base de données à jour, aucune migration à exécuter');
    }

    return true;
  } catch (error) {
    console.error('❌ Erreur lors du système de migrations:', error);
    return false;
  }
}

export default runMigrations;
