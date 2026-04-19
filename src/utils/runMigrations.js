import fs from 'fs';
import path from 'path';
import pool from '../config/database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Exécute la migration 050 pour reconstruire la BD proprement
 */
async function runMigrations() {
  try {
    console.log('🔄 Vérification des migrations...');

    // Vérifier si schema_migrations existe
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

    // Essayer d'exécuter la migration 050
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
        await pool.query(migrationSQL);
        console.log('✅ Migration 050 exécutée avec succès!\n');
        return true;
      } catch (error) {
        // Si la migration a déjà été exécutée, continuer
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('violates') ||
            error.code === '42P07') {
          console.log('⏭️  Migration 050 déjà exécutée ou BD déjà stable\n');
          return true;
        } else {
          console.error('❌ Erreur migration 050:', error.message);
          console.error('   Code:', error.code);
          // Continuer quand même
          return true;
        }
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
