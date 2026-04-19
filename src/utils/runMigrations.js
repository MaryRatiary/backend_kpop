import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Exécute les migrations SEULEMENT si elles n'ont pas déjà été exécutées
 */
async function runMigrations() {
  try {
    console.log('🔄 Vérification des migrations...');

    // 1️⃣ Créer la table schema_migrations si elle n'existe pas
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
          name VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Table schema_migrations créée');
    } else {
      console.log('✅ Table schema_migrations existe déjà');
    }

    // 2️⃣ VÉRIFIER SI LA MIGRATION 050 A DÉJÀ ÉTÉ EXÉCUTÉE
    const migrationName = '050_complete_stable_rebuild';
    const migrationCheckResult = await pool.query(
      'SELECT * FROM schema_migrations WHERE name = $1',
      [migrationName]
    );

    if (migrationCheckResult.rows.length > 0) {
      console.log(`⏭️  Migration '${migrationName}' déjà exécutée`);
      console.log('✨ Base de données préservée!\n');
      return true;  // ✅ NE PAS EXÉCUTER LA MIGRATION!
    }

    // 3️⃣ EXÉCUTER LA MIGRATION SEULEMENT SI ELLE N'A PAS ÉTÉ EXÉCUTÉE
    const migrationsDir = path.join(__dirname, '../../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  Dossier migrations non trouvé');
      return true;
    }

    const migration050Path = path.join(migrationsDir, '050_complete_stable_rebuild.sql');
    
    if (fs.existsSync(migration050Path)) {
      try {
        console.log('⏳ Exécution de la migration 050_complete_stable_rebuild.sql...');
        const migrationSQL = fs.readFileSync(migration050Path, 'utf-8');
        
        // ✅ Exécuter la migration
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 050 exécutée avec succès!\n');
        return true;
      } catch (error) {
        console.error('❌ Erreur migration 050:', error.message);
        console.error('   Code:', error.code);
        
        // Si elle échoue, continuer quand même (ne pas crash le serveur)
        return true;
      }
    } else {
      console.log('⏭️  Migration 050 non trouvée');
      return true;
    }

  } catch (error) {
    console.error('❌ Erreur lors du système de migrations:', error);
    return false;
  }
}

export default runMigrations;