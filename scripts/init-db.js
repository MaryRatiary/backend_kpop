import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration du pool - avec fallback sur les variables individuelles
let poolConfig;

if (process.env.DATABASE_URL) {
  console.log('🔗 Utilisation de DATABASE_URL');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
} else {
  console.log('🔗 Utilisation des variables DB_* individuelles');
  poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
}

console.log('📋 Configuration du pool:');
console.log(`   - Host: ${poolConfig.host || 'N/A'}`);
console.log(`   - Port: ${poolConfig.port || 'N/A'}`);
console.log(`   - Database: ${poolConfig.database || 'N/A'}`);
console.log(`   - User: ${poolConfig.user || 'N/A'}`);

const pool = new Pool(poolConfig);

// Fonction pour attendre la connexion avec retry
async function waitForDatabase(maxRetries = 30, delayMs = 2000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Tentative de connexion à la base de données (${attempt}/${maxRetries})...`);
      await pool.query('SELECT NOW()');
      console.log('✅ Connexion à la base de données établie');
      return;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️  Tentative ${attempt} échouée: ${err.message}`);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Attente de ${delayMs}ms avant nouvelle tentative...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`❌ Impossible de se connecter à la base de données après ${maxRetries} tentatives: ${lastError.message}`);
}

// Créer la table schema_migrations avec la structure correcte
async function createMigrationsTable() {
  try {
    console.log('📦 Création de la table schema_migrations...');
    
    // D'abord, vérifier si la table existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('ℹ️  Table schema_migrations existe déjà');
      
      // Vérifier la structure de la table
      const columnsResult = await pool.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'schema_migrations'
      `);
      
      const columns = columnsResult.rows.map(r => r.column_name);
      console.log(`   Colonnes actuelles: ${columns.join(', ')}`);
      
      // Si la table a 'version', on la garde (ancienne structure)
      // Si elle a 'migration', on la garde (nouvelle structure)
      // On les accepte toutes les deux
      return;
    }

    // Créer la table avec la bonne structure
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table schema_migrations créée avec la bonne structure');
  } catch (err) {
    console.error('❌ Erreur lors de la création de schema_migrations:', err.message);
    throw err;
  }
}

// Lire et exécuter les migrations
async function runMigrations() {
  try {
    console.log('🔄 Vérification des migrations...');

    // D'abord, créer la table de migrations
    await createMigrationsTable();

    const migrationsDir = path.join(__dirname, '../migrations');
    
    // Vérifier que le dossier migrations existe
    if (!fs.existsSync(migrationsDir)) {
      console.error(`❌ Le dossier migrations n'existe pas: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir).sort();
    
    if (files.length === 0) {
      console.warn('⚠️  Aucun fichier de migration trouvé');
      return;
    }

    console.log(`📋 Trouvé ${files.length} fichier(s) de migration`);

    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of files) {
      if (!file.endsWith('.sql')) {
        console.log(`⏭️  Ignoré: ${file} (non .sql)`);
        continue;
      }

      const migrationName = file.replace('.sql', '');
      
      // Vérifier si la migration a déjà été exécutée
      // Compatible avec both 'version' et 'migration' columns
      let result;
      try {
        // Essayer avec la colonne 'migration' d'abord (nouvelle structure)
        result = await pool.query(
          'SELECT * FROM schema_migrations WHERE migration = $1',
          [migrationName]
        );
      } catch (err) {
        if (err.code === '42703') {
          // Colonne 'migration' n'existe pas, essayer avec 'version'
          try {
            result = await pool.query(
              'SELECT * FROM schema_migrations WHERE version = $1',
              [migrationName]
            );
          } catch (err2) {
            // Ni 'migration' ni 'version' n'existe, c'est la première migration
            result = { rows: [] };
          }
        } else {
          throw err;
        }
      }

      if (result.rows.length > 0) {
        console.log(`✅ Migration ${migrationName} déjà exécutée`);
        skippedCount++;
        continue;
      }

      console.log(`⏳ Exécution de la migration ${migrationName}...`);

      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        await pool.query(sql);
        
        // Enregistrer la migration - compatible avec les deux structures
        try {
          await pool.query(
            'INSERT INTO schema_migrations (migration) VALUES ($1)',
            [migrationName]
          );
        } catch (err) {
          if (err.code === '42703') {
            // Colonne 'migration' n'existe pas, utiliser 'version'
            await pool.query(
              'INSERT INTO schema_migrations (version) VALUES ($1)',
              [migrationName]
            );
          } else {
            throw err;
          }
        }
        
        console.log(`✅ Migration ${migrationName} exécutée avec succès`);
        executedCount++;
      } catch (err) {
        console.error(`❌ Erreur lors de l'exécution de ${migrationName}:`, err.message);
        console.error(`   Détails: ${err.detail || 'N/A'}`);
        errorCount++;
        // Continuer avec la migration suivante au lieu de crasher
      }
    }

    console.log('\n📊 Résumé des migrations:');
    console.log(`   ✅ ${executedCount} nouvelles migrations exécutées`);
    console.log(`   ⏭️  ${skippedCount} migrations déjà exécutées`);
    if (errorCount > 0) {
      console.log(`   ❌ ${errorCount} erreurs`);
    }

    if (errorCount > 0) {
      console.warn('\n⚠️  Des migrations ont échoué, mais le serveur continue...');
    }
  } catch (err) {
    console.error('❌ Erreur fatale:', err);
    throw err;
  }
}

// Fonction principale
async function main() {
  try {
    console.log('\n🚀 Initialisation de la base de données...\n');
    
    await waitForDatabase();
    await runMigrations();
    
    console.log('\n✅ Initialisation complète!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erreur lors de l\'initialisation:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter
main();
