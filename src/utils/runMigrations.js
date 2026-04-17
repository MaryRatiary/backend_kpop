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

    // ✅ CORRECTION: Vérifier et créer la table schema_migrations si elle n'existe pas
    // Avec gestion robuste des erreurs
    const tableExistsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);

    if (!tableExistsResult.rows[0].exists) {
      console.log('📝 Création de la table schema_migrations...');
      await pool.query(`
        CREATE TABLE schema_migrations (
          id SERIAL PRIMARY KEY,
          migration VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Table schema_migrations créée');
    } else {
      console.log('✅ Table schema_migrations existe déjà');
    }

    // Lire tous les fichiers de migration
    const migrationsDir = path.join(__dirname, '../../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  Dossier migrations non trouvé, création...');
      fs.mkdirSync(migrationsDir, { recursive: true });
      return true;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📋 Fichiers de migration trouvés: ${migrationFiles.length}`);

    if (migrationFiles.length === 0) {
      console.log('✅ Aucune migration à exécuter');
      return true;
    }

    // Récupérer les migrations déjà exécutées
    let executedMigrations = new Set();
    try {
      const executedResult = await pool.query(
        'SELECT migration FROM schema_migrations'
      );
      executedMigrations = new Set(
        executedResult.rows.map(row => row.migration)
      );
      console.log(`✅ Migrations déjà exécutées: ${executedMigrations.size}`);
    } catch (error) {
      console.warn('⚠️  Impossible de lire les migrations exécutées:', error.message);
      executedMigrations = new Set();
    }

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
