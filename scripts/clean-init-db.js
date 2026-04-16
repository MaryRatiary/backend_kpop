import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration du pool
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
  };
}

console.log('📋 Configuration du pool:');
console.log(`   - Host: ${poolConfig.host || 'N/A'}`);
console.log(`   - Port: ${poolConfig.port || 'N/A'}`);
console.log(`   - Database: ${poolConfig.database || 'N/A'}`);
console.log(`   - User: ${poolConfig.user || 'N/A'}`);

const pool = new Pool(poolConfig);

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
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(`❌ Impossible de se connecter après ${maxRetries} tentatives`);
}

async function cleanupMigrationsTable() {
  try {
    console.log('🧹 Nettoyage de la table schema_migrations...');
    
    // Vérifier si la table existe
    const checkTable = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'schema_migrations'
      )
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('   → Suppression de la table existante...');
      await pool.query('DROP TABLE IF EXISTS schema_migrations CASCADE');
    }
    
    // Créer la table propre
    console.log('   → Création de la nouvelle table schema_migrations...');
    await pool.query(`
      CREATE TABLE schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table schema_migrations prête');
  } catch (err) {
    console.error('❌ Erreur lors du nettoyage:', err.message);
    throw err;
  }
}

async function runMigrations() {
  try {
    console.log('🔄 Exécution des migrations...');

    const migrationsDir = path.join(__dirname, '../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Dossier migrations inexistant: ${migrationsDir}`);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.warn('⚠️  Aucun fichier de migration trouvé');
      return;
    }

    console.log(`📋 ${files.length} fichier(s) de migration à traiter\n`);

    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const version = file.replace('.sql', '');
      
      // Vérifier si déjà exécutée
      const result = await pool.query(
        'SELECT * FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length > 0) {
        console.log(`✅ ${version} (déjà exécutée)`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`⏳ ${version}...`);
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Exécuter la migration
        await pool.query(sql);
        
        // Enregistrer comme exécutée
        await pool.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        
        console.log(`   ✓ Succès`);
        executedCount++;
      } catch (err) {
        console.error(`   ✗ Erreur: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Résumé:');
    console.log(`   • Exécutées: ${executedCount}`);
    console.log(`   • Déjà présentes: ${skippedCount}`);
    console.log(`   • Erreurs: ${errorCount}`);

    if (errorCount > 0) {
      console.warn(`\n⚠️  ${errorCount} migration(s) avec erreur(s)`);
    } else {
      console.log('\n✅ Toutes les migrations exécutées avec succès!');
    }

  } catch (err) {
    console.error('❌ Erreur fatale:', err);
    throw err;
  }
}

async function main() {
  try {
    await waitForDatabase();
    await cleanupMigrationsTable();
    await runMigrations();
    console.log('\n🎉 Initialisation complète!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erreur fatale:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
